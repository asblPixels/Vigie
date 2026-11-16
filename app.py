"""Vigie — copilote anti-arnaque de Pixel's ASBL (prototype).

Lancement :  python3 app.py   puis ouvrir http://127.0.0.1:5000
Tout reste sur l'ordinateur : OCR avec Tesseract, explication avec Ollama (facultatif).

Configuration (variables d'environnement, toutes facultatives) :
  VIGIE_MODELE       modèle Ollama            (défaut : qwen2.5:3b)
  VIGIE_OLLAMA       adresse d'Ollama         (défaut : http://127.0.0.1:11434)
  VIGIE_HOTE         adresse d'écoute         (défaut : 127.0.0.1 ; 0.0.0.0 = accès smartphone)

Utiliser Vigie depuis un iPhone ou un Android (même Wi-Fi que le PC) :
  python3 app.py --telephone      -> affiche l'adresse et un QR code à scanner
  VIGIE_PORT         port                     (défaut : 5000)
  VIGIE_TESSERACT    commande Tesseract       (défaut : tesseract)

Pixel's ASBL — Boussu — licence GPL-3.0
"""
import argparse
import json
import os
import socket
import subprocess
import tempfile
import urllib.request

from flask import Flask, Response, render_template_string, request

from regles import CONSEILS, analyser

try:  # facultatif : améliore la lecture des photos prises au téléphone
    from PIL import Image, ImageOps
except ImportError:
    Image = None

MODELE = os.environ.get("VIGIE_MODELE", "qwen2.5:3b")
OLLAMA = os.environ.get("VIGIE_OLLAMA", "http://127.0.0.1:11434")
TESSERACT = os.environ.get("VIGIE_TESSERACT", "tesseract")  # Windows : chemin complet de tesseract.exe
TAILLE_MAX = 10 * 1024 * 1024  # 10 Mo

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = TAILLE_MAX


def preparer_photo(chemin: str) -> str:
    """Rend une photo de téléphone plus lisible pour l'OCR : redressée (EXIF), en niveaux de gris,
    agrandie si petite, contrastée, et inversée si c'est un écran en mode sombre."""
    if Image is None:
        return chemin
    try:
        with Image.open(chemin) as brut:
            im = ImageOps.exif_transpose(brut).convert("L")
        cote = max(im.size)
        if cote < 1600:
            k = 1600 / cote
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        if sum(im.resize((64, 64)).getdata()) / 4096 < 110:  # écran sombre, texte clair
            im = ImageOps.invert(im)
        im = ImageOps.autocontrast(im, cutoff=1)
        sortie = chemin + ".png"
        im.save(sortie)
        return sortie
    except Exception:
        return chemin


def lire_image(fichier) -> str:
    """OCR local avec Tesseract (français). Les images sont supprimées juste après."""
    suffixe = os.path.splitext(fichier.filename or "")[1].lower() or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffixe, delete=False) as tmp:
        fichier.save(tmp.name)
        chemin = tmp.name
    prepare = preparer_photo(chemin)
    try:
        res = subprocess.run([TESSERACT, prepare, "stdout", "-l", "fra"],
                             capture_output=True, text=True, timeout=60)
        return res.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return ""
    finally:
        for f in {chemin, prepare}:
            if os.path.exists(f):
                os.remove(f)


