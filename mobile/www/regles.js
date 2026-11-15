/* Vigie — moteur de règles (version téléphone).
 * Copie fidèle de regles.py : les règles elles-mêmes viennent de regles.json,
 * généré par outils/exporter_regles.py. Le PC et le téléphone donnent donc le même verdict.
 * Pixel's ASBL — Boussu — licence GPL-3.0 */
(function (racine) {
  'use strict';

  function sansAccents(texte) {
    return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function echapper(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function domaine(url) {
    if (!url.toLowerCase().startsWith('http')) url = 'http://' + url;
    var hote = '';
    try { hote = new URL(url).hostname.toLowerCase(); } catch (e) { hote = ''; }
    return hote.startsWith('www.') ? hote.slice(4) : hote;
  }

  function appartient(hote, domaines) {
    return domaines.some(function (d) { return hote === d || hote.endsWith('.' + d); });
  }

  function creerAnalyseur(R) {
    var reglesTexte = R.regles_texte.map(function (r) {
      return { re: new RegExp(r.motif), points: r.points, raison: r.raison };
    });
    var urlRe = new RegExp(R.url_re, 'gi');
    var raccourcisseurs = new Set(R.raccourcisseurs);
    var tldSuspects = new Set(R.tld_suspects);
    var nomsMarques = Object.keys(R.marques);
    var reMarques = nomsMarques.map(function (m) { return new RegExp('\\b' + echapper(m) + '\\b'); });
    var NBSP = ' ';

    return function analyser(texte) {
      var brut = texte || '';
      var t = sansAccents(brut);
      var score = 0;
      var trouvees = new Map();

      function ajouter(points, raison) {
        score += points;
        trouvees.set(raison, Math.max(points, trouvees.get(raison) || 0));
      }

      reglesTexte.forEach(function (r) { if (r.re.test(t)) ajouter(r.points, r.raison); });

      var marques = nomsMarques.filter(function (m, i) { return reMarques[i].test(t); });

      var liens = (brut.match(urlRe) || []).map(function (u) { return u.replace(/[.,;:!?)]+$/, ''); });
      var hotes = liens.map(domaine).filter(Boolean);
      hotes.forEach(function (hote) {
        if (raccourcisseurs.has(hote)) {
          ajouter(2, 'Le lien «' + NBSP + hote + NBSP + '» cache la vraie adresse du site.');
        }
        if (/^[\d.]+$/.test(hote)) {
          ajouter(3, "Le lien est une suite de chiffres au lieu d'un nom de site : très suspect.");
        }
        var fin = hote.split('.').pop();
        if (tldSuspects.has(fin)) {
          ajouter(2, 'Le lien se termine par «' + NBSP + '.' + fin + NBSP + '», une terminaison souvent utilisée par les escrocs.');
        }
        if (/(secur|verif|login|update|confirm|client|support|paiement|colis|rembourse)/.test(hote)) {
          ajouter(1, "L'adresse «" + NBSP + hote + NBSP + '» utilise des mots rassurants pour imiter un site officiel.');
        } else if ((hote.match(/-/g) || []).length >= 2) {
          ajouter(1, "L'adresse «" + NBSP + hote + NBSP + '» est inhabituelle, avec beaucoup de tirets.');
        }
        marques.forEach(function (m) {
          if (!appartient(hote, R.marques[m])) {
            ajouter(3, 'Le message parle de «' + NBSP + m + NBSP + '» mais le lien mène à «' + NBSP + hote + NBSP +
              "», qui n'est pas le site officiel (" + R.marques[m].join(', ') + ').');
          }
        });
      });
      if (liens.length && trouvees.size === 0) {
        ajouter(1, "Le message contient un lien. N'y allez pas depuis le message : tapez vous-même l'adresse officielle.");
      }

      // Les raisons les plus graves d'abord (tri stable, comme en Python).
      var raisons = Array.from(trouvees.keys()).sort(function (a, b) { return trouvees.get(b) - trouvees.get(a); });
      var verdict = score >= R.seuil_rouge ? 'rouge' : score >= R.seuil_orange ? 'orange' : 'vert';
      return { verdict: verdict, score: score, raisons: raisons, liens: liens, marques: marques,
               conseils: R.conseils[verdict] };
    };
  }

  var api = { creerAnalyseur: creerAnalyseur, sansAccents: sansAccents };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.VigieRegles = api;
})(this);
