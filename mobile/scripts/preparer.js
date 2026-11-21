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
console.log('mobile/www est prêt.');
