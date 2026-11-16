<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="static/logo-sombre.svg">
  <img src="static/logo.svg" alt="Vigie, door Pixel's ASBL" width="420">
</picture>

### De gratis, offline anti-oplichtingshulp<br>voor wie weinig thuis is in de digitale wereld.

[Français](README.md) · **Nederlands** · [Italiano](README.it.md) · [Deutsch](README.de.md)

![Licentie](https://img.shields.io/badge/licentie-GPL--3.0-0E2A38?style=flat-square)
![Android](https://img.shields.io/badge/Android-zelfstandig-007A7A?style=flat-square)
![Linux](https://img.shields.io/badge/Linux-Fedora-007A7A?style=flat-square)
![Offline](https://img.shields.io/badge/werkt-offline-14B8A6?style=flat-square)
![Zonder account](https://img.shields.io/badge/zonder-account%20of%20reclame-14B8A6?style=flat-square)

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/capture-accueil-dark.png">
  <img src="docs/capture-accueil-light.png" alt="Startscherm van Vigie" width="260">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/capture-arnaque-dark.png">
  <img src="docs/capture-arnaque-light.png" alt="Vigie meldt waarschijnlijke oplichting" width="260">
</picture>

</div>

> **Privé-repository.** Vigie is in ontwikkeling en nog niet voor het publiek toegankelijk.

## In het kort

Maakt een sms, e-mail of brief u ongerust? **Fotografeer** of **plak** hem in Vigie. Binnen enkele seconden geeft Vigie een van drie uitspraken, in grote letters en eenvoudige taal:

| Uitspraak | Wat Vigie zegt |
|---|---|
| **Waarschijnlijk oplichting** | Doe niets met dit bericht. Dit zijn de drie stappen. |
| **Wees voorzichtig** | Er zijn verdachte signalen. Controleer eerst. |
| **Geen bekende signalen** | Niets verdachts gevonden, maar blijf alert: het is geen garantie. |

Vigie is gemaakt voor mensen die weinig met digitale hulpmiddelen werken: één scherm, één handeling, grote knoppen, een lettertype dat is ontworpen voor leesbaarheid en een voorleesfunctie.

## Waarom Vigie

- **Gratis en vrij.** Geen abonnement, geen account, geen reclame. Licentie GPL-3.0.
- **Offline en privé.** Het bericht wordt op het toestel geanalyseerd en nergens naartoe verstuurd.
- **Transparant.** De uitspraken komen uit leesbare regels (`regles.py`), niet uit een zwarte doos. Een optionele lokale AI kan het resultaat toelichten, nooit bepalen.
- **Voor iedereen.** U mag het bericht van iemand anders fotograferen: een ouder, een buur, een ontvangen brief.

## In de Android-app

- **Geanimeerde analyse**: percentage in grote cijfers, scanbalk over de foto, stappen die u op het scherm volgt.
- Duidelijk **risiconiveau** (laag, middel, hoog) en drie stappen om te doen.
- **Geschiedenis** van gecontroleerde berichten, bewaard op de telefoon, uit te schakelen en met één tik te wissen.
- **Hulp**: wat te doen na een klik, na het geven van codes, na een betaling of na een valse bankoproep; nuttige nummers.
- **Melden aan Safeonweb** en het resultaat **delen** met één tik.
- **Instellingen**: tekstgrootte (3 niveaus), licht, donker of automatisch thema, voorlezen, taal (Frans, Nederlands, Italiaans, Duits).

## Installeren

### Android (zelfstandige app)

De app bevat alles: regels, foto's lezen, stem. Ze werkt zonder computer en zonder internet.

1. Op GitHub: tabblad **Actions**, laatste uitvoering **Application Android**, onderdeel **Artifacts**, en download **Vigie-android**.
2. Open `Vigie-android.apk` op de telefoon. Android vraagt om installatie uit deze bron toe te staan: accepteer dit voor nu.
3. Open Vigie. De camera wordt pas gevraagd wanneer u op "Prendre en photo" (foto nemen) tikt.

### Computer met Fedora (en andere Linux)

```bash
git clone https://github.com/asblPixels/vigie.git ~/vigie && cd ~/vigie
bash installer_fedora.sh      # installeert Python, Tesseract (Frans) en de afhankelijkheden
python3 app.py                # open daarna http://127.0.0.1:5000
```

### iPhone, of een telefoon naast de pc

```bash
python3 app.py --telephone    # toont een adres en een QR-code om te scannen (zelfde wifi)
```

Open het adres in Safari en kies "Zet op beginscherm". Een native iPhone-app bestaat nog niet (zie de routekaart).

## Android-machtigingen

Vigie vraagt het strikte minimum: de **camera**, enkel wanneer u op « Foto nemen » tikt. Geen contacten, microfoon, locatie, opslag, sms of meldingen. Toegang tot internet wordt aangegeven door het technische kader van Android, maar Vigie verstuurt geen gegevens. Alle details staan in de app, onder Instellingen → Over Vigie en juridische vermeldingen (juridische vermeldingen, AVG-rechten, machtigingen).

## Privacy

| Gegeven | Waar het naartoe gaat |
|---|---|
| Tekst van het bericht | Op het toestel geanalyseerd, nooit verstuurd |
| Foto | Op het toestel gelezen; Vigie bewaart er geen kopie van |
| Geschiedenis | Alleen op het toestel, uit te schakelen en te wissen |
| Statistieken, cookies, accounts | Geen |

De Android-app dwingt bovendien een beveiligingsbeleid (CSP) af dat het laden van externe inhoud verbiedt, en bevat geen trackers.

## Onder de motorkap

| Onderdeel | Technologie |
|---|---|
| Detectie | Leesbare regels: officiële merken en domeinen, linkverkorters, verdachte extensies, drukkende woordkeuze (`regles.py`) |
| Overal dezelfde uitspraak | De regels worden naar de telefoon geëxporteerd (`regles.json`); `outils/verifier_parite.py` bewijst dat pc en Android identiek antwoorden |
| Foto's lezen | Tesseract (pc) · ingebouwde Tesseract.js met Franse taaldata (Android) |
| Android-app | Capacitor 8, spraaksynthese |
| Interface | Eén stijlblad voor pc en Android, licht en donker thema, lettertype Atkinson Hyperlegible Next |
| Optionele AI (pc) | Lokale Ollama (`qwen2.5:3b`): licht toe, beslist nooit |

## Ontwikkelen

```bash
python3 test_vigie.py                 # 11 voorbeeldberichten
python3 outils/verifier_parite.py     # pc en telefoon geven dezelfde uitspraak
python3 outils/exporter_regles.py     # na elke wijziging van regles.py
python3 outils/generer_logos.py       # logo's in licht en donker

cd mobile && npm ci && npm run sync   # bereidt de Android-app voor
```

De APK wordt door GitHub Actions gebouwd (`.github/workflows/android.yml`) bij elke wijziging en aan een release gekoppeld wanneer een `v…`-label wordt gepusht.

## Routekaart

- [x] Pc-prototype, nieuw ontwerp, camera op iOS en Android
- [x] Zelfstandige Android-app (regels, foto's lezen, stem, 4 talen)
- [ ] Test op echte toestellen en ondertekening van de APK voor verspreiding
- [ ] iPhone-app
- [x] Interface in het Nederlands, Italiaans en Duits
- [ ] Regels aanvullen met recente Belgische oplichtingscampagnes

## Wie zit achter Vigie

Vigie is vrije software waarvan het **concept is bedacht door Pixel's ASBL** (Boussu, België), een vereniging die mensen begeleidt in hun digitale leven. Pixel's ASBL ontvangt geen enkel geanalyseerd bericht en biedt geen bijstand via de app. Voor een vraag over het project zelf: Info@asblpixels.be.

Vigie steunt op [Tesseract](https://github.com/tesseract-ocr/tesseract) en [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0), [Capacitor](https://capacitorjs.com) (MIT), [Flask](https://flask.palletsprojects.com) (BSD-3) en het lettertype [Atkinson Hyperlegible Next](https://brailleinstitute.org/freefont) van het Braille Institute (SIL OFL 1.1).

## Bijdragen en problemen melden

Zie [CONTRIBUTING.md](CONTRIBUTING.md) en [SECURITY.md](SECURITY.md). Wordt een oplichting niet herkend? Open een ticket met de tekst van het bericht, **zonder** persoonsgegevens.

## Licentie

[GPL-3.0-or-later](LICENSE) · © Pixel's ASBL
