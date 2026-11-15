/* Vigie — application Android autonome. Pixel's ASBL, Boussu — GPL-3.0
 * Tout se passe sur le téléphone : lecture de la photo (Tesseract.js, embarqué), analyse (regles.js), voix. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var AIDANT_DEFAUT = { nom: "Pixel's ASBL", tel: '+32456960328' };
  var R = null, analyser = null, travailleur = null, choisi = null;

  /* ---------- Personne de confiance : choisie par l'utilisateur, jamais préréglée ---------- */
  function aidant() {
    try { var a = JSON.parse(localStorage.getItem('vigie.aidant')); if (a && a.tel) return a; } catch (e) {}
    return null;
  }
  function chiffres(t) { return String(t || '').replace(/[^+\d]/g, ''); }
  function majAidant() {
    var a = aidant(), h = $('aide-haut');
    h.hidden = !a || $('vue-lecture').classList.contains('active');
    if (a) { h.href = 'tel:' + chiffres(a.tel); h.lastChild.textContent = 'Appeler ' + a.nom; }
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- Vues (le bouton « retour » d'Android fonctionne) ---------- */
  function vue(nom, empiler) {
    ['accueil', 'lecture', 'resultat', 'reglages'].forEach(function (n) { $('vue-' + n).classList.toggle('active', n === nom); });
    majAidant();
    if (empiler) history.pushState({ v: nom }, '', '#' + nom);
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', function (e) {
    var n = (e.state && e.state.v) || 'accueil';
    if (n === 'resultat' && dernier && analyser) afficher(dernier.t, dernier.p, false); else vue(n, false);
  });
  function erreur(msg) { $('erreur').hidden = !msg; $('erreur-texte').textContent = msg || ''; }

  /* ---------- Préparation de la photo (même logique que sur PC) ---------- */
  function preparer(fichier) {
    return createImageBitmap(fichier, { imageOrientation: 'from-image' }).then(function (bmp) {
      var cote = Math.max(bmp.width, bmp.height);
      var k = cote < 1600 ? 1600 / cote : (cote > 2200 ? 2200 / cote : 1);
      var c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      var g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(bmp, 0, 0, c.width, c.height);
      if (bmp.close) bmp.close();
      var im = g.getImageData(0, 0, c.width, c.height), d = im.data, n = d.length / 4, h = new Uint32Array(256), somme = 0, i;
      for (i = 0; i < d.length; i += 4) {
        var y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        d[i] = y; h[y]++; somme += y;
      }
      var inverser = (somme / n) < 110;               // écran sombre, texte clair
      if (inverser) { var h2 = new Uint32Array(256); for (i = 0; i < 256; i++) h2[255 - i] = h[i]; h = h2; }
      var coupe = n * 0.001, bas = 0, haut = 255, acc = 0;  // étirement du contraste (0,1 % de chaque côté)
      for (i = 0; i < 256; i++) { acc += h[i]; if (acc > coupe) { bas = i; break; } }
      acc = 0; for (i = 255; i >= 0; i--) { acc += h[i]; if (acc > coupe) { haut = i; break; } }
      if (haut - bas < 64) { bas = 0; haut = 255; }     // texte très rare : on n'étire pas, pour ne rien perdre
      var ech = 255 / (haut - bas);
      for (i = 0; i < d.length; i += 4) {
        var v = inverser ? 255 - d[i] : d[i];
        v = Math.max(0, Math.min(255, Math.round((v - bas) * ech)));
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      return new Promise(function (ok, ko) { c.toBlob(function (b) { b ? ok(b) : ko(new Error('toBlob')); }, 'image/png'); });
    });
  }

  /* ---------- Lecture (OCR) hors ligne ---------- */
  function simd() {
    try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; }
  }
  function creerTravailleur() {
    if (travailleur) return travailleur;
    var base = new URL('ocr/', location.href).href;
    travailleur = Tesseract.createWorker('fra', 1, {
      workerPath: base + 'worker.min.js',
      corePath: base + (simd() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'),
      langPath: base, gzip: true, cacheMethod: 'none', workerBlobURL: false,
      logger: function (m) {
        if (m.status === 'recognizing text') progres(30 + Math.round(m.progress * 65));
        else if (m.status && /load|init/.test(m.status)) progres(10 + Math.round((m.progress || 0) * 18));
      }
    });
    return travailleur;
  }
  function progres(p) { $('barre-int').style.width = Math.max(2, Math.min(100, p)) + '%'; $('barre').setAttribute('aria-valuenow', p); }

  function lirePhoto(fichier) {
    $('lecture-titre').textContent = 'Lecture de la photo…';
    progres(4); vue('lecture', false);
    return preparer(fichier).then(function (png) {
      progres(8);
      return creerTravailleur().then(function (w) { return w.recognize(png); });
    }).then(function (r) { progres(100); return (r.data.text || '').trim(); });
  }

  /* ---------- Résultat ---------- */
  var TITRES = {
    rouge: ['Arnaque probable', 'Ne faites rien avec ce message', 'Ce message ressemble fortement à une arnaque. Ne cliquez pas, ne répondez pas.', 'danger'],
    orange: ['Prudence', "Vérifiez avant d'agir", "Certains indices sont inquiétants. Ne cliquez pas sur le lien tant que vous n'avez pas vérifié.", 'attention'],
    vert: ['Aucun signe connu', 'Pas de piège détecté', "Vigie n'a trouvé aucun indice d'arnaque. Ce n'est pas une garantie : restez attentif.", 'ok']
  };
  var dernier = null;
  function afficher(texte, depuisPhoto, empiler) {
    dernier = { t: texte, p: depuisPhoto };
    var r = analyser(texte), t = TITRES[r.verdict], c = R.conseils[r.verdict], a = aidant();
    var h = '<section class="verdict ' + r.verdict + '" id="reponse" aria-live="polite"><div class="verdict-tete"><svg aria-hidden="true"><use href="#i-' + t[3] + '"/></svg><div>' +
      '<div class="verdict-etiquette">' + t[0] + '</div><h1>' + t[1] + '</h1></div></div><p>' + t[2] + '</p></section>';
    if (r.verdict !== 'vert') h += '<div class="actions">' + (a
      ? '<a class="btn btn-appel" href="tel:' + esc(chiffres(a.tel)) + '"><svg aria-hidden="true"><use href="#i-tel"/></svg>Appeler ' + esc(a.nom) + '</a>'
      : '<button class="btn btn-camera" type="button" id="choisir-aidant"><svg aria-hidden="true"><use href="#i-tel"/></svg>Choisir ma personne de confiance</button>') + '</div>';
    h += '<section class="carte"><h2>Que faire maintenant ?</h2><ol class="etapes">' + c.slice(0, 3).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
    if (c.length > 3) h += '<div class="encadre">' + c.slice(3).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '</div>';
    h += '</section>';
    if (r.raisons.length) h += '<details' + (r.verdict !== 'vert' ? ' open' : '') + '><summary>Pourquoi Vigie pense cela</summary><div class="details-corps"><ul>' +
      r.raisons.slice(0, 3).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></details>';
    h += '<details><summary>' + (depuisPhoto ? 'Texte lu sur la photo' : 'Voir le message analysé') + '</summary><div class="details-corps"><p class="message-brut">' + esc(texte) + '</p>' +
      (depuisPhoto ? '<p class="note">Si le texte est faux, reprenez la photo plus près, bien droite et bien éclairée.</p>' : '') + '</div></details>';
    h += '<div class="actions-duo"><button class="btn btn-secondaire" type="button" id="ecouter"><svg aria-hidden="true"><use href="#i-son"/></svg>Écouter</button>' +
      '<button class="btn btn-secondaire" type="button" id="autre"><svg aria-hidden="true"><use href="#i-retour"/></svg>Autre message</button></div>';
    $('vue-resultat').innerHTML = h;
    $('ecouter').onclick = function () {
      parler($('reponse').innerText + '. ' + document.querySelector('ol.etapes').innerText);
    };
    if ($('choisir-aidant')) $('choisir-aidant').onclick = ouvrirReglages;
    $('autre').onclick = function () { $('texte').value = ''; reinitialiser(); history.back(); };
    vue('resultat', empiler !== false);
  }

  /* ---------- Voix ---------- */
  function parler(texte) {
    var P = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.TextToSpeech;
    if (P && P.speak) { P.stop().catch(function () {}); P.speak({ text: texte, lang: 'fr-BE', rate: 0.9 }).catch(function () { synthese(texte); }); }
    else synthese(texte);
  }
  function synthese(texte) {
    try { var u = new SpeechSynthesisUtterance(texte); u.lang = 'fr-BE'; u.rate = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
  }

  /* ---------- Formulaire ---------- */
  function reinitialiser() { choisi = null; $('camera').value = ''; $('galerie').value = ''; erreur(''); }
  function traiterPhoto(f) {
    erreur('');
    lirePhoto(f).then(function (texte) {
      if (texte.replace(/\s/g, '').length < 12) {
        vue('accueil', false);
        erreur("Vigie n'a pas pu lire de texte sur cette photo. Reprenez-la plus près, bien droite et bien éclairée, ou collez le texte.");
        return;
      }
      $('texte').value = texte;
      afficher(texte, true);
    }).catch(function () {
      vue('accueil', false);
      erreur("La lecture de la photo a échoué. Réessayez, ou collez le texte du message.");
    }).then(function () { reinitialiser(); });
  }
  ['camera', 'galerie'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      traiterPhoto(f);
    });
  });
  $('coller').addEventListener('click', function () {
    var t = $('texte');
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (x) { if (x) t.value = x; t.focus(); }).catch(function () { t.focus(); });
    else t.focus();
  });
  $('formulaire').addEventListener('submit', function (e) {
    e.preventDefault();
    var texte = $('texte').value.trim();
    if (!texte) { erreur('Collez d’abord le message, ou prenez-le en photo.'); $('texte').focus(); return; }
    erreur(''); afficher(texte, false);
  });

  /* ---------- Réglages ---------- */
  function erreurReglages(m) { $('erreur-reglages').hidden = !m; $('erreur-reglages-texte').textContent = m || ''; }
  function ouvrirReglages() {
    var a = aidant(); erreurReglages('');
    $('aidant-actuel').hidden = !a; $('aidant-retirer').hidden = !a;
    if (a) { $('aidant-actuel-nom').textContent = a.nom; $('aidant-actuel-tel').textContent = a.tel; $('aidant-nom').value = a.nom; $('aidant-tel').value = a.tel; }
    vue('reglages', true);
  }
  function enregistrer(nom, tel) {
    try { localStorage.setItem('vigie.aidant', JSON.stringify({ nom: (nom || '').trim() || 'mon contact', tel: tel.trim() })); } catch (x) {}
    majAidant(); history.back();
  }
  $('ouvrir-reglages').addEventListener('click', ouvrirReglages);
  $('aidant-contacts').addEventListener('click', function () {
    erreurReglages('');
    var P = window.Capacitor && Capacitor.registerPlugin ? Capacitor.registerPlugin('SelecteurContact') : null;
    var choix = P ? P.choisir() : (navigator.contacts && navigator.contacts.select
      ? navigator.contacts.select(['name', 'tel'], { multiple: false }).then(function (r) { return { nom: r[0] && r[0].name && r[0].name[0], tel: r[0] && r[0].tel && r[0].tel[0] }; })
      : Promise.reject(new Error('indisponible')));
    choix.then(function (c) {
      if (c && c.tel) enregistrer(c.nom, c.tel); else erreurReglages("Ce contact n'a pas de numéro de téléphone. Choisissez-en un autre.");
    }).catch(function (e) {
      if (e && /annul|cancel/i.test(e.message || '')) return;
      erreurReglages("Impossible d'ouvrir vos contacts. Saisissez le numéro à la main, juste en dessous.");
      document.querySelector('details.saisie').open = true;
    });
  });
  $('form-reglages').addEventListener('submit', function (e) {
    e.preventDefault();
    var tel = $('aidant-tel').value.trim();
    if (!/^\+?[\d\s().-]{6,20}$/.test(tel)) { erreurReglages('Ce numéro ne semble pas valide.'); $('aidant-tel').focus(); return; }
    enregistrer($('aidant-nom').value, tel);
  });
  $('aidant-retirer').addEventListener('click', function () {
    try { localStorage.removeItem('vigie.aidant'); } catch (x) {}
    majAidant(); history.back();
  });

  /* ---------- Démarrage ---------- */
  fetch('regles.json').then(function (r) { return r.json(); }).then(function (j) {
    R = j; analyser = VigieRegles.creerAnalyseur(R);
  }).catch(function () { erreur("Impossible de charger les règles de Vigie. Réinstallez l'application."); });
  majAidant();
  history.replaceState({ v: 'accueil' }, '', '#accueil');
  window.__vigie = { afficher: afficher, lirePhoto: lirePhoto, preparer: preparer };   // pour les tests automatiques
})();
