/* Vigie — application Android autonome. GPL-3.0
 * Tout se passe sur le téléphone : lecture de la photo (Tesseract.js, embarqué), analyse (regles.js), voix. */
(function () {
  'use strict';
  const VERSION = '0.3.1';
  const $ = (id) => document.getElementById(id);
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const lire = (cle, defaut) => { try { const v = JSON.parse(localStorage.getItem(cle)); return v == null ? defaut : v; } catch (e) { return defaut; } };
  const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* stockage plein ou refusé : on continue */ } };

  let R = null, analyser = null, travailleur = null, dernier = null, annule = false, photoEnCours = true;

  /* ================= Préférences ================= */
  const LANGUES = ['fr', 'nl', 'it', 'de'];
  const PARLE = { fr: 'fr-BE', nl: 'nl-BE', it: 'it-IT', de: 'de-DE' };
  const DATE = { fr: 'fr-BE', nl: 'nl-BE', it: 'it-IT', de: 'de-DE' };
  const detecter = () => { const l = String(navigator.language || 'fr').slice(0, 2).toLowerCase(); return LANGUES.indexOf(l) >= 0 ? l : 'fr'; };
  const PREFS_DEFAUT = { taille: 'normal', theme: 'auto', voix: false, historique: true, langue: detecter() };
  let prefs = Object.assign({}, PREFS_DEFAUT, lire('vigie.prefs', {}));

  const DICO = window.VIGIE_I18N || {};
  const t = (cle, p) => {
    let x = (DICO[prefs.langue] && DICO[prefs.langue][cle]) || (DICO.fr && DICO.fr[cle]) || cle;
    if (p) Object.keys(p).forEach((k) => { x = x.split('{' + k + '}').join(p[k]); });
    return x;
  };
  function traduirePage() {
    document.documentElement.lang = prefs.langue;
    document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((e) => { e.innerHTML = t(e.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-ph]').forEach((e) => { e.placeholder = t(e.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-aria]').forEach((e) => { e.setAttribute('aria-label', t(e.dataset.i18nAria)); });
    $('version-ligne').textContent = t('p.version', { v: VERSION });
    document.querySelectorAll('button[data-langue]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.langue === prefs.langue)));
    if (!$('histo-effacer-txt').dataset.attente) $('histo-effacer-txt').textContent = t('h.effacer');
    $('etape-0-txt').textContent = t(photoEnCours ? 's.e0.photo' : 's.e0.msg');
    if (typeof pasBienvenue === 'function' && typeof piste !== 'undefined') pasBienvenue();   // le bouton du carrousel suit la langue
  }
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
    traduirePage();
  }
  function majPref(cle, valeur) {
    prefs[cle] = valeur; ecrire('vigie.prefs', prefs); appliquerPrefs();
    if (cle === 'langue') { if (vueCourante === 'resultat' && dernier && analyser) afficher(dernier.t, dernier.p, false, false); if (vueCourante === 'historique') rendreHistorique(); }
  }

  /* ================= Navigation ================= */
  const ONGLET = { accueil: 'accueil', scan: 'accueil', resultat: 'accueil', historique: 'historique', aide: 'aide',
    reglages: 'reglages', apropos: 'reglages', bienvenue: '' };
  let vueCourante = 'accueil';

  function vue(nom, empiler) {
    vueCourante = nom;
    document.querySelectorAll('.vue').forEach((s) => s.classList.toggle('active', s.id === 'vue-' + nom));
    document.querySelectorAll('#tabbar button').forEach((b) => {
      if (b.dataset.vue === ONGLET[nom]) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    document.body.classList.toggle('sans-onglets', nom === 'scan' || nom === 'bienvenue');
    if (nom === 'historique') rendreHistorique();
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

  /* ================= Préparation de la photo ================= */
  // Redresse la photo (EXIF), passe en niveaux de gris, étire le contraste, inverse les écrans sombres,
  // puis découpe en bandes (aux lignes vides) pour lire plusieurs bandes en parallèle.
  function nbBandes(w, h) {
    const pix = w * h, coeurs = navigator.hardwareConcurrency || 4, ram = navigator.deviceMemory || 4;
    if (pix < 500000 || coeurs < 2) return 1;
    return Math.max(1, Math.min(4, coeurs - 1, pix > 1500000 ? 4 : 2));   // tous les cœurs disponibles, sans plafond artificiel
  }
  async function preparer(fichier, max) {
    max = max || 2600;
    const bmp = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    const cote = Math.max(bmp.width, bmp.height);
    let k = cote < 1600 ? 1600 / cote : (cote > max ? max / cote : 1);
    if (bmp.width * bmp.height * k * k > 4.2e6) k = Math.sqrt(4.2e6 / (bmp.width * bmp.height));   // photo géante : on borne le travail
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    const W = c.width, H = c.height;
    const im = g.getImageData(0, 0, W, H), d = im.data, n = d.length / 4;
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
    const s1 = new Float64Array(H), s2 = new Float64Array(H);
    let sombre = 0, clair = 0;
    for (let y = 0; y < H; y++) {
      let a = 0, b = 0;
      for (let x = 0, p = y * W * 4; x < W; x++, p += 4) {
        let v = inverser ? 255 - d[p] : d[p];
        v = Math.max(0, Math.min(255, Math.round((v - bas) * ech)));
        d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255;
        a += v; b += v * v; if (v < 80) sombre++; else if (v > 175) clair++;
      }
      s1[y] = a; s2[y] = b;
    }
    g.putImageData(im, 0, 0);
    // Polarité mixte (bulles claires et sombres) : Tesseract doit lire aussi l'image inversée. Sinon on économise cette passe.
    const mixte = (sombre / n) > 0.12 && (clair / n) > 0.12;
    // Coupures : on choisit, près de chaque tiers, la ligne la plus uniforme (un interligne), pour ne jamais couper un mot.
    const nb = nbBandes(W, H), coupures = [0];
    for (let q = 1; q < nb; q++) {
      const cibleY = Math.round(H * q / nb), fen = Math.round(H * 0.1);
      let meilleur = cibleY, vmin = Infinity;
      for (let y = Math.max(coupures[q - 1] + 50, cibleY - fen); y < Math.min(H - 50, cibleY + fen); y++) {
        const moy = s1[y] / W, vari = s2[y] / W - moy * moy;
        if (vari < vmin - 1e-6) { vmin = vari; meilleur = y; }
      }
      coupures.push(meilleur);
    }
    coupures.push(H);
    const bandes = [];
    for (let q = 0; q < nb; q++) {
      const y0 = coupures[q], hh = coupures[q + 1] - y0, cb = document.createElement('canvas');
      cb.width = W; cb.height = hh;
      cb.getContext('2d').drawImage(c, 0, y0, W, hh, 0, 0, W, hh);
      bandes.push(await new Promise((ok, ko) => cb.toBlob((b) => (b ? ok(b) : ko(new Error('toBlob'))), 'image/png')));
    }
    return { bandes, mixte };
  }

  /* ================= Lecture (OCR) hors ligne, en parallèle ================= */
  const simd = () => {
    try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; }
  };
  let pool = [], initp = [], prog = [], phase = 0, nPhases = 1, minuteurLiberation = 0;
  function majCible() {
    const n = Math.max(1, pool.length);
    let ini = 0, rec = 0;
    for (let i = 0; i < n; i++) { ini += initp[i] || 0; rec += prog[i] || 0; }
    ini /= n; rec /= n;
    const total = Math.min(0.97, (phase + rec) / nPhases);
    cible = Math.max(cible, 14 + ini * 14, total > 0 ? 28 + total * 58 : 0);
  }
  function creerTravailleur(i) {
    const base = new URL('ocr/', location.href).href;
    return Tesseract.createWorker('fra', 1, {
      workerPath: base + 'worker.min.js',
      corePath: base + (simd() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'),
      langPath: base, gzip: true, cacheMethod: 'none', workerBlobURL: false,
      logger: (m) => {
        if (m.status === 'recognizing text') { prog[i] = m.progress; majCible(); }
        else if (m.status && /load|init/.test(m.status)) { initp[i] = Math.max(initp[i] || 0, m.progress || 0); majCible(); }
      }
    });
  }
  function obtenirTravailleurs(n) {
    clearTimeout(minuteurLiberation);
    while (pool.length < n) { const i = pool.length, p = creerTravailleur(i); p.catch(() => { if (pool[i] === p) pool = []; }); pool.push(p); }
    return Promise.all(pool.slice(0, n));
  }
  function libererTravailleurs() {
    clearTimeout(minuteurLiberation);
    pool.forEach((p) => p.then((w) => w.terminate()).catch(() => {}));
    pool = []; initp = []; prog = []; phase = 0; nPhases = 1;
  }
  const planifierLiberation = () => { clearTimeout(minuteurLiberation); minuteurLiberation = setTimeout(libererTravailleurs, 60000); };   // rend la mémoire au téléphone
  const delaiMax = (ms) => { let t; const p = new Promise((_, ko) => { t = setTimeout(() => ko(new Error('delai')), ms); }); p.stop = () => clearTimeout(t); return p; };
  async function inverserImage(blob) {
    const bmp = await createImageBitmap(blob), c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    g.globalCompositeOperation = 'difference'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('toBlob'))), 'image/png'));
  }
  const lireBandes = (ws, images) => Promise.all(ws.map(async (w, i) => (await w.recognize(images[i])).data.text || ''));

  async function lireImages(bandes, mixte) {
    const ws = await obtenirTravailleurs(bandes.length);
    if (annule) return '';
    etape(1, t('s.st.lecture'));
    prog = []; phase = 0; nPhases = mixte ? 2 : 1;
    const dur = delaiMax(150000);
    try {
      await Promise.all(ws.map((w) => w.setParameters({ tessedit_do_invert: '0' })));
      // Passe 1 : lecture normale. Elle suffit presque toujours et donne déjà un texte exploitable.
      let texte = (await Promise.race([dur, lireBandes(ws, bandes)])).join('\n');
      if (mixte && !annule) {
        // Passe 2 (bulles de couleurs opposées) : lue sur l'image inversée, avec un délai. Trop lente, on garde la passe 1.
        phase = 1; prog = [];
        $('scan-statut').textContent = t('s.st.lecture');
        const inv = await Promise.all(bandes.map(inverserImage));
        const court = delaiMax(35000);
        try {
          const t2 = (await Promise.race([court, dur, lireBandes(ws, inv)])).join('\n');
          texte += '\n' + t2;
        } catch (e) {
          if (!e || e.message !== 'delai' || texte.replace(/\s/g, '').length < 12) throw e;
          libererTravailleurs();                      // la 2e passe s'éternise : on arrête et on garde la 1re
        } finally { court.stop(); }
      }
      cible = Math.max(cible, 86);
      if (pool.length) planifierLiberation();
      return texte;
    } catch (e) { libererTravailleurs(); throw e; } finally { dur.stop(); }
  }

  /* ================= Écran de scan : gros pourcentage, faisceau, étapes ================= */
  let cible = 0, aff = 0, raf = 0, rapide = false;
  const attendre = async (p) => { while (!annule && aff < p - 0.5) await pause(16); };

  function boucleScan() {
    aff += (cible - aff) * (rapide ? 0.5 : 0.15);
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
    annule = false; cible = 0; aff = 0; rapide = !photoURL; erreur('');
    $('scan-photo').hidden = !photoURL;
    if (photoURL) $('scan-photo').src = photoURL;
    $('scan-texte').hidden = !!photoURL;
    if (!photoURL) $('scan-texte').textContent = texte.slice(0, 280);
    photoEnCours = !!photoURL;
    $('scan-surtitre').textContent = t(photoURL ? 's.surtitre.photo' : 's.surtitre.msg');
    $('etape-0-txt').textContent = t(photoURL ? 's.e0.photo' : 's.e0.msg');
    etape(0, t(photoURL ? 's.st.prep' : 's.st.recu'));
    cancelAnimationFrame(raf); boucleScan();
    vue('scan', true);
  }
  function finScan() { cancelAnimationFrame(raf); }
  $('scan-annuler').addEventListener('click', () => { annule = true; finScan(); reinitialiser(); vue('accueil', false); history.replaceState({ v: 'accueil' }, '', '#accueil'); });

  async function conclure(texte, photo) {
    etape(2, t('s.st.indices')); cible = 90; await attendre(88); if (annule) return;
    await pause(rapide ? 0 : 200); if (annule) return;
    etape(3, t('s.e3')); cible = 100; await attendre(99.5); if (annule) return;
    await pause(rapide ? 60 : 200); if (annule) return;
    finScan(); afficher(texte, photo, true, true);
  }

  /* Lecture native Android (ML Kit, embarquée) : quasi instantanée. Sinon on retombe sur Tesseract. */
  const natif = () => { try { return window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() ? Capacitor.registerPlugin('LectureTexte') : null; } catch (e) { return null; } };
  async function lireNatif(fichier, plugin) {
    const bmp = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    const k = Math.min(1, 2200 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
    const blob = await new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('toBlob'))), 'image/jpeg', 0.92));
    const data = await new Promise((ok, ko) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1]); f.onerror = ko; f.readAsDataURL(blob); });
    cible = 40;
    return (await plugin.lire({ data })).texte || '';
  }

  async function analyserPhoto(fichier) {
    const url = URL.createObjectURL(fichier);
    demarrerScan(url);
    // le pourcentage ne reste jamais figé : il avance doucement entre deux vrais signaux du moteur de lecture
    const creep = setInterval(() => { if (cible >= 14 && cible < 86) cible += (86 - cible) * 0.014; }, 250);
    const patience = setTimeout(() => { $('scan-statut').textContent = t('s.st.long'); }, 12000);
    try {
      cible = 6;
      const N = natif();
      let texte = null;
      if (N) { try { rapide = true; texte = (await lireNatif(fichier, N)).trim(); cible = 88; } catch (e) { texte = null; rapide = false; } }
      if (annule) return;
      if (texte === null) {
        const { bandes, mixte } = await preparer(fichier); if (annule) return;
        cible = 14;
        texte = (await lireImages(bandes, mixte) || '').trim(); if (annule) return;
      }
      if (texte.replace(/\s/g, '').length < 12) {
        finScan(); vue('accueil', false); history.replaceState({ v: 'accueil' }, '', '#accueil');
        erreur(t('err.illisible'));
        return;
      }
      $('texte').value = texte;
      await conclure(texte, true);
    } catch (e) {
      finScan(); vue('accueil', false); history.replaceState({ v: 'accueil' }, '', '#accueil');
      erreur(t(e && e.message === 'delai' ? 'err.delai' : 'err.echec'));
    } finally { clearInterval(creep); clearTimeout(patience); URL.revokeObjectURL(url); reinitialiser(); }
  }

  async function analyserTexte(texte) {
    demarrerScan(null, texte);
    cible = 50; await attendre(45); if (annule) return;
    await conclure(texte, false);
  }

  /* ================= Historique (local, facultatif) ================= */
  const CLE_H = 'vigie.historique';
  const LIBELLE = (v) => t('v.' + (v === 'rouge' ? 'rouge' : v === 'orange' ? 'orange' : 'vert') + '.etiq');
  const histo = () => lire(CLE_H, []);
  function ajouterHisto(texte, photo, verdict) {
    if (!prefs.historique) return;
    const l = histo(); l.unshift({ id: Date.now(), v: verdict, p: !!photo, t: texte.slice(0, 4000) });
    ecrire(CLE_H, l.slice(0, 50));
  }
  function rendreHistorique() {
    const l = histo(), zone = $('histo-liste');
    $('histo-effacer').hidden = l.length === 0;
    $('histo-intro').textContent = t(l.length ? 'h.intro' : (prefs.historique ? 'h.vide' : 'h.desactive'));
    zone.innerHTML = l.map((e) => {
      const d = new Date(e.id).toLocaleString(DATE[prefs.langue], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const extrait = e.t.replace(/\s+/g, ' ').slice(0, 90);
      return '<button class="h-item ' + e.v + '" type="button" data-id="' + e.id + '"><span class="h-tete"><b>' + LIBELLE(e.v) + '</b><span>' + esc(d) + (e.p ? ' · ' + t('h.photo') : '') +
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
    const lib = $('histo-effacer-txt');
    if (!confirmerEffacement) { confirmerEffacement = 1; lib.dataset.attente = '1'; lib.textContent = t('h.confirmer'); setTimeout(() => { confirmerEffacement = 0; delete lib.dataset.attente; lib.textContent = t('h.effacer'); }, 4000); return; }
    confirmerEffacement = 0; delete lib.dataset.attente; lib.textContent = t('h.effacer'); ecrire(CLE_H, []); rendreHistorique();
  });

  /* ================= Résultat ================= */
  const ICONE = { rouge: 'danger', orange: 'attention', vert: 'ok' }, NIVEAU = { rouge: 3, orange: 2, vert: 1 };
  function afficher(texte, depuisPhoto, empiler, enregistrer) {
    const r = analyser(texte), v = r.verdict, n = NIVEAU[v], nbConseils = R.conseils[v].length;
    const conseils = []; for (let i = 0; i < nbConseils; i++) conseils.push(t('c.' + v + '.' + i));
    dernier = { t: texte, p: depuisPhoto };
    if (enregistrer) ajouterHisto(texte, depuisPhoto, v);
    const lib = t('niv.' + n);
    let h = '<section class="verdict ' + v + '" id="reponse" aria-live="polite"><div class="verdict-tete"><svg aria-hidden="true"><use href="#i-' + ICONE[v] + '"/></svg><div>' +
      '<div class="verdict-etiquette">' + esc(t('v.' + v + '.etiq')) + '</div><h1>' + esc(t('v.' + v + '.titre')) + '</h1></div></div><p>' + esc(t('v.' + v + '.texte')) + '</p>' +
      '<div class="niveau" role="img" aria-label="' + esc(t('niv.titre') + ' : ' + lib) + '"><span class="niveau-lib">' + esc(t('niv.titre')) + ' : <b>' + esc(lib) + '</b></span>' +
      '<span class="niveau-barre n' + n + '"><i></i><i></i><i></i></span></div></section>';
    h += '<section class="carte"><h2>' + esc(t('res.faire')) + '</h2><ol class="etapes">' + conseils.slice(0, 3).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>';
    if (conseils.length > 3) h += '<div class="encadre">' + conseils.slice(3).map((x) => '<p>' + esc(x) + '</p>').join('') + '</div>';
    h += '</section>';
    if (r.raisons.length) h += '<details' + (v !== 'vert' ? ' open' : '') + '><summary>' + esc(t('res.pourquoi')) + '</summary><div class="details-corps"><ul>' +
      r.raisons.slice(0, 3).map((x, i) => { const c = r.codes && r.codes[i]; return '<li>' + esc(c ? t(c.k, c.p) : x) + '</li>'; }).join('') + '</ul></div></details>';
    h += '<details><summary>' + esc(t(depuisPhoto ? 'res.lu' : 'res.voir')) + '</summary><div class="details-corps"><p class="message-brut">' + esc(texte) + '</p>' +
      (depuisPhoto ? '<p class="note">' + esc(t('res.reprendre')) + '</p>' : '') + '</div></details>';
    h += '<div class="actions-duo"><button class="btn btn-secondaire" type="button" id="ecouter"><svg aria-hidden="true"><use href="#i-son"/></svg>' + esc(t('res.ecouter')) + '</button>' +
      '<button class="btn btn-secondaire" type="button" id="autre"><svg aria-hidden="true"><use href="#i-retour"/></svg>' + esc(t('res.autre')) + '</button></div>';
    const corps = encodeURIComponent(texte.slice(0, 1500));
    h += '<div class="actions-duo" style="margin-top:12px">' +
      (v !== 'vert' ? '<a class="btn btn-secondaire" href="mailto:suspect@safeonweb.be?subject=' + encodeURIComponent(t('res.mail.sujet')) + '&body=' + corps + '"><svg aria-hidden="true"><use href="#i-mail"/></svg>' + esc(t('res.signaler')) + '</a>' : '') +
      (navigator.share ? '<button class="btn btn-secondaire" type="button" id="partager"><svg aria-hidden="true"><use href="#i-partager"/></svg>' + esc(t('res.partager')) + '</button>' : '') + '</div>';
    $('vue-resultat').innerHTML = h;
    $('ecouter').onclick = () => parler($('reponse').innerText + '. ' + document.querySelector('ol.etapes').innerText);
    $('autre').onclick = () => { $('texte').value = ''; reinitialiser(); vue('accueil', true); };
    if ($('partager')) $('partager').onclick = () => navigator.share({ title: t('res.share.titre'), text: 'Vigie : ' + t('v.' + v + '.etiq') + '\n\n' + texte.slice(0, 1500) }).catch(() => {});
    vue('resultat', empiler !== false);
    if (enregistrer && prefs.voix) parler(t('v.' + v + '.etiq') + '. ' + t('v.' + v + '.titre') + '. ' + conseils.slice(0, 3).join(' '));
  }

  /* ================= Voix ================= */
  function parler(texte) {
    const P = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.TextToSpeech;
    if (P && P.speak) { P.stop().catch(() => {}); P.speak({ text: texte, lang: PARLE[prefs.langue], rate: 0.9 }).catch(() => synthese(texte)); } else synthese(texte);
  }
  function synthese(texte) {
    try { const u = new SpeechSynthesisUtterance(texte); u.lang = PARLE[prefs.langue]; u.rate = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* pas de voix disponible */ }
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
    if (!texte) { erreur(t('err.vide')); $('texte').focus(); return; }
    if (analyser) analyserTexte(texte);
  });

  /* ================= Réglages d'affichage, voix, langue, à propos ================= */
  document.querySelectorAll('button[data-taille]').forEach((b) => b.addEventListener('click', () => majPref('taille', b.dataset.taille)));
  document.querySelectorAll('button[data-theme]').forEach((b) => b.addEventListener('click', () => majPref('theme', b.dataset.theme)));
  document.querySelectorAll('button[data-langue]').forEach((b) => b.addEventListener('click', () => majPref('langue', b.dataset.langue)));
  $('reg-voix').addEventListener('change', (e) => majPref('voix', e.target.checked));
  $('reg-histo').addEventListener('change', (e) => majPref('historique', e.target.checked));
  $('ouvrir-apropos').addEventListener('click', () => vue('apropos', true));
  $('revoir-presentation').addEventListener('click', () => { vue('bienvenue', true); pasBienvenue(0, true); });

  /* ================= Présentation du premier lancement : carrousel ================= */
  const piste = $('bv-piste'), NB = piste.children.length;
  let pas = 0;
  function pasBienvenue(n, saut) {
    if (typeof n === 'number') pas = n;
    document.querySelectorAll('.bv-points i').forEach((p, k) => p.classList.toggle('actif', k === pas));
    $('bv-suivant').textContent = t(pas === NB - 1 ? 'b.commencer' : 'b.suivant');
    $('bv-passer').hidden = pas === NB - 1;
    if (saut) piste.scrollTo({ left: pas * piste.clientWidth, behavior: 'auto' });
  }
  function finBienvenue() {
    ecrire('vigie.bienvenue', 1);
    vue('accueil', false); history.replaceState({ v: 'accueil' }, '', '#accueil');
  }
  piste.addEventListener('scroll', () => {
    const k = Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth));
    if (k !== pas && k >= 0 && k < NB) pasBienvenue(k);
  }, { passive: true });
  $('bv-suivant').addEventListener('click', () => {
    if (pas >= NB - 1) { finBienvenue(); return; }
    piste.scrollTo({ left: (pas + 1) * piste.clientWidth, behavior: 'smooth' });
    pasBienvenue(pas + 1);
  });
  $('bv-passer').addEventListener('click', finBienvenue);
  /* ================= Démarrage ================= */
  fetch('regles.json').then((r) => r.json()).then((j) => { R = j; analyser = VigieRegles.creerAnalyseur(R); })
    .catch(() => erreur(t('err.regles')));
  appliquerPrefs();
  history.replaceState({ v: 'accueil' }, '', '#accueil');
  if (!lire('vigie.bienvenue', 0)) { vue('bienvenue', false); pasBienvenue(0); } else vue('accueil', false);
  window.__vigie = { afficher, preparer, analyserTexte, analyserPhoto, lireImages };   // pour les tests automatiques
})();
