<p align="center"><img src="static/logo.svg" alt="Vigie, door Pixel's ASBL" width="340"></p>

<p align="center">
<a href="README.md">Français</a> · <b>Nederlands</b> · <a href="README.it.md">Italiano</a> · <a href="README.de.md">Deutsch</a>
</p>

<p align="center"><b>Is het oplichting? Controleer het met één foto.</b><br>
Gratis · Zonder reclame · Er wordt niets naar het internet gestuurd</p>

---

> **Status:** prototype in testfase. Privéopslagplaats, niet verspreiden.
> **Taal van de toepassing:** voorlopig alleen in het Frans.

## In het kort

U krijgt een sms, een e-mail of een brief die u ongerust maakt? Open **Vigie** en plak het bericht of neem er een foto van. Na enkele seconden antwoordt Vigie:

- 🔴 **Waarschijnlijk oplichting**: doe niets.
- 🟠 **Opgelet**: controleer eerst voor u iets doet.
- 🟢 **Geen bekend teken**: niets verdachts gevonden (dat is geen garantie).

U ziet ook **wat u moet doen** (3 eenvoudige stappen), **waarom** Vigie dat denkt, en een knop om **een vertrouwenspersoon te bellen**.

<p align="center">
<img src="docs/capture-accueil.png" alt="Startscherm" width="250">
<img src="docs/capture-arnaque.png" alt="Resultaat: waarschijnlijk oplichting" width="250">
</p>

## Hoe werkt het?

Vigie wordt **één keer** geïnstalleerd op een computer thuis. Daarna:

- **Op de computer**: u opent het in de browser (Firefox, Chrome, Edge, Safari).
- **Op de gsm of tablet** (iPhone, iPad, Android): u opent het via de wifi van thuis, door een QR-code te scannen.

Alles gebeurt bij u thuis. Berichten en foto's gaan niet naar het internet en worden niet bewaard.

## Installatie

Kies uw systeem. Elke stap doet u maar één keer.

### Linux Fedora (het eenvoudigst)

1. Download Vigie: groene knop **Code** → **Download ZIP**, en pak het bestand uit.
2. Open een terminal in de map van Vigie.
3. Typ:
   ```bash
   bash installer_fedora.sh
   ```
   Op een oude computer of een computer met weinig geheugen typt u beter `bash installer_fedora.sh --sans-ia`.

### Linux Ubuntu of Debian

```bash
sudo apt install tesseract-ocr tesseract-ocr-fra python3-pip
python3 -m pip install --user -r requirements.txt
```

### Windows 10 of 11

