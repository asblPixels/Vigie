#!/usr/bin/env python3
"""Génère mobile/www/i18n.js à partir de outils/traductions.py."""
import json
import pathlib
import sys

ici = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ici))
from traductions import TABLE  # noqa: E402

LANGUES = ["fr", "nl", "it", "de"]
dico = {l: {} for l in LANGUES}
for cle, valeurs in TABLE.items():
    assert len(valeurs) == 4, cle
    for l, v in zip(LANGUES, valeurs):
        dico[l][cle] = v
sortie = ici.parent / "mobile" / "www" / "i18n.js"
sortie.write_text(
    "/* Généré par outils/exporter_i18n.py : ne pas modifier à la main. Vigie · GPL-3.0 */\n"
    "window.VIGIE_I18N = " + json.dumps(dico, ensure_ascii=False, indent=1) + ";\n",
    encoding="utf-8")
print(f"{len(TABLE)} clés x {len(LANGUES)} langues -> {sortie}")
