#!/usr/bin/env python3
"""Génère les logos Vigie (clair / sombre) avec le texte converti en tracés :
le logo s'affiche donc identique partout (GitHub, navigateurs, impression), sans dépendre d'une police installée.
Usage : python3 outils/generer_logos.py"""
import io, pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

R = pathlib.Path(__file__).resolve().parent.parent
POLICES = R / "static" / "fonts"
f800 = TTFont(POLICES / "atkinson-hyperlegible-next-latin-800-normal.woff2")
f700 = TTFont(POLICES / "atkinson-hyperlegible-next-latin-700-normal.woff2")

def tracer(font, texte, taille, x, y, espacement=0.0):
    gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm
    k, d = taille / upm, []
    for c in texte:
        nom = cmap[ord(c)]
        pen = SVGPathPen(gs)
        gs[nom].draw(TransformPen(pen, (k, 0, 0, -k, x, y)))
        d.append(pen.getCommands())
        x += gs[nom].width * k + espacement
    return " ".join(d)

def logo(sombre):
    deg = ("#0B8F8A", "#2DD4BF") if sombre else ("#007A7A", "#14B8A6")
    tuile = ('<rect x="8" y="8" width="496" height="496" rx="108" fill="url(#f)" stroke="#5EEAD4" stroke-width="16"/>'
             if sombre else '<rect width="512" height="512" rx="112" fill="url(#f)"/>')
    titre, sous = ("#FFFFFF", "#5EEAD4") if sombre else ("#0E2A38", "#006464")
    t1 = tracer(f800, "Vigie", 74, 168, 94, -1)
    t2 = tracer(f700, "PAR PIXEL'S ASBL", 21, 171, 130, 1.8)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 160" role="img" aria-label="Vigie, par Pixel's ASBL">
  <defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{deg[0]}"/><stop offset="1" stop-color="{deg[1]}"/></linearGradient></defs>
  <g transform="translate(16 16) scale(.25)">
    {tuile}
    <path d="M256 92 388 142v112c0 88-56 148-132 172-76-24-132-84-132-172V142z" fill="#fff"/>
    <path d="M190 262l46 46 88-96" fill="none" stroke="#0E2A38" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="356" y="84" width="64" height="64" rx="10" fill="#5EEAD4" stroke="#fff" stroke-width="10"/>
  </g>
  <path d="{t1}" fill="{titre}"/>
  <path d="{t2}" fill="{sous}"/>
</svg>
'''
(R / "static" / "logo.svg").write_text(logo(False))
(R / "static" / "logo-sombre.svg").write_text(logo(True))
print("logos générés")
