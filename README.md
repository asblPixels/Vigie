<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="static/logo-sombre.svg">
  <img src="static/logo.svg" alt="Vigie, par Pixel's ASBL" width="420">
</picture>

### Le copilote anti-arnaque, gratuit et hors ligne,<br>pour celles et ceux qui sont loin du numérique.

**Français** · [Nederlands](README.nl.md) · [Italiano](README.it.md) · [Deutsch](README.de.md)

![Licence](https://img.shields.io/badge/licence-GPL--3.0-0E2A38?style=flat-square)
![Android](https://img.shields.io/badge/Android-autonome-007A7A?style=flat-square)
![Linux](https://img.shields.io/badge/Linux-Fedora-007A7A?style=flat-square)
![Hors ligne](https://img.shields.io/badge/fonctionne-hors%20ligne-14B8A6?style=flat-square)
![Sans compte](https://img.shields.io/badge/sans-compte%20ni%20pub-14B8A6?style=flat-square)

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/capture-accueil-dark.png">
  <img src="docs/capture-accueil-light.png" alt="Écran d'accueil de Vigie" width="260">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/capture-arnaque-dark.png">
  <img src="docs/capture-arnaque-light.png" alt="Vigie signale une arnaque probable" width="260">
</picture>

</div>

> **Dépôt privé.** Vigie est en cours de développement et n'est pas encore accessible au public.

## En bref

Un SMS, un courriel ou un courrier vous inquiète ? Vous le **photographiez** ou vous le **collez** dans Vigie. En quelques secondes, Vigie répond par l'un de trois verdicts, en grands caractères et en langage simple :

| Verdict | Ce que Vigie vous dit |
|---|---|
| **Arnaque probable** | Ne faites rien avec ce message. Voici les trois gestes à faire. |
| **Prudence** | Des indices inquiètent. Vérifiez avant d'agir. |
| **Aucun signe connu** | Rien de suspect trouvé, mais restez attentif : ce n'est pas une garantie. |

Vigie est pensée pour les personnes éloignées des outils numériques : un seul écran, un seul geste, de gros boutons, une police conçue pour la lisibilité, et une lecture à voix haute du résultat.

## Pourquoi Vigie

- **Gratuite et libre.** Pas d'abonnement, pas de compte, pas de publicité. Licence GPL-3.0.
- **Hors ligne et privée.** Le message est analysé sur l'appareil. Il n'est envoyé nulle part.
- **Transparente.** Les verdicts viennent de règles lisibles (`regles.py`), pas d'une boîte noire. Une IA locale facultative peut expliquer le résultat, jamais le décider.
- **Pour tout le monde.** On peut photographier le message d'une autre personne : un parent, un voisin, un courrier reçu.
- **Une personne de confiance, choisie par vous.** En cas de doute, Vigie propose d'appeler la personne que vous avez vous-même choisie dans vos contacts. Personne d'autre.

## Installer

### Android (application autonome)

L'application contient tout : règles, lecture des photos, voix. Elle fonctionne sans ordinateur et sans Internet.

1. Sur GitHub : onglet **Actions**, dernière exécution **Application Android**, section **Artifacts**, puis téléchargez **Vigie-android**.
2. Ouvrez le fichier `Vigie-android.apk` sur le téléphone. Android demandera d'autoriser l'installation depuis cette source : acceptez pour cette fois.
3. Ouvrez Vigie. L'appareil photo n'est demandé que lorsque vous touchez « Prendre en photo ».

### Ordinateur sous Fedora (et autres Linux)

```bash
git clone https://github.com/asblPixels/vigie.git ~/vigie && cd ~/vigie
bash installer_fedora.sh      # installe Python, Tesseract (français) et les dépendances
python3 app.py                # puis ouvrez http://127.0.0.1:5000
```

### iPhone, ou un téléphone proche du PC

```bash
python3 app.py --telephone    # affiche une adresse et un QR code à scanner (même Wi-Fi)
```

Ouvrez l'adresse dans Safari, puis « Ajouter à l'écran d'accueil ». Une application iPhone native n'existe pas encore (voir la feuille de route).

## Votre personne de confiance

Vigie ne propose jamais d'appeler un numéro qu'elle aurait choisi à votre place. Dans **Réglages → Ma personne de confiance**, vous choisissez un contact de votre répertoire, ou vous saisissez un numéro à la main. Il est stocké uniquement sur votre appareil.

Sur Android, la sélection passe par le sélecteur de contacts du système : Vigie ne reçoit que le contact choisi, et n'a **pas** l'autorisation de lire votre répertoire.

## Vie privée

| Donnée | Où elle va |
|---|---|
| Texte du message | Analysé sur l'appareil, jamais envoyé |
| Photo | Lue sur l'appareil ; Vigie n'en conserve aucune copie |
| Personne de confiance | Stockée sur l'appareil uniquement |
| Statistiques, cookies, comptes | Aucun |

L'application Android impose en outre une politique de sécurité (CSP) qui interdit tout chargement de contenu extérieur, et elle n'embarque aucun traceur.

## Sous le capot

| Élément | Technologie |
|---|---|
| Détection | Règles lisibles : marques et domaines officiels, raccourcisseurs de liens, extensions suspectes, vocabulaire de pression (`regles.py`) |
| Même verdict partout | Les règles sont exportées vers le téléphone (`regles.json`) ; `outils/verifier_parite.py` prouve que PC et Android répondent à l'identique |
| Lecture des photos | Tesseract (PC) · Tesseract.js embarqué avec la langue française (Android) |
| Application Android | Capacitor 8, sélecteur de contacts natif, synthèse vocale |
| Interface | Une seule feuille de style pour le PC et Android, thème clair et sombre, police Atkinson Hyperlegible Next |
| IA facultative (PC) | Ollama en local (`qwen2.5:3b`) : explique, ne décide jamais |

## Développer

```bash
python3 test_vigie.py                 # 11 messages types
python3 outils/verifier_parite.py     # PC et téléphone donnent le même verdict
python3 outils/exporter_regles.py     # après toute modification de regles.py
python3 outils/generer_logos.py       # logos clair et sombre

cd mobile && npm ci && npm run sync   # prépare l'application Android
```

L'APK est construit par GitHub Actions (`.github/workflows/android.yml`) à chaque modification, et attaché à une version quand on pousse une étiquette `v…`.

## Feuille de route

- [x] Prototype PC, interface repensée, appareil photo iOS et Android
- [x] Application Android autonome (règles, lecture des photos, voix, contact de confiance)
- [ ] Test sur appareils réels et signature de l'APK pour distribution
- [ ] Application iPhone
- [ ] Interface en néerlandais, italien et allemand
- [ ] Règles enrichies avec les campagnes d'arnaques belges récentes

## Qui est derrière Vigie

Vigie est un logiciel libre dont le **concept a été conçu par Pixel's ASBL** (Boussu, Belgique), une association qui accompagne les personnes dans leur vie numérique. Pixel's ASBL ne reçoit aucun message analysé et n'assure pas d'assistance par l'application. Pour une question sur le projet lui-même : Info@asblpixels.be.

Vigie s'appuie sur [Tesseract](https://github.com/tesseract-ocr/tesseract) et [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0), [Capacitor](https://capacitorjs.com) (MIT), [Flask](https://flask.palletsprojects.com) (BSD-3) et la police [Atkinson Hyperlegible Next](https://brailleinstitute.org/freefont) du Braille Institute (SIL OFL 1.1).

## Contribuer et signaler un problème

Voir [CONTRIBUTING.md](CONTRIBUTING.md) et [SECURITY.md](SECURITY.md). Une arnaque qui n'est pas détectée ? Ouvrez un ticket avec le texte du message, **sans** données personnelles.

## Licence

[GPL-3.0-or-later](LICENSE) · © Pixel's ASBL
