/* Vigie — application Android autonome. GPL-3.0
 * Tout se passe sur le téléphone : lecture de la photo (Tesseract.js, embarqué), analyse (regles.js), voix. */
(function () {
  'use strict';
  const VERSION = '0.4.4';
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
  const PREFS_DEFAUT = { taille: 'normal', theme: 'auto', voix: true, historique: false, langue: detecter(), voixId: {} };
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
    /* Diagnostic visible : sans lui, un échec de la lecture rapide reste invisible. */
    $('version-ligne').textContent += ' · ' + t('p.diag') + ' : ' + DIAG + (DERNIERE_ERREUR ? ' (' + DERNIERE_ERREUR + ')' : '');
    document.querySelectorAll('button[data-langue]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.langue === prefs.langue)));
    if (!$('histo-effacer-txt').dataset.attente) $('histo-effacer-txt').textContent = t('h.effacer');
    $('etape-0-txt').textContent = t(photoEnCours ? 's.e0.photo' : 's.e0.msg');
    rendreNumeros($('aide-numeros'));   // la grille vient de annuaire.json : elle n'a pas d'attribut data-i18n
    rendreDanger();
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
    if ($('reg-voix-choix')) remplirVoix();
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
  document.querySelectorAll('#tabbar button, .lien-discret[data-vue]').forEach((b) => b.addEventListener('click', () => {
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
  /* Sur la voie rapide (lecture native ou texte collé) il n'y a rien à attendre :
     faire patienter devant une barre de progression serait du décor. */
  const attendre = async (p) => { if (rapide) return; while (!annule && aff < p - 0.5) await pause(16); };

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
    annule = false; cible = 0; aff = 0; rapide = !photoURL; erreur(''); ppCacher();
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
    await pause(rapide ? 0 : 200); if (annule) return;
    finScan(); afficher(texte, photo, true, true);
  }

  /* Lecture native Android (ML Kit, embarquée) : quasi instantanée. Sinon on retombe sur Tesseract. */
  /* On n'exige plus isNativePlatform() : si le pont Capacitor est là, le plugin natif l'est aussi.
     Cette condition était la raison pour laquelle l'application retombait sur la lecture de
     secours — des minutes d'attente — alors que ML Kit était disponible. */
  const natif = () => {
    try {
      if (!window.Capacitor || !Capacitor.registerPlugin) { DIAG = 'pont Capacitor absent'; return null; }
      const p = Capacitor.registerPlugin('LectureTexte');
      if (!p || !p.lire) { DIAG = 'plugin LectureTexte absent'; return null; }
      DIAG = 'disponible'; return p;
    } catch (e) { DIAG = 'erreur : ' + (e && e.message); return null; }
  };
  /* Dernière erreur de lecture native, affichée dans À propos : sans elle, un échec est muet
     et l'application passe en lecture de secours sans que personne sache pourquoi. */
  let DERNIERE_ERREUR = '', DIAG = 'non testée';

  async function lireNatif(fichier, plugin) {
    /* 1600 px suffisent largement à ML Kit pour une capture d'écran, et le passage de l'image
       vers la partie native coûte moins cher : c'est ce transfert, pas la lecture, qui est lourd. */
    /* Décoder l'image directement à la taille voulue : sur une capture d'écran de 3000 px,
       décoder en entier puis redessiner coûte bien plus cher que la lecture elle-même. */
    let bmp = null;
    try { bmp = await createImageBitmap(fichier, { resizeWidth: 1280, resizeQuality: 'medium', imageOrientation: 'from-image' }); } catch (e) { bmp = null; }
    if (!bmp) { try { bmp = await createImageBitmap(fichier, { resizeWidth: 1280 }); } catch (e) { bmp = null; } }
    if (!bmp) bmp = await createImageBitmap(fichier);
    const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
    const blob = await new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('toBlob'))), 'image/jpeg', 0.7));
    const data = await new Promise((ok, ko) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1]); f.onerror = ko; f.readAsDataURL(blob); });
    cible = 60;
    /* Si la partie native ne répond pas, on ne reste pas suspendu : mieux vaut le dire tout de suite. */
    const r = await Promise.race([
      plugin.lire({ data }),
      new Promise((ok, ko) => setTimeout(() => ko(new Error('la lecture native n\'a pas répondu en 8 s')), 8000)),
    ]);
    return r.texte || '';
  }

  async function analyserPhoto(fichier) {
    const url = URL.createObjectURL(fichier);
    demarrerScan(url);
    // le pourcentage ne reste jamais figé : il avance doucement entre deux vrais signaux du moteur de lecture
    /* L'animation d'attente ne concerne que la lecture de secours : la lecture native est instantanée. */
    const creep = setInterval(() => { if (!rapide && cible >= 14 && cible < 86) cible += (86 - cible) * 0.014; }, 250);
    const patience = setTimeout(() => { if (!rapide) $('scan-statut').textContent = t('s.st.long'); }, 12000);
    try {
      cible = 6;
      const N = natif();
      let texte = null;
      if (N) {
        rapide = true;
        try { texte = (await lireNatif(fichier, N)).trim(); cible = 88; DERNIERE_ERREUR = ''; }
        catch (e) {
          /* Sur Android, la lecture native est la seule rapide. Si elle échoue, la lecture de
             secours prend des minutes : c'est pire que de ne rien faire. On le dit et on s'arrête. */
          DERNIERE_ERREUR = (e && (e.message || e.errorMessage)) || 'erreur inconnue';
          finScan(); vue('accueil', false); history.replaceState({ v: 'accueil' }, '', '#accueil');
          erreur(t('err.lecture') + ' (' + DERNIERE_ERREUR + ')');
          return;
        }
      }
      if (annule) return;
      if (texte === null) {
        /* Version web uniquement : pas de lecture native disponible. */
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

  /* ================= Annuaire (numéros vérifiés) =================
   * RÈGLE ABSOLUE : aucun numéro de téléphone n'est écrit dans ce fichier. Tous viennent de
   * annuaire.json, où chacun a été vérifié à la main (voir l'avertissement en tête de ce fichier).
   * Vigie ne compose JAMAIS un numéro trouvé dans le message analysé : pour une banque ou un
   * service, elle affiche la consigne officielle (« le numéro au dos de votre carte »).
   * Si annuaire.json manque, Vigie n'invente rien : elle revient à la liste de conseils. */
  let ANNUAIRE = null, MOTIFS = {};

  function chargerAnnuaire(j) {
    ANNUAIRE = j; MOTIFS = {};
    const m = (j && j.motifs) || {};
    Object.keys(m).forEach((k) => {
      if (k.charAt(0) === '_') return;
      try { MOTIFS[k] = new RegExp(m[k]); } catch (e) { /* motif illisible : ignoré, jamais bloquant */ }
    });
    rendreNumeros($('aide-numeros')); rendreDanger();
  }
  const contact = (cle) => ((ANNUAIRE && ANNUAIRE.urgences) || []).filter((x) => x && x.cle === cle)[0] || null;
  const nomContact = (c) => (c.nom_i18n ? t(c.nom_i18n) : c.nom || '');
  /* Un href d'appel ne contient que des chiffres et un éventuel « + » : rien d'autre ne peut s'y glisser. */
  const lienContact = (c) => (c.tel ? 'tel:' + String(c.tel).replace(/[^0-9+]/g, '')
    : c.mail ? 'mailto:' + encodeURIComponent(c.mail).replace(/%40/g, '@') : '');

  /* Liste courte des contacts d'urgence : 5 au maximum, uniquement ceux de annuaire.json.
   * Sert à la fois au bouton « J'ai besoin d'aide maintenant » et à l'onglet Aide, dont le
   * HTML de index.html n'est qu'un repli identique si le fichier ne se charge pas. */
  /* Bouton d'alerte : les mêmes contacts vérifiés, mis en avant quand il y a danger immédiat.
     Vigie n'envoie ni position ni message à personne : elle compose, c'est tout. */
  function rendreDanger() {
    const zone = $('aide-danger'); if (!zone || !ANNUAIRE || !ANNUAIRE.danger) return;
    const par = {}; (ANNUAIRE.urgences || []).forEach((c) => { par[c.cle] = c; });
    zone.innerHTML = ANNUAIRE.danger.map((cle) => {
      const c = par[cle], lien = c && lienContact(c); if (!lien) return '';
      return '<a class="btn-danger" data-externe href="' + esc(lien) + '"><b>' + esc(nomContact(c)) +
        '</b><span>' + esc(c.affichage || '') + '</span></a>';
    }).join('');
  }

  function rendreNumeros(zone) {
    if (!zone || !ANNUAIRE || !ANNUAIRE.urgences) return;
    zone.innerHTML = ANNUAIRE.urgences.map((c) => {
      const lien = lienContact(c); if (!lien) return '';
      return '<a class="numero" data-externe href="' + esc(lien) + '"><b>' + esc(nomContact(c)) + '</b><span>' +
        esc(c.affichage || '') + '</span><small>' + esc(c.desc ? t(c.desc) : '') + '</small></a>';
    }).join('');
  }

  /* ================= Jeton de présence =================
   * Un bouton : Vigie lit la position UNE fois, écrit le message, ouvre l'application de
   * messages avec le texte prêt. L'envoi reste un geste de la personne.
   * Pas de service en arrière-plan : Android imposerait une notification permanente
   * (« Vigie suit votre position »), que l'optimisation de batterie peut tuer sans prévenir.
   * Rien n'est envoyé par Vigie, aucun serveur, aucune position conservée. */
  let JETON = '';

  function jetonTexte(pos) {
    const lat = pos.coords.latitude.toFixed(5), lon = pos.coords.longitude.toFixed(5);
    const h = new Date().toLocaleTimeString(DATE[prefs.langue] || 'fr-BE', { hour: '2-digit', minute: '2-digit' });
    return t('j.message', { h: h }) + '\nhttps://maps.google.com/?q=' + lat + ',' + lon;
  }

  function jetonEnvoyer() {
    const b = $('jeton'); if (!b) return;
    b.disabled = true; b.textContent = t('j.recherche');
    const fini = (msg) => { b.disabled = false; b.textContent = t('j.bouton'); if (msg) erreur(msg); };
    if (!navigator.geolocation) { fini(t('j.sans')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        JETON = jetonTexte(pos);
        $('jeton-texte').textContent = JETON;
        $('jeton-resultat').hidden = false;
        fini('');
        ouvrirExterne('sms:?body=' + encodeURIComponent(JETON));
      },
      () => fini(t('j.sans')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  /* ================= Liens sortants (tel:, mailto:) =================
   * Dans un WebView Capacitor, une ancre ordinaire n'ouvre pas toujours le téléphone ou le
   * courrier : on force donc l'ouverture. AppLauncher s'il est déjà installé, sinon une
   * navigation directe, que Capacitor transforme en Intent Android. Aucune dépendance ajoutée.
   * Le href reste présent : appui long, accessibilité et navigateur de bureau continuent de marcher. */
  function ouvrirExterne(url) {
    try {
      const A = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.AppLauncher;
      if (A && A.openUrl) { A.openUrl({ url: url }).catch(() => { window.location.href = url; }); return; }
    } catch (e) { /* on retombe sur la navigation directe */ }
    window.location.href = url;
  }
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest && ev.target.closest('a[data-externe]'); if (!a) return;
    const url = a.getAttribute('href'); if (!url) return;
    ev.preventDefault(); ouvrirExterne(url);
  });

  /* ================= Action unique =================
   * Après un verdict, Vigie ne propose plus une liste de conseils mais UNE action, la bonne,
   * immédiatement exécutable. L'ordre de décision compte : une menace envers une personne passe
   * avant l'argent, parce qu'un appel à la police ne peut pas attendre un virement. */
  function famille(r, t2) {
    if (MOTIFS.proche && MOTIFS.proche.test(t2)) return 'proche';
    const org = (ANNUAIRE && ANNUAIRE.organismes) || {};
    for (let i = 0; i < r.marques.length; i++) { const f = org[r.marques[i]]; if (f) return f; }
    return 'autre';
  }
  function choisirAction(r, texte) {
    const t2 = VigieRegles.sansAccents(texte || '');
    const vu = (k) => !!(MOTIFS[k] && MOTIFS[k].test(t2));
    if (r.verdict === 'vert') return { type: 'vert' };
    if (r.verdict === 'rouge') {
      if (vu('menace') && contact('police')) return { type: 'police', c: contact('police') };
      if (vu('argent') && contact('cardstop')) return { type: 'cardstop', c: contact('cardstop') };
      if (contact('safeonweb')) return { type: 'signaler', c: contact('safeonweb') };
      return { type: 'aucune' };
    }
    const f = famille(r, t2);
    return { type: 'verifier', famille: f, marque: f === 'proche' ? null : (r.marques[0] || null) };
  }

  /* Un seul bloc visuellement dominant par écran : soit un gros bouton d'appel, soit la consigne. */
  function htmlAction(a, texte, v) {
    if (a.type === 'aucune') return '';
    const tete = '<span class="action-sur">' + esc(t('act.titre')) + '</span>';
    if (a.type === 'vert') {
      return '<section class="action action-vert"><h2>' + esc(t('act.vert.titre')) + '</h2><p>' + esc(t('act.vert.quoi')) + '</p></section>';
    }
    if (a.type === 'verifier') {
      const consignes = (ANNUAIRE && ANNUAIRE.consignes) || {};
      const cle = consignes[a.famille] || consignes.autre;
      let s = '<section class="action action-orange">' + tete + '<h2>' + esc(t('act.ver.titre')) + '</h2>' +
        '<p class="action-consigne">' + esc(cle ? t(cle) : t('act.ver.autre')) + '</p>' +
        '<p class="action-quoi">' + esc(t('act.ver.quoi')) + '</p>';
      const off = a.marque && R.marques && R.marques[a.marque];
      if (off && off.length) s += '<p class="note">' + esc(t('act.ver.site', { m: a.marque, s: off.join(', ') })) + '</p>';
      return s + '</section>';
    }
    const cle = a.type === 'police' ? 'pol' : a.type === 'cardstop' ? 'cs' : 'sig';
    let lien = lienContact(a.c);
    if (a.type === 'signaler') {
      lien += '?subject=' + encodeURIComponent(t('res.mail.sujet')) + '&body=' + encodeURIComponent(texte.slice(0, 1500));
    }
    const icone = a.type === 'signaler' ? 'i-mail' : 'i-tel';
    return '<section class="action action-' + (a.type === 'signaler' ? 'rouge-mail' : 'rouge') + '">' + tete +
      '<a class="btn btn-action" data-externe href="' + esc(lien) + '"><svg aria-hidden="true"><use href="#' + icone + '"/></svg>' +
      '<span>' + esc(t('act.' + cle + '.btn')) + (a.type === 'signaler' ? '' : '<small>' + esc(a.c.affichage || '') + '</small>') + '</span></a>' +
      '<p class="action-quoi">' + esc(t('act.' + cle + '.quoi')) + '</p>' +
      '<p class="note">' + esc(t('act.' + cle + '.apres')) + '</p></section>';
  }

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

    /* L'action d'abord : la mise en sécurité ne doit pas attendre la lecture d'une explication. */
    const action = choisirAction(r, texte);
    const bloc = htmlAction(action, texte, v);
    h += bloc;
    /* Repli si annuaire.json ne s'est pas chargé : on remet la liste de conseils, jamais un numéro inventé. */
    if (!bloc) h += '<section class="carte"><h2>' + esc(t('res.faire')) + '</h2><ol class="etapes">' +
      conseils.slice(0, 3).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol></section>';

    /* Bouton secondaire permanent : les contacts d'urgence, à portée de main sur tous les verdicts. */
    h += '<details class="aide-vite"><summary><svg aria-hidden="true"><use href="#i-tel"/></svg>' + esc(t('act.aide.btn')) + '</summary>' +
      '<div class="details-corps"><div class="numeros-grille" id="res-numeros"></div><p class="note" style="margin-top:12px">' + esc(t('act.aide.intro')) + '</p></div></details>';

    /* Puis l'explication : pourquoi ce verdict, et les autres précautions. */
    h += '<details class="pourquoi"><summary>' + esc(t('res.pourquoi.t')) + '</summary><div class="details-corps">';
    if (r.raisons.length) h += '<p class="etiquette">' + esc(t('res.pourquoi')) + '</p><ul>' +
      r.raisons.slice(0, 3).map((x, i) => { const c = r.codes && r.codes[i]; return '<li>' + esc(c ? t(c.k, c.p) : x) + '</li>'; }).join('') + '</ul>';
    h += '<p class="etiquette">' + esc(t('res.faire')) + '</p><ul>' + conseils.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div></details>';

    h += '<details><summary>' + esc(t(depuisPhoto ? 'res.lu' : 'res.voir')) + '</summary><div class="details-corps"><p class="message-brut">' + esc(texte) + '</p>' +
      (depuisPhoto ? '<p class="note">' + esc(t('res.reprendre')) + '</p>' : '') + '</div></details>';
    h += '<div class="actions-duo"><button class="btn btn-secondaire" type="button" id="ecouter"><svg aria-hidden="true"><use href="#i-son"/></svg>' + esc(t('res.ecouter')) + '</button>' +
      '<button class="btn btn-secondaire" type="button" id="autre"><svg aria-hidden="true"><use href="#i-retour"/></svg>' + esc(t('res.autre')) + '</button></div>';
    if (navigator.share) h += '<div class="actions-duo" style="margin-top:12px"><button class="btn btn-secondaire" type="button" id="partager">' +
      '<svg aria-hidden="true"><use href="#i-partager"/></svg>' + esc(t('res.partager')) + '</button></div>';
    $('vue-resultat').innerHTML = h;
    rendreNumeros($('res-numeros'));
    const dire = () => {
      const a = document.querySelector('.action');
      return $('reponse').innerText + '. ' + (a ? a.innerText : conseils.slice(0, 3).join(' '));
    };
    $('ecouter').onclick = () => parler(dire());
    $('autre').onclick = () => { $('texte').value = ''; reinitialiser(); vue('accueil', true); };
    if ($('partager')) $('partager').onclick = () => navigator.share({ title: t('res.share.titre'), text: 'Vigie : ' + t('v.' + v + '.etiq') + '\n\n' + texte.slice(0, 1500) }).catch(() => {});
    vue('resultat', empiler !== false);
    if (enregistrer && prefs.voix) parler(dire());
  }

  /* ================= Voix =================
   * Sans choix explicite, Android lit avec le moteur de synthèse par défaut du téléphone.
   * Celui-ci varie d'un appareil à l'autre (Google, Samsung, Acapela/Vocalizer…) : la voix
   * n'est donc jamais la même d'un utilisateur à l'autre, et certaines sont celles des
   * logiciels antivirus, ce qui est exactement l'inverse de l'effet recherché.
   * On choisit donc une voix explicitement, et on laisse l'utilisateur en changer. */

  const VOIX_EVITER = /acapela|vocalizer|nuance|loquendo|ivona|espeak|pico|compact/i;
  const VOIX_GOOGLE = /-x-|google/i;
  let VOIX = [];

  const plugTTS = () => { const P = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.TextToSpeech; return (P && P.speak) ? P : null; };

  async function chargerVoix() {
    try {
      const P = plugTTS();
      if (P && P.getSupportedVoices) VOIX = (await P.getSupportedVoices()).voices || [];
      else if (window.speechSynthesis) {
        VOIX = speechSynthesis.getVoices();
        if (!VOIX.length) await new Promise((r) => { speechSynthesis.onvoiceschanged = r; setTimeout(r, 800); }).then(() => { VOIX = speechSynthesis.getVoices(); });
      }
    } catch (e) { VOIX = []; }
    return VOIX;
  }

  /* Voix disponibles pour la langue en cours, les plus naturelles d'abord. */
  function voixLangue(langue) {
    const code = (PARLE[langue] || 'fr-BE').toLowerCase(), base = code.slice(0, 2);
    const note = (v) => {
      const n = String(v.name || v.voiceURI || '').toLowerCase(), l = String(v.lang || '').toLowerCase().replace('_', '-');
      let s = 0;
      if (l === code) s += 40; else if (l.slice(0, 2) === base) s += 20;
      if (VOIX_GOOGLE.test(n)) s += 15;      /* moteur Google : voix neuronales, les plus naturelles */
      if (VOIX_EVITER.test(n)) s -= 30;      /* moteurs tiers, dont ceux des antivirus */
      if (v.localService) s += 5;            /* voix embarquée : fonctionne hors ligne */
      return s;
    };
    return VOIX.map((v, i) => ({ v, i, s: note(v) }))
      .filter((x) => String(x.v.lang || '').toLowerCase().slice(0, 2) === base)
      .sort((a, b) => b.s - a.s);
  }

  /* Index de la voix à utiliser : celle choisie dans les réglages, sinon la mieux notée. */
  function voixCourante() {
    const liste = voixLangue(prefs.langue);
    if (!liste.length) return null;
    const choisi = prefs.voixId && prefs.voixId[prefs.langue];
    if (choisi) { const x = liste.find((y) => (y.v.voiceURI || y.v.name) === choisi); if (x) return x; }
    return liste[0];
  }

  function parler(texte) {
    const x = voixCourante(), P = plugTTS();
    if (P) {
      P.stop().catch(() => {});
      const o = { text: texte, lang: PARLE[prefs.langue], rate: 0.92, pitch: 1.0 };
      if (x) o.voice = x.i;
      P.speak(o).catch(() => synthese(texte, x));
    } else synthese(texte, x);
  }

  function synthese(texte, x) {
    try {
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = PARLE[prefs.langue]; u.rate = 0.92;
      /* Le choix de la voix ne doit jamais empêcher la lecture : en cas d'échec, on lit avec celle par défaut. */
      try {
        if (x && x.v && x.v.voiceURI) {
          const v = speechSynthesis.getVoices().find((y) => y.voiceURI === x.v.voiceURI); if (v) u.voice = v;
        }
      } catch (e) { /* voix refusée par le navigateur */ }
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { /* pas de voix disponible */ }
  }

  /* Liste déroulante des voix dans les réglages. */
  async function remplirVoix() {
    const sel = $('reg-voix-choix'); if (!sel) return;
    if (!VOIX.length) await chargerVoix();
    const liste = voixLangue(prefs.langue);
    sel.innerHTML = '';
    const auto = document.createElement('option');
    auto.value = ''; auto.textContent = t('g.voix.auto');
    sel.appendChild(auto);
    liste.forEach((x) => {
      const o = document.createElement('option');
      o.value = x.v.voiceURI || x.v.name;
      o.textContent = (x.v.name || x.v.voiceURI) + ' (' + x.v.lang + ')';
      sel.appendChild(o);
    });
    sel.value = (prefs.voixId && prefs.voixId[prefs.langue]) || '';
    sel.disabled = !liste.length;
    const ligne = $('ligne-voix-choix'); if (ligne) ligne.hidden = !liste.length;
  }

  /* ================= Formulaire ================= */
  function reinitialiser() { $('camera').value = ''; $('galerie').value = ''; }
  ['camera', 'galerie'].forEach((id) => $(id).addEventListener('change', function () {
    const f = this.files && this.files[0]; if (f && analyser) analyserPhoto(f);
  }));
  $('coller').addEventListener('click', () => {
    const t = $('texte');
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then((x) => { if (x) { t.value = x; ppCacher(); } t.focus(); }).catch(() => t.focus());
    else t.focus();
  });
  $('formulaire').addEventListener('submit', (e) => {
    e.preventDefault();
    const texte = $('texte').value.trim();
    if (!texte) { erreur(t('err.vide')); $('texte').focus(); return; }
    if (analyser) analyserTexte(texte);
  });

  /* ================= Presse-papier : proposer ce que l'utilisateur vient de copier =================
   * Depuis Android 10, une application ne peut lire le presse-papier QUE lorsqu'elle est au premier
   * plan et qu'elle a le focus : aucune surveillance en arrière-plan n'est possible, et Vigie n'en
   * tente aucune. Elle lit donc à l'ouverture et à chaque retour au premier plan, puis propose.
   * Elle n'analyse jamais d'elle-même : l'utilisateur garde la main.
   * Rien n'est conservé en clair : seule une empreinte courte du dernier contenu proposé ou écarté
   * est gardée, juste de quoi ne pas reproposer deux fois la même chose. */
  const CLE_PP = 'vigie.presse';
  let ppTexte = null, ppMinuteur = 0, reLien = null;

  /* Empreinte non réversible (FNV-1a 32 bits) : on ne peut pas en retrouver le message. */
  function empreinte(texte) {
    let h = 0x811c9dc5;
    for (let i = 0; i < texte.length; i++) { h = ((h ^ texte.charCodeAt(i)) * 0x01000193) >>> 0; }
    return h.toString(36) + '.' + texte.length;
  }
  const aUnLien = (texte) => { if (!reLien && R) reLien = new RegExp(R.url_re, 'i'); return !!reLien && reLien.test(texte); };

  function ppCacher() { ppTexte = null; $('pp').hidden = true; }

  function ppRetenir(texte) {
    if (!texte) return;
    ppTexte = texte;
    $('pp-extrait').textContent = texte.replace(/\s+/g, ' ').slice(0, 90);
    $('pp').hidden = false;
    ecrire(CLE_PP, empreinte(texte));   // proposé une seule fois, même si le contenu reste dans le presse-papier
  }

  function ppDigneDAttention(texte) {
    if (!texte || !R) return false;                        // sans les règles, Vigie ne peut rien vérifier
    if (texte.length < 15 && !aUnLien(texte)) return false;   // trop court pour être un message, et sans lien
    if (texte === $('texte').value.trim()) return false;   // déjà dans Vigie (bouton « Coller », texte que Vigie y a mis)
    if (dernier && texte === dernier.t) return false;      // déjà vérifié
    if (empreinte(texte) === lire(CLE_PP, '')) return false;   // déjà proposé ou écarté
    return true;
  }

  async function ppRegarder() {
    if (vueCourante === 'scan' || vueCourante === 'bienvenue') return;   // on n'interrompt ni l'analyse ni la présentation
    let texte = '';
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) return;
      texte = String((await navigator.clipboard.readText()) || '').trim();
    } catch (e) { return; }   // lecture refusée ou impossible : rien ne s'affiche, et aucune erreur
    if (ppTexte && texte === ppTexte) return;              // la même proposition est déjà à l'écran
    if (ppDigneDAttention(texte)) ppRetenir(texte); else ppCacher();
  }
  /* Court délai : au retour au premier plan, Android n'autorise la lecture qu'une fois le focus revenu. */
  const ppPlusTard = () => { clearTimeout(ppMinuteur); ppMinuteur = setTimeout(ppRegarder, 250); };

  $('pp-verifier').addEventListener('click', () => {
    const texte = ppTexte;
    ppCacher();
    if (!texte) return;
    $('texte').value = texte;
    if (analyser) analyserTexte(texte);
  });
  $('pp-ecarter').addEventListener('click', ppCacher);

  const plugApp = () => { const P = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App; return (P && P.addListener) ? P : null; };
  const A = plugApp();
  if (A) A.addListener('resume', ppPlusTard);
  else document.addEventListener('visibilitychange', () => { if (!document.hidden) ppPlusTard(); });

  /* ================= Réglages d'affichage, voix, langue, à propos ================= */
  document.querySelectorAll('button[data-taille]').forEach((b) => b.addEventListener('click', () => majPref('taille', b.dataset.taille)));
  document.querySelectorAll('button[data-theme]').forEach((b) => b.addEventListener('click', () => majPref('theme', b.dataset.theme)));
  document.querySelectorAll('button[data-langue]').forEach((b) => b.addEventListener('click', () => majPref('langue', b.dataset.langue)));
  $('reg-voix').addEventListener('change', (e) => { majPref('voix', e.target.checked); if (e.target.checked) remplirVoix(); });
  $('reg-histo').addEventListener('change', (e) => majPref('historique', e.target.checked));
  if ($('reg-voix-choix')) $('reg-voix-choix').addEventListener('change', (e) => {
    const m = Object.assign({}, prefs.voixId); m[prefs.langue] = e.target.value || undefined;
    majPref('voixId', m); parler(t('g.voix.exemple'));
  });
  if ($('reg-voix-test')) $('reg-voix-test').addEventListener('click', () => parler(t('g.voix.exemple')));
  if ($('jeton')) $('jeton').addEventListener('click', jetonEnvoyer);
  if ($('jeton-copier')) $('jeton-copier').addEventListener('click', function () {
    try { navigator.clipboard.writeText(JETON); this.textContent = t('j.copie'); } catch (e) { /* refusé */ }
  });
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
    ppPlusTard();   // la présentation est finie : on peut proposer ce qui est dans le presse-papier
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
  /* ================= Contenu reçu du bouton « Partager » d'Android =================
   * L'utilisateur reçoit un message douteux, touche « Partager », choisit Vigie : l'analyse part
   * tout de suite, sans rien coller ni taper. Le plugin natif garde le contenu de côté ; on le
   * récupère au démarrage et à chaque signal (application déjà ouverte). Tout reste sur le téléphone. */
  const plugPartage = () => { try { return window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() ? Capacitor.registerPlugin('Partage') : null; } catch (e) { return null; } };
  let partageEnCours = false;

  function blobBase64(b64, mime) {
    const bin = atob(b64), n = bin.length, octets = new Uint8Array(n);
    for (let i = 0; i < n; i++) octets[i] = bin.charCodeAt(i);
    return new Blob([octets], { type: mime || 'image/jpeg' });
  }

  function echecPartage(cle) {
    vue('accueil', false); history.replaceState({ v: 'accueil' }, '', '#accueil');
    erreur(t(cle));
  }

  async function reprendrePartage(P) {
    if (partageEnCours) return;
    partageEnCours = true;
    try {
      // Une analyse est déjà en cours : on la laisse finir plutôt que de l'interrompre à mi-chemin.
      for (let i = 0; vueCourante === 'scan' && i < 50; i++) await pause(300);
      const c = await P.contenuEnAttente();
      if (!c || !c.type) return;                       // rien n'a été partagé : démarrage ordinaire
      if (!(await reglesPretes)) return;               // règles illisibles : le message est déjà affiché
      if (c.type === 'texte') {
        const texte = String(c.texte || '').trim();
        if (!texte) { echecPartage('err.partage'); return; }
        $('texte').value = texte;
        await analyserTexte(texte);
      } else if (c.type === 'image') {
        await analyserPhoto(blobBase64(c.image, c.mime));
      } else {
        echecPartage(c.type === 'trop-grande' ? 'err.partage.grande' : 'err.partage');
      }
    } catch (e) {
      echecPartage('err.partage');
    } finally { partageEnCours = false; }
  }

  /* ================= Démarrage ================= */
  /* L'annuaire n'est pas vital : s'il manque, Vigie affiche les conseils au lieu de l'action, sans jamais inventer de numéro. */
  const annuairePret = fetch('annuaire.json').then((r) => r.json()).then(chargerAnnuaire).catch(() => { ANNUAIRE = null; });
  /* Un message partagé est analysé dès le lancement : il doit attendre les règles ET l'annuaire,
     sinon il arriverait sur l'écran de repli au lieu de l'action à faire. */
  const reglesPretes = Promise.all([
    fetch('regles.json').then((r) => r.json())
      .then((j) => { R = j; analyser = VigieRegles.creerAnalyseur(R); ppPlusTard(); }),
    annuairePret,
  ]).then(() => true).catch(() => { erreur(t('err.regles')); return false; });
  natif();   // renseigne le diagnostic dès l'ouverture
  appliquerPrefs();
  history.replaceState({ v: 'accueil' }, '', '#accueil');
  vue('accueil', false);   // plus de présentation : l'application s'ouvre sur ce qu'elle fait
  // Un message partagé passe devant la présentation : c'est ce que l'utilisateur vient de demander.
  // La présentation reste à voir au prochain lancement ordinaire.
  const PARTAGE = plugPartage();
  if (PARTAGE) {
    try {
      const ecoute = PARTAGE.addListener('partage', () => reprendrePartage(PARTAGE));
      if (ecoute && ecoute.catch) ecoute.catch(() => {});
    } catch (e) { /* pas d'écoute possible : le contenu sera pris au prochain démarrage */ }
    reprendrePartage(PARTAGE);
  }
  window.__vigie = { afficher, preparer, analyserTexte, analyserPhoto, lireImages, reprendrePartage, ppRegarder, choisirAction };   // pour les tests automatiques
})();
