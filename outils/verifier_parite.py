"""Vérifie que le moteur du téléphone (regles.js) donne EXACTEMENT les mêmes résultats que regles.py.
Usage : python3 outils/verifier_parite.py   (nécessite Node.js)"""
import json
import os
import subprocess
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RACINE)
from regles import analyser  # noqa: E402
from test_vigie import CAS  # noqa: E402

EXTRA = [
    "WWW.KBC-SECURE-LOGIN.TOP/verif urgent",
    "Belfius : mettez à jour vos données sur www.belfius.be.",
    "ING: votre carte expire. https://ing.be.verification-client.com/ ,",
    "Voir http://192.168.0.1 et https://t.co/abc).",
    "itsme ® : https://www.itsme-id.com/fr-BE/get-started",
    "Gagnant ! Héritage de 2 millions, ne le dites à personne. Western Union.",
    "",
    "Votre facture est disponible, réglez-la au plus vite.",
]
messages = [c[1] for c in CAS] + EXTRA
attendus = [analyser(m) for m in messages]
script = """
const R=require(process.argv[1]+'/mobile/www/regles.json');
const a=require(process.argv[1]+'/mobile/www/regles.js').creerAnalyseur(R);
const msgs=JSON.parse(require('fs').readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(msgs.map(m=>{const r=a(m);return {verdict:r.verdict,score:r.score,raisons:r.raisons,liens:r.liens,marques:r.marques};})));
"""
sortie = subprocess.run(["node", "-e", script, RACINE], input=json.dumps(messages),
                        capture_output=True, text=True, check=True).stdout
obtenus = json.loads(sortie)
ecarts = 0
for m, a, o in zip(messages, attendus, obtenus):
    if a != o:
        ecarts += 1
        print("ÉCART :", repr(m[:60]))
        print("  Python :", a)
        print("  JS     :", o)
print(f"{len(messages) - ecarts}/{len(messages)} messages identiques entre Python et le téléphone")
raise SystemExit(1 if ecarts else 0)
