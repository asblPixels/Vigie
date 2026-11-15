"""Exporte les règles de regles.py vers mobile/www/regles.json (source unique pour l'app Android).
Usage : python3 outils/exporter_regles.py   (à relancer après chaque modification de regles.py)"""
import json
import os
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RACINE)
import regles  # noqa: E402

donnees = {
    "seuil_rouge": regles.SEUIL_ROUGE,
    "seuil_orange": regles.SEUIL_ORANGE,
    "marques": regles.MARQUES,
    "raccourcisseurs": sorted(regles.RACCOURCISSEURS),
    "tld_suspects": sorted(regles.TLD_SUSPECTS),
    "regles_texte": [{"motif": m, "points": p, "raison": r} for m, p, r in regles.REGLES_TEXTE],
    "url_re": regles.URL_RE.pattern,
    "conseils": regles.CONSEILS,
}
sortie = os.path.join(RACINE, "mobile", "www", "regles.json")
with open(sortie, "w", encoding="utf-8") as f:
    json.dump(donnees, f, ensure_ascii=False, indent=1)
print("Règles exportées vers", sortie)
