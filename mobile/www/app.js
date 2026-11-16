/* Vigie — application Android autonome. Pixel's ASBL, Boussu — GPL-3.0
 * Tout se passe sur le téléphone : lecture de la photo (Tesseract.js, embarqué), analyse (regles.js), voix. */
(function () {
  'use strict';
  const VERSION = '0.2.0';
  const $ = (id) => document.getElementById(id);
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const chiffres = (t) => String(t || '').replace(/[^+\d]/g, '');
  const lire = (cle, defaut) => { try { const v = JSON.parse(localStorage.getItem(cle)); return v == null ? defaut : v; } catch (e) { return defaut; } };
  const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* stockage plein ou refusé : on continue */ } };

  let R = null, analyser = null, travailleur = null, dernier = null, annule = false;

  /* ================= Préférences ================= */
  const PREFS_DEFAUT = { taille: 'normal', theme: 'auto', voix: false, historique: true };
  let prefs = Object.assign({}, PREFS_DEFAUT, lire('vigie.prefs', {}));

  function appliquerPrefs() {
    const h = document.documentElement;
    h.dataset.taille = prefs.taille;
    if (prefs.theme === 'auto') delete h.dataset.theme; else h.dataset.theme = prefs.theme;
    // Les logos suivent le thème choisi (et pas seulement celui du téléphone)
    document.querySelectorAll('picture source').forEach((s) => {
      s.media = prefs.theme === 'sombre' ? 'all' : prefs.theme === 'clair' ? 'not all' : '(prefers-color-scheme: dark)';
    });
    document.querySelectorAll('button[data-taille]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.taille === prefs.taille)));
    document.querySelectorAll('button[data-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === prefs.theme)));
    $('reg-voix').checked = !!prefs.voix;
    $('reg-histo').checked = !!prefs.historique;
  }
  function majPref(cle, valeur) { prefs[cle] = valeur; ecrire('vigie.prefs', prefs); appliquerPrefs(); }

  /* ================= Personne de confiance (choisie par l'utilisateur, jamais préréglée) ================= */
  const aidant = () => { const a = lire('vigie.aidant', null); return a && a.tel ? a : null; };
  function majAidant() {
    const a = aidant(), h = $('aide-haut');
    h.hidden = !a || vueCourante === 'scan' || vueCourante === 'bienvenue';
    if (a) { h.href = 'tel:' + chiffres(a.tel); h.lastChild.textContent = 'Appeler ' + a.nom; }
    $('reg-aidant').textContent = a ? a.nom + ' · ' + a.tel : 'Aucune personne choisie';
    $('reg-aidant-btn').lastChild.textContent = a ? 'Modifier' : 'Choisir';
  }

  /* ================= Navigation ================= */
  const ONGLET = { accueil: 'accueil', scan: 'accueil', resultat: 'accueil', historique: 'historique', aide: 'aide',
    reglages: 'reglages', confiance: 'reglages', apropos: 'reglages', bienvenue: '' };
  let vueCourante = 'accueil';

  function vue(nom, empiler) {
    vueCourante = nom;
    document.querySelectorAll('.vue').forEach((s) => s.classList.toggle('active', s.id === 'vue-' + nom));
    document.querySelectorAll('#tabbar button').forEach((b) => {
      if (b.dataset.vue === ONGLET[nom]) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    document.body.classList.toggle('sans-onglets', nom === 'scan' || nom === 'bienvenue');
    if (nom === 'historique') rendreHistorique();
    if (nom === 'reglages') majAidant();
    majAidant();
    if (empiler) history.pushState({ v: nom }, '', '#' + nom);
    window.scrollTo(0, 0);
  }
  window.addEventListener('popstate', (e) => {
    let n = (e.state && e.state.v) || 'accueil';
    if (n === 'scan' || n === 'bienvenue') n = 'accueil';
    if (n === 'resultat' && dernier && analyser) afficher(dernier.t, dernier.p, false, false); else vue(n, false);
  });
  document.querySelectorAll('#tabbar button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.vue === 'accueil' && dernier === null) { vue('accueil', true); return; }
    vue(b.dataset.vue, true);
  }));
  $('marque').addEventListener('click', (e) => { e.preventDefault(); vue('accueil', true); });

  const erreur = (m) => { $('erreur').hidden = !m; $('erreur-texte').textContent = m || ''; };

  /* ================= Préparation de la photo (même logique que sur PC) ================= */
  async function preparer(fichier) {
    const bmp = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    const cote = Math.max(bmp.width, bmp.height);
    const k = cote < 1600 ? 1600 / cote : (cote > 2200 ? 2200 / cote : 1);
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    const im = g.getImageData(0, 0, c.width, c.height), d = im.data, n = d.length / 4;
    let h = new Uint32Array(256), somme = 0, i;
    for (i = 0; i < d.length; i += 4) {
      const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = y; h[y]++; somme += y;
    }
    const inverser = (somme / n) < 110;                 // écran sombre, texte clair
    if (inverser) { const h2 = new Uint32Array(256); for (i = 0; i < 256; i++) h2[255 - i] = h[i]; h = h2; }
    const coupe = n * 0.001; let bas = 0, haut = 255, acc = 0;   // étirement du contraste (0,1 % de chaque côté)
    for (i = 0; i < 256; i++) { acc += h[i]; if (acc > coupe) { bas = i; break; } }
    acc = 0; for (i = 255; i >= 0; i--) { acc += h[i]; if (acc > coupe) { haut = i; break; } }
    if (haut - bas < 64) { bas = 0; haut = 255; }         // texte très rare : on n'étire pas, pour ne rien perdre
    const ech = 255 / (haut - bas);
    for (i = 0; i < d.length; i += 4) {
      let v = inverser ? 255 - d[i] : d[i];
      v = Math.max(0, Math.min(255, Math.round((v - bas) * ech)));
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('toBlob'))), 'image/png'));
  }

  /* ================= Lecture (OCR) hors ligne ================= */
  const simd = () => {
    try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; }
  };
  function creerTravailleur() {
    if (travailleur) return travailleur;
    const base = new URL('ocr/', location.href).href;
    travailleur = Tesseract.createWorker('fra', 1, {
      workerPath: base + 'worker.min.js',
      corePath: base + (simd() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'),
      langPath: base, gzip: true, cacheMethod: 'none', workerBlobURL: false,
      logger: (m) => {
        if (m.status === 'recognizing text') cible = Math.max(cible, 28 + Math.round(m.progress * 60));
        else if (m.status && /load|init/.test(m.status)) cible = Math.max(cible, 14 + Math.round((m.progress || 0) * 14));
      }
    });
    travailleur.catch(() => { travailleur = null; });
    return travailleur;
  }

  /* ================= Écran de scan : gros pourcentage, faisceau, étapes ================= */
  let cible = 0, aff = 0, raf = 0;
  const attendre = async (p) => { while (!annule && aff < p - 0.5) await pause(40); };

  function boucleScan() {
    aff += (cible - aff) * 0.09;
    if (Math.abs(cible - aff) < 0.4) aff = cible;
    $('scan-pct').textContent = Math.round(aff);
    $('barre-int').style.width = aff + '%';
    $('barre').setAttribute('aria-valuenow', Math.round(aff));
    raf = requestAnimationFrame(boucleScan);
  }
  function etape(i, libelle) {
    document.querySelectorAll('#scan-etapes li').forEach((li, k) => { li.className = k < i ? 'fait' : k === i ? 'actif' : ''; });
    if (libelle) $('scan-statut').textContent = libelle;
  }
  function demarrerScan(photoURL, texte) {
    annule = false; cible = 0; aff = 0; erreur('');
    $('scan-photo').hidden = !photoURL;
    if (photoURL) $('scan-photo').src = photoURL;
    $('scan-texte').hidden = !!photoURL;
    if (!photoURL) $('scan-texte').textContent = texte.slice(0, 280);
    $('scan-surtitre').textContent = photoURL ? 'Analyse de la photo' : 'Analyse du message';
    $('etape-0-txt').textContent = photoURL ? 'Photo préparée' : 'Message reçu';
    etape(0, photoURL ? 'Préparation de la photo…' : 'Message reçu…');
    cancelAnimationFrame(raf); boucleScan();
    vue('scan', true);
  }
  function finScan() { cancelAnimationFrame(raf); }
  $('scan-annuler').addEventListener('click', () => { annule = true; finScan(); reinitialiser(); vue('accueil', false); history.replaceState({ v: 'accueil' }, '', '#accueil'); });

  async function conclure(texte, photo) {
    etape(2, "Recherche d'indices connus…"); cible = 90; await attendre(88); if (annule) return;
    await pause(450); if (annule) return;
    etape(3, 'Verdict'); cible = 100; await attendre(99.5); if (annule) return;
    await pause(500); if (annule) return;
    finScan(); afficher(texte, photo, true, true);
  }

  async function analyserPhoto(fichier) {
    const url = URL.createObjectURL(fichier);
    demarrerScan(url);
    try {
      cible = 7;
      const png = await preparer(fichier); if (annule) return;
      cible = 14; etape(1, 'Lecture du texte…');
      const w = await creerTravailleur();
      const r = await w.recognize(png); if (annule) return;
      const texte = (r.data.text || '').trim();
      if (texte.replace(/\s/g, '').length < 12) {
        finScan(); vue('accueil', false); history.replaceState({ v: 'accueil' }, '', '#accueil');
        erreur("Vigie n'a pas pu lire de texte sur cette photo. Reprenez-la plus près, bien droite et bien éclairée, ou collez le texte.");
        return;
      }
      $('texte').value = texte;
      await conclure(texte, true);
    } catch (e) {
      finScan(); vue('accueil', false); history.replaceState({ v: 'accueil' }, '', '#accueil');
      erreur('La lecture de la photo a échoué. Réessayez, ou collez le texte du message.');
    } finally { URL.revokeObjectURL(url); reinitialiser(); }
  }

  async function analyserTexte(texte) {
    demarrerScan(null, texte);
    cible = 24; await attendre(22); if (annule) return;
    etape(1, 'Lecture du texte…'); cible = 55; await attendre(52); if (annule) return;
    await conclure(texte, false);
  }

  /* ================= Historique (local, facultatif) ================= */
  const CLE_H = 'vigie.historique';
  const LIBELLE = { rouge: 'Arnaque probable', orange: 'Prudence', vert: 'Aucun signe connu' };
  const histo = () => lire(CLE_H, []);
  function ajouterHisto(texte, photo, verdict) {
    if (!prefs.historique) return;
    const l = histo(); l.unshift({ id: Date.now(), v: verdict, p: !!photo, t: texte.slice(0, 4000) });
    ecrire(CLE_H, l.slice(0, 50));
  }
  function rendreHistorique() {
    const l = histo(), zone = $('histo-liste');
    $('histo-effacer').hidden = l.length === 0;
    $('histo-intro').textContent = l.length ? 'Les messages déjà vérifiés. Touchez-en un pour revoir le résultat.'
      : (prefs.historique ? "Rien pour l'instant. Les messages que vous vérifiez apparaîtront ici, sur ce téléphone seulement."
        : "L'historique est désactivé. Vous pouvez l'activer dans les réglages.");
    zone.innerHTML = l.map((e) => {
      const d = new Date(e.id).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const extrait = e.t.replace(/\s+/g, ' ').slice(0, 90);
      return '<button class="h-item ' + e.v + '" type="button" data-id="' + e.id + '"><span class="h-tete"><b>' + LIBELLE[e.v] + '</b><span>' + esc(d) + (e.p ? ' · photo' : '') +
        '</span></span><span class="h-texte">' + esc(extrait) + '</span></button>';
    }).join('');
  }
  $('histo-liste').addEventListener('click', (ev) => {
    const b = ev.target.closest('.h-item'); if (!b) return;
    const e = histo().find((x) => String(x.id) === b.dataset.id);
    if (e && analyser) afficher(e.t, e.p, true, false);
  });
  let confirmerEffacement = 0;
  $('histo-effacer').addEventListener('click', () => {
    const lib = $('histo-effacer').lastChild;
    if (!confirmerEffacement) { confirmerEffacement = 1; lib.textContent = "Confirmer l'effacement"; setTimeout(() => { confirmerEffacement = 0; lib.textContent = "Effacer l'historique"; }, 4000); return; }
    confirmerEffacement = 0; lib.textContent = "Effacer l'historique"; ecrire(CLE_H, []); rendreHistorique();
  });

  /* ================= Résultat ================= */
  const TITRES = {
    rouge: ['Arnaque probable', 'Ne faites rien avec ce message', 'Ce message ressemble fortement à une arnaque. Ne cliquez pas, ne répondez pas.', 'danger', 'Élevé', 3],
    orange: ['Prudence', "Vérifiez avant d'agir", "Certains indices sont inquiétants. Ne cliquez pas sur le lien tant que vous n'avez pas vérifié.", 'attention', 'Moyen', 2],
    vert: ['Aucun signe connu', 'Pas de piège détecté', "Vigie n'a trouvé aucun indice d'arnaque. Ce n'est pas une garantie : restez attentif.", 'ok', 'Faible', 1]
  };
  function afficher(texte, depuisPhoto, empiler, enregistrer) {
    const r = analyser(texte), t = TITRES[r.verdict], c = R.conseils[r.verdict], a = aidant();
    dernier = { t: texte, p: depuisPhoto };
    if (enregistrer) ajouterHisto(texte, depuisPhoto, r.verdict);
    let h = '<section class="verdict ' + r.verdict + '" id="reponse" aria-live="polite"><div class="verdict-tete"><svg aria-hidden="true"><use href="#i-' + t[3] + '"/></svg><div>' +
      '<div class="verdict-etiquette">' + t[0] + '</div><h1>' + t[1] + '</h1></div></div><p>' + t[2] + '</p>' +
      '<div class="niveau" role="img" aria-label="Niveau de risque : ' + t[4] + '"><span class="niveau-lib">Niveau de risque : <b>' + t[4] + '</b></span>' +
      '<span class="niveau-barre n' + t[5] + '"><i></i><i></i><i></i></span></div></section>';
    if (r.verdict !== 'vert') h += '<div class="actions">' + (a
      ? '<a class="btn btn-appel" href="tel:' + esc(chiffres(a.tel)) + '"><svg aria-hidden="true"><use href="#i-tel"/></svg>Appeler ' + esc(a.nom) + '</a>'
      : '<button class="btn btn-camera" type="button" id="choisir-aidant"><svg aria-hidden="true"><use href="#i-tel"/></svg>Choisir ma personne de confiance</button>') + '</div>';
    h += '<section class="carte"><h2>Que faire maintenant ?</h2><ol class="etapes">' + c.slice(0, 3).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>';
    if (c.length > 3) h += '<div class="encadre">' + c.slice(3).map((x) => '<p>' + esc(x) + '</p>').join('') + '</div>';
    h += '</section>';
    if (r.raisons.length) h += '<details' + (r.verdict !== 'vert' ? ' open' : '') + '><summary>Pourquoi Vigie pense cela</summary><div class="details-corps"><ul>' +
      r.raisons.slice(0, 3).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div></details>';
    h += '<details><summary>' + (depuisPhoto ? 'Texte lu sur la photo' : 'Voir le message analysé') + '</summary><div class="details-corps"><p class="message-brut">' + esc(texte) + '</p>' +
      (depuisPhoto ? '<p class="note">Si le texte est faux, reprenez la photo plus près, bien droite et bien éclairée.</p>' : '') + '</div></details>';
    h += '<div class="actions-duo"><button class="btn btn-secondaire" type="button" id="ecouter"><svg aria-hidden="true"><use href="#i-son"/></svg>Écouter</button>' +
      '<button class="btn btn-secondaire" type="button" id="autre"><svg aria-hidden="true"><use href="#i-retour"/></svg>Autre message</button></div>';
    const corps = encodeURIComponent(texte.slice(0, 1500));
    h += '<div class="actions-duo" style="margin-top:12px">' +
      (r.verdict !== 'vert' ? '<a class="btn btn-secondaire" href="mailto:suspect@safeonweb.be?subject=' + encodeURIComponent('Message suspect') + '&body=' + corps + '"><svg aria-hidden="true"><use href="#i-mail"/></svg>Signaler à Safeonweb</a>' : '') +
      (navigator.share ? '<button class="btn btn-secondaire" type="button" id="partager"><svg aria-hidden="true"><use href="#i-partager"/></svg>Partager</button>' : '') + '</div>';
    $('vue-resultat').innerHTML = h;
    $('ecouter').onclick = () => parler($('reponse').innerText + '. ' + document.querySelector('ol.etapes').innerText);
    $('autre').onclick = () => { $('texte').value = ''; reinitialiser(); vue('accueil', true); };
    if ($('choisir-aidant')) $('choisir-aidant').onclick = () => ouvrirConfiance();
    if ($('partager')) $('partager').onclick = () => navigator.share({ title: 'Message vérifié avec Vigie', text: 'Vigie : ' + t[0] + '\n\n' + texte.slice(0, 1500) }).catch(() => {});
    vue('resultat', empiler !== false);
    if (enregistrer && prefs.voix) parler(t[0] + '. ' + t[1] + '. ' + c.slice(0, 3).join(' '));
  }

  /* ================= Voix ================= */
  function parler(texte) {
    const P = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.TextToSpeech;
    if (P && P.speak) { P.stop().catch(() => {}); P.speak({ text: texte, lang: 'fr-BE', rate: 0.9 }).catch(() => synthese(texte)); } else synthese(texte);
  }
  function synthese(texte) {
    try { const u = new SpeechSynthesisUtterance(texte); u.lang = 'fr-BE'; u.rate = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* pas de voix disponible */ }
  }

  /* ================= Formulaire ================= */
  function reinitialiser() { $('camera').value = ''; $('galerie').value = ''; }
  ['camera', 'galerie'].forEach((id) => $(id).addEventListener('change', function () {
    const f = this.files && this.files[0]; if (f && analyser) analyserPhoto(f);
  }));
  $('coller').addEventListener('click', () => {
    const t = $('texte');
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then((x) => { if (x) t.value = x; t.focus(); }).catch(() => t.focus());
    else t.focus();
  });
  $('formulaire').addEventListener('submit', (e) => {
    e.preventDefault();
    const texte = $('texte').value.trim();
    if (!texte) { erreur('Collez d’abord le message, ou prenez-le en photo.'); $('texte').focus(); return; }
    if (analyser) analyserTexte(texte);
  });

  /* ================= Personne de confiance : choix ================= */
  const erreurReglages = (m) => { $('erreur-reglages').hidden = !m; $('erreur-reglages-texte').textContent = m || ''; };
  function ouvrirConfiance() {
    const a = aidant(); erreurReglages('');
    $('aidant-actuel').hidden = !a; $('aidant-retirer').hidden = !a;
    if (a) { $('aidant-actuel-nom').textContent = a.nom; $('aidant-actuel-tel').textContent = a.tel; $('aidant-nom').value = a.nom; $('aidant-tel').value = a.tel; }
    vue('confiance', true);
  }
  function enregistrer(nom, tel) {
    ecrire('vigie.aidant', { nom: (nom || '').trim() || 'mon contact', tel: tel.trim() });
    majAidant(); history.back();
  }
  $('reg-aidant-btn').addEventListener('click', ouvrirConfiance);
  $('aidant-contacts').addEventListener('click', () => {
    erreurReglages('');
    const P = window.Capacitor && Capacitor.registerPlugin ? Capacitor.registerPlugin('SelecteurContact') : null;
    const choix = P ? P.choisir() : (navigator.contacts && navigator.contacts.select
      ? navigator.contacts.select(['name', 'tel'], { multiple: false }).then((r) => ({ nom: r[0] && r[0].name && r[0].name[0], tel: r[0] && r[0].tel && r[0].tel[0] }))
      : Promise.reject(new Error('indisponible')));
    choix.then((c) => {
      if (c && c.tel) enregistrer(c.nom, c.tel); else erreurReglages("Ce contact n'a pas de numéro de téléphone. Choisissez-en un autre.");
    }).catch((e) => {
      if (e && /annul|cancel/i.test(e.message || '')) return;
      erreurReglages("Impossible d'ouvrir vos contacts. Saisissez le numéro à la main, juste en dessous.");
      document.querySelector('details.saisie').open = true;
    });
  });
  $('form-reglages').addEventListener('submit', (e) => {
    e.preventDefault();
    const tel = $('aidant-tel').value.trim();
    if (!/^\+?[\d\s().-]{6,20}$/.test(tel)) { erreurReglages('Ce numéro ne semble pas valide.'); $('aidant-tel').focus(); return; }
    enregistrer($('aidant-nom').value, tel);
  });
  $('aidant-retirer').addEventListener('click', () => {
    try { localStorage.removeItem('vigie.aidant'); } catch (x) { /* rien */ }
    majAidant(); history.back();
  });

  /* ================= Réglages d'affichage, voix, à propos ================= */
  document.querySelectorAll('button[data-taille]').forEach((b) => b.addEventListener('click', () => majPref('taille', b.dataset.taille)));
  document.querySelectorAll('button[data-theme]').forEach((b) => b.addEventListener('click', () => majPref('theme', b.dataset.theme)));
  $('reg-voix').addEventListener('change', (e) => majPref('voix', e.target.checked));
  $('reg-histo').addEventListener('change', (e) => majPref('historique', e.target.checked));
  $('ouvrir-apropos').addEventListener('click', () => vue('apropos', true));
  $('version').textContent = VERSION;

  /* ================= Bienvenue (une seule fois) ================= */
  let pas = 0;
  function pasBienvenue() {
    document.querySelectorAll('.bv-panneau').forEach((p) => p.classList.toggle('actif', Number(p.dataset.n) === pas));
    document.querySelectorAll('.bv-points i').forEach((p, k) => p.classList.toggle('actif', k === pas));
    $('bv-suivant').textContent = pas === 2 ? 'Choisir maintenant' : 'Suivant';
    $('bv-plus-tard').hidden = pas !== 2;
  }
  function finBienvenue(versConfiance) {
    ecrire('vigie.bienvenue', 1);
    vue('accueil', false); history.replaceState({ v: 'accueil' }, '', '#accueil');
    if (versConfiance) ouvrirConfiance();
  }
  $('bv-suivant').addEventListener('click', () => { if (pas < 2) { pas++; pasBienvenue(); } else finBienvenue(true); });
  $('bv-plus-tard').addEventListener('click', () => finBienvenue(false));

  /* ================= Démarrage ================= */
  fetch('regles.json').then((r) => r.json()).then((j) => { R = j; analyser = VigieRegles.creerAnalyseur(R); })
    .catch(() => erreur("Impossible de charger les règles de Vigie. Réinstallez l'application."));
  appliquerPrefs(); majAidant();
  history.replaceState({ v: 'accueil' }, '', '#accueil');
  if (!lire('vigie.bienvenue', 0)) { vue('bienvenue', false); pasBienvenue(); } else vue('accueil', false);
  window.__vigie = { afficher, preparer, analyserTexte, analyserPhoto };   // pour les tests automatiques
})();
