/* Prépare mobile/www : copie la feuille de style, les polices, le logo et le moteur de lecture des photos
 * (Tesseract.js + langue française) depuis le dépôt et node_modules. Tout est embarqué : l'app marche hors ligne.
 * Usage : npm run preparer */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const www = path.join(R, 'www');
const copier = (de, vers) => { fs.mkdirSync(path.dirname(vers), { recursive: true }); fs.copyFileSync(de, vers); };

copier(path.join(R, '..', 'static', 'vigie.css'), path.join(www, 'vigie.css'));
for (const l of ['logo-icone.svg', 'logo-icone-sombre.svg']) copier(path.join(R, '..', 'static', l), path.join(www, 'img', l));
for (const f of fs.readdirSync(path.join(R, '..', 'static', 'fonts'))) {
  copier(path.join(R, '..', 'static', 'fonts', f), path.join(www, 'fonts', f));
}
const nm = path.join(R, 'node_modules');
copier(path.join(nm, 'tesseract.js', 'dist', 'tesseract.min.js'), path.join(www, 'ocr', 'tesseract.min.js'));
copier(path.join(nm, 'tesseract.js', 'dist', 'worker.min.js'), path.join(www, 'ocr', 'worker.min.js'));
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js']) {
  copier(path.join(nm, 'tesseract.js-core', f), path.join(www, 'ocr', f));
}
copier(path.join(nm, '@tesseract.js-data', 'fra', '4.0.0_best_int', 'fra.traineddata.gz'), path.join(www, 'ocr', 'fra.traineddata.gz'));
console.log('mobile/www est prêt.');