1. Installeer **Python** via [python.org](https://www.python.org/downloads/). Vink **„Add Python to PATH”** aan.
2. Installeer **Tesseract** (om foto's te lezen) via [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki). Vink tijdens de installatie de taal **French** aan.
3. Open **PowerShell** in de map van Vigie en typ:
   ```powershell
   py -m pip install -r requirements.txt
   ```

### macOS

Met [Homebrew](https://brew.sh):

```bash
brew install tesseract tesseract-lang python
python3 -m pip install -r requirements.txt
```

### Lokale AI (optioneel)

De AI legt het resultaat uit in eenvoudige woorden. Daarvoor is een computer met **8 GB geheugen** nodig.

1. Installeer [Ollama](https://ollama.com/download).
2. Typ: `ollama pull qwen2.5:3b`

Zonder AI werkt Vigie ook: het oordeel hangt er nooit van af.

## Gebruik

### Op de computer

```bash
python3 app.py
```

Onder Windows: `py app.py`. Vindt Windows Tesseract niet, typ dan eerst:
`$env:VIGIE_TESSERACT = "C:\Program Files\Tesseract-OCR\tesseract.exe"`

Open daarna **http://127.0.0.1:5000** in de browser.

### Op een iPhone, iPad of Android

1. De gsm en de computer moeten op **dezelfde wifi** zitten.
2. Typ op de computer: `python3 app.py --telephone`
3. Er verschijnt een **QR-code**. Richt de camera van uw gsm erop en open de link.
4. Tip: zet Vigie op uw beginscherm.
   - **iPhone / iPad** (Safari): knop Delen → **Zet op beginscherm**.
   - **Android** (Chrome): menu ⋮ → **Toevoegen aan startscherm**.

### Een bericht controleren

- **Prendre en photo** (foto nemen): de camera gaat open. Fotografeer het scherm of de brief, ook als die van iemand anders is. Het resultaat verschijnt vanzelf.
- **Capture d'écran** (schermafbeelding): kies een afbeelding die al op uw toestel staat.
- **Coller** (plakken): plak de tekst van het bericht en druk op **Vérifier le message** (bericht controleren).

## Instellingen

U kunt de persoon die gebeld wordt aanpassen, bijvoorbeeld naar een familielid:

```bash
VIGIE_AIDANT_NOM="Mijn dochter Julie" VIGIE_AIDANT_TEL="+32470000000" python3 app.py
```

| Instelling | Waarvoor dient het | Standaard |
| --- | --- | --- |
| `VIGIE_AIDANT_NOM` | Naam op de belknop | Pixel's ASBL |
| `VIGIE_AIDANT_TEL` | Nummer dat gebeld wordt | +32456960328 |
| `VIGIE_MODELE` | AI-model | qwen2.5:3b |
| `VIGIE_OLLAMA` | Adres van de AI | http://127.0.0.1:11434 |
| `VIGIE_TESSERACT` | Locatie van Tesseract | tesseract |
| `VIGIE_HOTE` | `0.0.0.0` voor het netwerk thuis | 127.0.0.1 |
| `VIGIE_PORT` | Poort | 5000 |

## Bij problemen

| Probleem | Oplossing |
| --- | --- |
| De gsm opent de pagina niet | Dezelfde wifi? Computer aan? Onder Fedora: `sudo firewall-cmd --add-port=5000/tcp` |
| „Je n'ai pas réussi à lire l'image” (afbeelding niet gelezen) | Neem de foto opnieuw, recht van voren, goed verlicht, zonder weerspiegeling. Of plak de tekst. |
| Geen uitleg van de AI | Ollama draait niet: geen probleem, het oordeel blijft betrouwbaar. |
| „Vigie n'est pas joignable” (niet bereikbaar) | De computer staat uit, of de gsm zit niet meer op de wifi van thuis. |

## Nuttige nummers (België)

- U hebt een code of uw kaartgegevens gegeven: **Card Stop 078 170 170**, daarna uw bank.
- Stuur verdachte berichten door naar **verdacht@safeonweb.be**.
- Noodnummer politie: **101**.

## Veiligheid en privacy

- Alles werkt **op uw computer**. Foto's worden meteen na het lezen gewist.
- Met `--telephone` kan iedereen op **dezelfde wifi** Vigie openen. Gebruik dit thuis, nooit op een openbare wifi.
- Vigie is **een hulpmiddel, geen garantie**. Bij twijfel: doe niets en bel een vertrouwenspersoon.

## Voor technici

- `app.py`: webtoepassing (Flask), foto's lezen, AI, PWA.
- `regles.py`: regels tegen oplichting en officiële Belgische domeinen. **Alleen deze regels bepalen het oordeel**: 5 punten of meer geeft rood, 2 tot 4 geeft oranje.
- `test_vigie.py`: tests (`python3 test_vigie.py`). Voeg elke nieuwe vorm van oplichting toe (geanonimiseerd), en ook echte, betrouwbare berichten.
- Foto's: de gsm verkleint ze (ongeveer 70 kB), de computer zet ze recht, verwerkt de donkere modus en leest ze met Tesseract.
- Vigie installeren als echte app op de gsm (ook offline) vraagt een **HTTPS**-verbinding. Dat komt voor de openbare versie.

**Kleuren van Pixel's:** nachtblauw `#0E2A38` · turkoois `#008080` · mint `#5EEAD4`. Logo: `static/logo.svg`.

## Licentie en contact

Vrije software onder licentie **GPL-3.0** (zie [LICENSE](LICENSE)).

**Pixel's ASBL** · Rue Alfred Dendal 56, 7300 Boussu · info@asblpixels.be · +32 456 96 03 28