def expliquer_ia(texte: str, resultat: dict) -> str | None:
    """Explication en langage simple par l'IA locale. Retourne None si Ollama est absent."""
    mots = {"rouge": "ARNAQUE PROBABLE", "orange": "PRUDENCE", "vert": "AUCUN SIGNE CONNU D'ARNAQUE"}
    consigne = (
        "Tu aides une personne âgée, peu à l'aise avec le numérique, en Belgique. "
        "Réponds en français très simple, phrases courtes, vouvoiement, sans jargon, 80 mots maximum.\n"
        f"Le verdict est déjà fixé : {mots[resultat['verdict']]}. Tu ne dois PAS le contredire "
        "ni dire que le message est sûr.\n"
        "Écris exactement deux parties :\n"
        "Ce que c'est : (une ou deux phrases sur le type de message)\n"
        "Pourquoi : (une ou deux phrases, en t'appuyant sur les indices ci-dessous)\n"
        f"Indices trouvés : {'; '.join(resultat['raisons']) or 'aucun'}\n"
        f"Message reçu :\n\"\"\"\n{texte[:3000]}\n\"\"\""
    )
    corps = json.dumps({"model": MODELE, "prompt": consigne, "stream": False,
                        "options": {"temperature": 0.2}}).encode()
    req = urllib.request.Request(f"{OLLAMA}/api/generate", data=corps,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as rep:
            return json.loads(rep.read()).get("response", "").strip() or None
    except Exception:
        return None


@app.route("/", methods=["GET", "POST"])
def accueil():
    contexte = {"resultat": None,
                "texte": "", "erreur": None, "ia": None, "conseils": []}
    if request.method == "POST":
        texte = (request.form.get("texte") or "").strip()
        # deux champs possibles (appareil photo ou galerie) : on prend le premier rempli
        image = next((f for f in request.files.getlist("image") if f and f.filename), None)
        if image:
            lu = lire_image(image)
            if not lu:
                contexte["erreur"] = ("Je n'ai pas réussi à lire l'image. Essayez une photo plus nette, "
                                      "ou recopiez le message dans la case.")
            texte = (texte + "\n" + lu).strip()
        if texte:
            res = analyser(texte)
            contexte.update(resultat=res, texte=texte, conseils=CONSEILS[res["verdict"]],
                            ia=expliquer_ia(texte, res) if request.form.get("ia") != "non" else None)
        elif not contexte["erreur"]:
            contexte["erreur"] = "Collez un message ou choisissez une photo, puis appuyez sur «\u00a0Vérifier le message\u00a0»."
    return render_template_string(PAGE, **contexte)


MANIFESTE = {
    "name": "Vigie — Est-ce une arnaque ?",
    "short_name": "Vigie",
    "description": "Vérifiez gratuitement si un message est une arnaque.",
    "lang": "fr-BE",
    "start_url": "/",
    "scope": "/",
    "display": "standalone",
    "background_color": "#F3F6F7",
    "theme_color": "#0E2A38",
    "icons": [
        {"src": "/static/icone-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "/static/icone-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "/static/icone-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
        {"src": "/static/icone-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}

# Service worker : rend l'app installable et affiche un message clair si le PC n'est pas joignable.
SERVICE_WORKER = """const CACHE='vigie-v3';
const FICHIERS=['/hors-ligne','/static/logo-icone.svg','/static/logo-icone-sombre.svg','/static/icone-192.png','/static/vigie.css'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FICHIERS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==CACHE).map(n=>caches.delete(n)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/hors-ligne')));}
  else if(e.request.method==='GET'&&e.request.url.includes('/static/')){e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));}
});"""

HORS_LIGNE = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Vigie — hors ligne</title>
<style>body{margin:0;font-family:'Atkinson Hyperlegible Next','Atkinson Hyperlegible',Cantarell,'Noto Sans',system-ui,sans-serif;font-size:20px;line-height:1.5;background:#F2F5F6;color:#0E2A38;border-top:5px solid #007A7A}
main{max-width:560px;margin:0 auto;padding:40px 20px;text-align:center}img{width:88px;height:88px}h1{font-size:28px}
a{display:block;margin-top:24px;padding:18px;border-radius:12px;background:#0E2A38;color:#fff;font-weight:700;text-decoration:none}</style></head>
<body><main><img src="/static/logo-icone.svg" alt=""><h1>Vigie n'est pas joignable</h1>
<p>Vérifiez que l'ordinateur où Vigie est installée est allumé, et que votre téléphone est sur le même Wi-Fi.</p>
<p>En attendant : ne cliquez sur aucun lien et ne donnez aucun code.</p>
<a href="/">Réessayer</a></main></body></html>"""


@app.route("/manifest.webmanifest")
def manifeste():
    return Response(json.dumps(MANIFESTE, ensure_ascii=False), mimetype="application/manifest+json")


@app.route("/sw.js")
def service_worker():
    return Response(SERVICE_WORKER, mimetype="text/javascript", headers={"Cache-Control": "no-cache"})


@app.route("/hors-ligne")
def hors_ligne():
    return HORS_LIGNE


@app.errorhandler(413)
def trop_gros(_):
    return render_template_string(PAGE, resultat=None,
                                  texte="", ia=None, conseils=[],
                                  erreur="La photo est trop lourde (10 Mo maximum)."), 413


PAGE = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0E2A38">
<meta name="description" content="Vigie : vérifiez gratuitement si un message est une arnaque.">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/static/logo-icone.svg" type="image/svg+xml">
<link rel="icon" href="/static/icone-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/static/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Vigie">
<title>{% if resultat %}Résultat — {% endif %}Vigie</title>
<link rel="stylesheet" href="/static/vigie.css"></head><body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
 <symbol id="i-bouclier" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m8.5 12 2.5 2.5 4.5-5"/></symbol>
 <symbol id="i-tel" viewBox="0 0 24 24"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8Z"/></symbol>
 <symbol id="i-coller" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4" stroke-linecap="round"/></g></symbol>
 <symbol id="i-photo" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></g></symbol>
 <symbol id="i-galerie" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.6"/><path d="m4.5 18 5-5 3.5 3.5 2.5-2.5 4 4" stroke-linecap="round"/></g></symbol>
 <symbol id="i-danger" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/><path stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="m9.5 9.5 5 5m0-5-5 5"/></symbol>
 <symbol id="i-attention" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3.5 2.5 20h19L12 3.5Z"/><path stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 10v4.5M12 17.2v.1"/></symbol>
 <symbol id="i-ok" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m8 12.5 2.8 2.8L16.5 9.5"/></symbol>
 <symbol id="i-son" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10H4Z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/></g></symbol>
 <symbol id="i-retour" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 12H5m6-6-6 6 6 6"/></symbol>
</defs></svg>

<header class="bandeau"><div class="bandeau-int">
  <a class="marque" href="/" aria-label="Vigie, accueil">
    <picture><source media="(prefers-color-scheme: dark)" srcset="/static/logo-icone-sombre.svg"><img src="/static/logo-icone.svg" alt="" width="44" height="44"></picture>
    <span><b>Vigie</b><small>Anti-arnaque</small></span>
  </a>
</div></header>

<div class="page">
<main>
{% if resultat %}
  {# ---------- ÉCRAN RÉSULTAT : verdict, puis quoi faire, puis détails ---------- #}
  <section class="verdict {{ resultat.verdict }}" id="reponse" aria-live="polite">
    <div class="verdict-tete">
      {% if resultat.verdict == 'rouge' %}<svg aria-hidden="true"><use href="#i-danger"/></svg>
      {% elif resultat.verdict == 'orange' %}<svg aria-hidden="true"><use href="#i-attention"/></svg>
      {% else %}<svg aria-hidden="true"><use href="#i-ok"/></svg>{% endif %}
      <div>
        {% if resultat.verdict == 'rouge' %}
          <div class="verdict-etiquette">Arnaque probable</div><h1>Ne faites rien avec ce message</h1>
        {% elif resultat.verdict == 'orange' %}
          <div class="verdict-etiquette">Prudence</div><h1>Vérifiez avant d'agir</h1>
        {% else %}
          <div class="verdict-etiquette">Aucun signe connu</div><h1>Pas de piège détecté</h1>
        {% endif %}
      </div>
    </div>
    {% if resultat.verdict == 'rouge' %}<p>Ce message ressemble fortement à une arnaque. Ne cliquez pas, ne répondez pas.</p>
    {% elif resultat.verdict == 'orange' %}<p>Certains indices sont inquiétants. Ne cliquez pas sur le lien tant que vous n'avez pas vérifié.</p>
    {% else %}<p>Vigie n'a trouvé aucun indice d'arnaque. Ce n'est pas une garantie : restez attentif.</p>{% endif %}
  </section>

  {% if resultat.verdict != 'vert' %}
  {% endif %}

  <section class="carte">
    <h2>Que faire maintenant ?</h2>
    <ol class="etapes">{% for c in conseils[:3] %}<li>{{ c }}</li>{% endfor %}</ol>
    {% if conseils|length > 3 %}
    <div class="encadre">{% for c in conseils[3:] %}<p>{{ c }}</p>{% endfor %}</div>
    {% endif %}
  </section>

  {% if ia or resultat.raisons %}
  <details {% if resultat.verdict != 'vert' %}open{% endif %}>
    <summary>Pourquoi Vigie pense cela</summary>
    <div class="details-corps">
      {% if ia %}<p class="ia">{{ ia }}</p>{% endif %}
      {% if resultat.raisons %}<ul>{% for r in resultat.raisons[:3] %}<li>{{ r }}</li>{% endfor %}</ul>{% endif %}
    </div>
  </details>
  {% endif %}

  <details>
    <summary>Voir le message analysé</summary>
    <div class="details-corps"><p class="message-brut">{{ texte }}</p></div>
  </details>

  <div class="actions-duo">
    <button class="btn btn-secondaire" type="button" onclick="lire()"><svg aria-hidden="true"><use href="#i-son"/></svg>Écouter</button>
    <a class="btn btn-secondaire" href="/"><svg aria-hidden="true"><use href="#i-retour"/></svg>Autre message</a>
  </div>

{% else %}
  {# ---------- ÉCRAN D'ACCUEIL : une seule tâche ---------- #}
  <span class="surtitre">Vérification anti-arnaque</span>
  <h1>Un message vous inquiète ?</h1>
  <p class="intro">Collez-le, ou prenez-le en photo avec votre téléphone. Vigie vous dit s'il est dangereux et quoi faire.</p>

  {% if erreur %}
  <div class="alerte" role="alert"><svg aria-hidden="true"><use href="#i-attention"/></svg><span>{{ erreur }}</span></div>
  {% endif %}

  <form class="carte" method="post" enctype="multipart/form-data" id="formulaire">
    <label class="btn btn-camera" for="camera"><svg aria-hidden="true"><use href="#i-photo"/></svg>Prendre en photo</label>
    <input type="file" id="camera" name="image" accept="image/*" capture="environment">
    <p class="aide-photo">Photographiez l'écran ou le courrier, même s'il appartient à quelqu'un d'autre.</p>
    <div class="photo-choisie" id="photo-choisie"><img id="photo-apercu" alt="Aperçu de la photo choisie"><span id="photo-nom">Photo prête</span><button type="button" id="photo-retirer">Retirer</button></div>
    <div class="ou"><span>ou</span></div>
    <label class="titre" for="texte">Collez le texte du message</label>
    <textarea id="texte" name="texte" placeholder="Exemple : « Votre colis est en attente, payez 1,99 € ici… »">{{ texte }}</textarea>
    <div class="outils">
      <button class="btn btn-secondaire" type="button" id="coller"><svg aria-hidden="true"><use href="#i-coller"/></svg>Coller</button>
      <label class="btn btn-secondaire" for="galerie"><svg aria-hidden="true"><use href="#i-galerie"/></svg>Capture d'écran</label>
      <input type="file" id="galerie" name="image" accept="image/*">
    </div>
    <button class="btn btn-principal" type="submit" id="verifier"><svg aria-hidden="true"><use href="#i-bouclier"/></svg>Vérifier le message</button>
  </form>
{% endif %}
</main>

<footer class="pied">
  <p class="signature">Vigie · logiciel libre GPL-3.0</p>
  <p>Gratuit, sans compte, sans publicité. Rien n'est envoyé sur Internet. Vigie est une aide, pas une garantie.</p>

  <details>
    <summary>Numéros utiles</summary>
    <ul class="numeros">
      <li>Carte ou code bancaire donné : <b>Card Stop 078 170 170</b></li>
      <li>Message suspect : <b>suspect@safeonweb.be</b></li>
      <li>Urgence police : <b>101</b></li>
    </ul>
  </details>
</footer>
</div>

<script>
(function(){
  var f=document.getElementById('formulaire'); if(!f) return;
  var t=document.getElementById('texte'), cam=document.getElementById('camera'), gal=document.getElementById('galerie');
  var boite=document.getElementById('photo-choisie'), apercu=document.getElementById('photo-apercu');
  var choisi=null, urlApercu=null;
  document.getElementById('coller').addEventListener('click',function(){
    if(navigator.clipboard&&navigator.clipboard.readText){
      navigator.clipboard.readText().then(function(x){if(x){t.value=x;}t.focus();}).catch(function(){t.focus();});
    } else { t.focus(); }
  });
  function montrer(fichier){
    if(urlApercu){URL.revokeObjectURL(urlApercu);urlApercu=null;}
    choisi=fichier||null;
    if(choisi){urlApercu=URL.createObjectURL(choisi);apercu.src=urlApercu;boite.classList.add('visible');}
    else{apercu.removeAttribute('src');boite.classList.remove('visible');}
  }
  [cam,gal].forEach(function(champ){
    champ.addEventListener('change',function(){
      var autre=champ===cam?gal:cam; autre.value='';
      montrer(champ.files&&champ.files[0]);
      // Une photo = un résultat : l'analyse démarre seule, sans chercher le bouton « Vérifier ».
      if(choisi){ if(f.requestSubmit){f.requestSubmit();} else {f.dispatchEvent(new Event('submit',{cancelable:true}));} }
    });
  });
  document.getElementById('photo-retirer').addEventListener('click',function(){cam.value='';gal.value='';montrer(null);});
  // Photo de téléphone : redressée, réduite à 2000 px et convertie en JPEG avant l'envoi (plus rapide, moins de 10 Mo).
  function compresser(fichier){
    return new Promise(function(ok,ko){
      var url=URL.createObjectURL(fichier), im=new Image();
      im.onload=function(){
        var k=Math.min(1,2000/Math.max(im.naturalWidth,im.naturalHeight)), c=document.createElement('canvas');
        c.width=Math.round(im.naturalWidth*k); c.height=Math.round(im.naturalHeight*k);
        c.getContext('2d').drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(url);
        c.toBlob(function(b){b?ok(b):ko();},'image/jpeg',0.9);
      };
      im.onerror=function(){URL.revokeObjectURL(url);ko();};
      im.src=url;
    });
  }
  var envoye=false;
  f.addEventListener('submit',function(e){
    if(envoye||!window.fetch||!window.FormData) return; // ancien navigateur : envoi classique
    e.preventDefault(); envoye=true;
    var b=document.getElementById('verifier');
    b.disabled=true; b.lastChild.textContent='Analyse en cours… (jusqu’à 30 secondes)';
    document.getElementById('photo-nom').textContent=choisi?'Analyse de la photo…':'';
    var fd=new FormData(); fd.append('texte',t.value);
    var prep=choisi?compresser(choisi).catch(function(){return choisi;}):Promise.resolve(null);
    prep.then(function(blob){
      if(blob){fd.append('image',blob,blob===choisi?(choisi.name||'photo'):'photo.jpg');}
      return fetch(f.getAttribute('action')||'/',{method:'POST',body:fd});
    }).then(function(r){return r.text();}).then(function(html){
      document.open(); document.write(html); document.close(); window.scrollTo(0,0);
    }).catch(function(){ f.submit(); });
  });
})();
if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){});}
function lire(){try{var z=document.getElementById('reponse').innerText+'. '+document.querySelector('ol.etapes').innerText;var u=new SpeechSynthesisUtterance(z);u.lang='fr-BE';u.rate=.9;speechSynthesis.cancel();speechSynthesis.speak(u);}catch(e){}}
</script>
</body></html>"""

def adresse_locale() -> str:
    """Adresse du PC sur le Wi-Fi (aucun paquet n'est envoyé)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("192.168.1.1", 9))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


if __name__ == "__main__":
    opts = argparse.ArgumentParser(description="Vigie — est-ce une arnaque ?")
    opts.add_argument("--telephone", action="store_true",
                      help="ouvrir Vigie aux téléphones connectés au même Wi-Fi")
    args = opts.parse_args()
    port = int(os.environ.get("VIGIE_PORT", "5000"))
    hote = "0.0.0.0" if args.telephone else os.environ.get("VIGIE_HOTE", "127.0.0.1")

    print(f"\nVigie est prête. Sur cet ordinateur : http://127.0.0.1:{port}")
    if hote != "127.0.0.1":
        url = f"http://{adresse_locale()}:{port}"
        print(f"Sur un iPhone ou un Android connecté au même Wi-Fi : {url}")
        try:
            import qrcode
            qr = qrcode.QRCode(border=1)
            qr.add_data(url)
            print("Scannez ce QR code avec l'appareil photo du téléphone :")
            qr.print_ascii(invert=True)
        except ImportError:
            print("(Installez « qrcode » avec pip pour afficher un QR code à scanner.)")
        print("Astuce : sur le téléphone, ajoutez la page à l'écran d'accueil.")
    print("Pour arrêter : Ctrl+C\n")
    app.run(host=hote, port=port, debug=False)
