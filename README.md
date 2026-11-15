<p align="center"><img src="static/logo.svg" alt="Vigie, par Pixel's ASBL" width="340"></p>

<p align="center">
<b>Français</b> · <a href="README.nl.md">Nederlands</a> · <a href="README.it.md">Italiano</a> · <a href="README.de.md">Deutsch</a>
</p>

<p align="center"><b>Est-ce une arnaque ? Vérifiez en une photo.</b><br>
Gratuit · Sans publicité · Rien n'est envoyé sur Internet</p>

---

> **Statut :** prototype en test. Dépôt privé, ne pas diffuser.
> **Langue de l'application :** pour l'instant en français uniquement.

## En bref

Vous recevez un SMS, un mail ou un courrier qui vous inquiète ? Ouvrez **Vigie**, collez le message ou prenez-le en photo. Vigie vous répond en quelques secondes :

- 🔴 **Arnaque probable** : ne faites rien.
- 🟠 **Prudence** : vérifiez avant d'agir.
- 🟢 **Aucun signe connu** : rien de suspect trouvé (ce n'est pas une garantie).

Vous voyez aussi **quoi faire** (3 étapes simples), **pourquoi** Vigie pense cela, et un bouton pour **appeler une personne de confiance**.

<p align="center">
<img src="docs/capture-accueil.png" alt="Écran d'accueil" width="250">
<img src="docs/capture-arnaque.png" alt="Résultat : arnaque probable" width="250">
</p>

## Comment ça marche

Vigie s'installe **une fois** sur un ordinateur de la maison. Ensuite :

- **Sur l'ordinateur** : on l'ouvre dans le navigateur (Firefox, Chrome, Edge, Safari).
- **Sur le téléphone ou la tablette** (iPhone, iPad, Android) : on l'ouvre par le Wi-Fi de la maison, en scannant un QR code.

Tout se passe chez vous. Les messages et les photos ne partent pas sur Internet et ne sont pas conservés.

## Installation

Choisissez votre système. Chaque étape se fait une seule fois.

### Linux Fedora (le plus simple)

1. Téléchargez Vigie : bouton vert **Code** → **Download ZIP**, puis décompressez le fichier.
2. Ouvrez un terminal dans le dossier de Vigie.
3. Tapez :
   ```bash
   bash installer_fedora.sh
   ```
   Sur un ordinateur ancien ou avec peu de mémoire, tapez plutôt `bash installer_fedora.sh --sans-ia`.

### Linux Ubuntu ou Debian

```bash
sudo apt install tesseract-ocr tesseract-ocr-fra python3-pip
python3 -m pip install --user -r requirements.txt
```

### Windows 10 ou 11

1. Installez **Python** depuis [python.org](https://www.python.org/downloads/). Cochez **« Add Python to PATH »**.
2. Installez **Tesseract** (lecture des photos) depuis [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki). Pendant l'installation, cochez la langue **French**.
3. Ouvrez **PowerShell** dans le dossier de Vigie et tapez :
   ```powershell
   py -m pip install -r requirements.txt
   ```

### macOS

Avec [Homebrew](https://brew.sh) :

```bash
brew install tesseract tesseract-lang python
python3 -m pip install -r requirements.txt
```

### L'IA locale (facultative)

Elle explique le résultat avec des mots simples. Elle demande un ordinateur avec **8 Go de mémoire**.

1. Installez [Ollama](https://ollama.com/download).
2. Tapez : `ollama pull qwen2.5:3b`

Sans l'IA, Vigie fonctionne quand même : le verdict ne dépend jamais d'elle.

## Utilisation

### Sur l'ordinateur

```bash
python3 app.py
```

Sous Windows : `py app.py`. Si Windows ne trouve pas Tesseract, tapez d'abord :
`$env:VIGIE_TESSERACT = "C:\Program Files\Tesseract-OCR\tesseract.exe"`

Ouvrez ensuite **http://127.0.0.1:5000** dans le navigateur.

### Sur un iPhone, un iPad ou un Android

1. Le téléphone et l'ordinateur doivent être sur le **même Wi-Fi**.
2. Sur l'ordinateur, tapez : `python3 app.py --telephone`
3. Un **QR code** s'affiche. Visez-le avec l'appareil photo du téléphone et ouvrez le lien.
4. Conseil : ajoutez Vigie à l'écran d'accueil.
   - **iPhone / iPad** (Safari) : bouton Partager → **Sur l'écran d'accueil**.
   - **Android** (Chrome) : menu ⋮ → **Ajouter à l'écran d'accueil**.

### Vérifier un message

- **Prendre en photo** : l'appareil photo s'ouvre. Photographiez l'écran ou le courrier, même s'il appartient à quelqu'un d'autre. Le résultat arrive tout seul.
- **Capture d'écran** : choisissez une image déjà enregistrée.
- **Coller** : collez le texte du message, puis appuyez sur **Vérifier le message**.

## Réglages

On peut changer la personne à appeler, par exemple pour un proche :

```bash
VIGIE_AIDANT_NOM="Ma fille Julie" VIGIE_AIDANT_TEL="+32470000000" python3 app.py
```

| Réglage | À quoi il sert | Par défaut |
| --- | --- | --- |
| `VIGIE_AIDANT_NOM` | Nom sur le bouton d'appel | Pixel's ASBL |
| `VIGIE_AIDANT_TEL` | Numéro appelé | +32456960328 |
| `VIGIE_MODELE` | Modèle d'IA | qwen2.5:3b |
| `VIGIE_OLLAMA` | Adresse de l'IA | http://127.0.0.1:11434 |
| `VIGIE_TESSERACT` | Emplacement de Tesseract | tesseract |
| `VIGIE_HOTE` | `0.0.0.0` pour le réseau de la maison | 127.0.0.1 |
| `VIGIE_PORT` | Port | 5000 |

## En cas de problème

| Problème | Solution |
| --- | --- |
| Le téléphone n'ouvre pas la page | Même Wi-Fi ? Ordinateur allumé ? Sous Fedora : `sudo firewall-cmd --add-port=5000/tcp` |
| « Je n'ai pas réussi à lire l'image » | Reprenez la photo de face, bien éclairée, sans reflet. Ou collez le texte. |
| Pas d'explication de l'IA | Ollama n'est pas lancé : ce n'est pas grave, le verdict reste fiable. |
| « Vigie n'est pas joignable » | L'ordinateur est éteint ou le téléphone n'est plus sur le Wi-Fi de la maison. |

## Numéros utiles (Belgique)

- Vous avez donné un code ou les données de votre carte : **Card Stop 078 170 170**, puis votre banque.
- Transférez les messages suspects à **suspect@safeonweb.be**.
- Urgence police : **101**.

## Sécurité et vie privée

- Tout fonctionne **sur votre ordinateur**. Les photos sont effacées juste après la lecture.
- Avec `--telephone`, toute personne connectée **au même Wi-Fi** peut ouvrir Vigie. Utilisez ce mode à la maison, jamais sur un Wi-Fi public.
- Vigie est **une aide, pas une garantie**. En cas de doute : ne faites rien et appelez une personne de confiance.

## Pour les techniciens

- `app.py` : application web (Flask), lecture des photos, IA, PWA.
- `regles.py` : règles anti-arnaque et domaines officiels belges. **Seules ces règles décident du verdict** : 5 points ou plus donnent rouge, de 2 à 4 donnent orange.
- `test_vigie.py` : tests (`python3 test_vigie.py`). Ajoutez-y chaque nouvelle arnaque, anonymisée, et de vrais messages légitimes.
- Photos : le téléphone les réduit (environ 70 Ko), l'ordinateur les redresse, gère le mode sombre et les lit avec Tesseract.
- Installer Vigie comme une vraie application sur le téléphone (hors ligne) demandera un accès **HTTPS**, à prévoir pour la version publique.

**Couleurs Pixel's :** bleu nuit `#0E2A38` · turquoise `#008080` · menthe `#5EEAD4`. Logo : `static/logo.svg`.

## Licence et contact

Logiciel libre sous licence **GPL-3.0** (voir [LICENSE](LICENSE)).

**Pixel's ASBL** · Rue Alfred Dendal 56, 7300 Boussu · info@asblpixels.be · +32 456 96 03 28
