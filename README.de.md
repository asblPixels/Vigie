<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="static/logo-sombre.svg">
  <img src="static/logo.svg" alt="Vigie von Pixel's ASBL" width="420">
</picture>

### Der kostenlose Offline-Betrugsschutz<br>für alle, die der digitalen Welt fernstehen.

[Français](README.md) · [Nederlands](README.nl.md) · [Italiano](README.it.md) · **Deutsch**

![Lizenz](https://img.shields.io/badge/Lizenz-GPL--3.0-0E2A38?style=flat-square)
![Android](https://img.shields.io/badge/Android-eigenständig-007A7A?style=flat-square)
![Linux](https://img.shields.io/badge/Linux-Fedora-007A7A?style=flat-square)
![Offline](https://img.shields.io/badge/funktioniert-offline-14B8A6?style=flat-square)
![Ohne Konto](https://img.shields.io/badge/ohne-Konto%20und%20Werbung-14B8A6?style=flat-square)

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/capture-accueil-dark.png">
  <img src="docs/capture-accueil-light.png" alt="Startbildschirm von Vigie" width="260">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/capture-arnaque-dark.png">
  <img src="docs/capture-arnaque-light.png" alt="Vigie meldet wahrscheinlichen Betrug" width="260">
</picture>

</div>

> **Privates Repository.** Vigie befindet sich in Entwicklung und ist noch nicht öffentlich zugänglich.

## Kurz gesagt

Eine SMS, eine E-Mail oder ein Brief beunruhigt Sie? **Fotografieren** oder **einfügen** – Vigie antwortet nach wenigen Sekunden mit einem von drei Urteilen, in großer Schrift und einfacher Sprache:

| Urteil | Was Vigie sagt |
|---|---|
| **Wahrscheinlich Betrug** | Tun Sie nichts mit dieser Nachricht. Hier sind die drei wichtigsten Schritte. |
| **Vorsicht** | Es gibt verdächtige Hinweise. Prüfen Sie, bevor Sie handeln. |
| **Keine bekannten Anzeichen** | Nichts Verdächtiges gefunden, aber bleiben Sie wachsam: Das ist keine Garantie. |

Vigie ist für Menschen gemacht, die wenig mit digitalen Werkzeugen arbeiten: ein Bildschirm, ein Handgriff, große Schaltflächen, eine auf Lesbarkeit ausgelegte Schrift und Vorlesefunktion.

## Warum Vigie

- **Kostenlos und frei.** Kein Abo, kein Konto, keine Werbung. Lizenz GPL-3.0.
- **Offline und privat.** Die Nachricht wird auf dem Gerät analysiert und nirgendwohin gesendet.
- **Transparent.** Die Urteile stammen aus lesbaren Regeln (`regles.py`), nicht aus einer Blackbox. Eine optionale lokale KI darf das Ergebnis erklären, nie entscheiden.
- **Für alle.** Sie dürfen die Nachricht einer anderen Person fotografieren: Eltern, Nachbarn, einen erhaltenen Brief.
- **Eine Vertrauensperson, die Sie selbst wählen.** Im Zweifel schlägt Vigie vor, die Person anzurufen, die Sie selbst aus Ihren Kontakten gewählt haben. Niemand sonst.

## Installation

### Android (eigenständige App)

Die App enthält alles: Regeln, Fotoerkennung, Stimme. Sie funktioniert ohne Computer und ohne Internet.

1. Auf GitHub: Reiter **Actions**, letzte Ausführung **Application Android**, Bereich **Artifacts**, dann **Vigie-android** herunterladen.
2. Öffnen Sie `Vigie-android.apk` auf dem Telefon. Android fragt, ob die Installation aus dieser Quelle erlaubt sein soll: Bestätigen Sie dies für diesmal.
3. Öffnen Sie Vigie. Die Kamera wird erst angefordert, wenn Sie auf „Prendre en photo“ (Foto aufnehmen) tippen.

### Computer mit Fedora (und anderen Linux-Systemen)

```bash
git clone https://github.com/asblPixels/vigie.git ~/vigie && cd ~/vigie
bash installer_fedora.sh      # installiert Python, Tesseract (Französisch) und die Abhängigkeiten
python3 app.py                # dann http://127.0.0.1:5000 öffnen
```

### iPhone oder ein Telefon in der Nähe des PCs

```bash
python3 app.py --telephone    # zeigt eine Adresse und einen QR-Code zum Scannen (gleiches WLAN)
```

Öffnen Sie die Adresse in Safari und wählen Sie „Zum Home-Bildschirm“. Eine native iPhone-App gibt es noch nicht (siehe Fahrplan).

## Ihre Vertrauensperson

Vigie schlägt nie vor, eine Nummer anzurufen, die sie selbst für Sie ausgewählt hätte. Unter **Réglages → Ma personne de confiance** wählen Sie einen Kontakt aus Ihrem Adressbuch oder tippen eine Nummer von Hand ein. Sie wird nur auf Ihrem Gerät gespeichert.

Unter Android läuft die Auswahl über die Kontaktauswahl des Systems: Vigie erhält nur den gewählten Kontakt und hat **keine** Berechtigung, Ihr Adressbuch zu lesen.

## Datenschutz

| Daten | Wohin sie gehen |
|---|---|
| Text der Nachricht | Auf dem Gerät analysiert, nie gesendet |
| Foto | Auf dem Gerät gelesen; Vigie behält keine Kopie |
| Vertrauensperson | Nur auf dem Gerät gespeichert |
| Statistiken, Cookies, Konten | Keine |

Die Android-App erzwingt zudem eine Sicherheitsrichtlinie (CSP), die das Laden externer Inhalte untersagt, und enthält keinerlei Tracker.

## Unter der Haube

| Baustein | Technologie |
|---|---|
| Erkennung | Lesbare Regeln: offizielle Marken und Domains, Link-Verkürzer, verdächtige Endungen, Drucksprache (`regles.py`) |
| Überall dasselbe Urteil | Die Regeln werden zum Telefon exportiert (`regles.json`); `outils/verifier_parite.py` belegt, dass PC und Android identisch antworten |
| Fotoerkennung | Tesseract (PC) · eingebettetes Tesseract.js mit französischem Sprachpaket (Android) |
| Android-App | Capacitor 8, native Kontaktauswahl, Sprachausgabe |
| Oberfläche | Ein Stylesheet für PC und Android, helles und dunkles Design, Schrift Atkinson Hyperlegible Next |
| Optionale KI (PC) | Lokales Ollama (`qwen2.5:3b`): erklärt, entscheidet nie |

## Entwickeln

```bash
python3 test_vigie.py                 # 11 Beispielnachrichten
python3 outils/verifier_parite.py     # PC und Telefon geben dasselbe Urteil
python3 outils/exporter_regles.py     # nach jeder Änderung an regles.py
python3 outils/generer_logos.py       # Logos in hell und dunkel

cd mobile && npm ci && npm run sync   # bereitet die Android-App vor
```

Die APK wird von GitHub Actions (`.github/workflows/android.yml`) bei jeder Änderung gebaut und an ein Release angehängt, wenn ein `v…`-Tag gepusht wird.

## Fahrplan

- [x] PC-Prototyp, neu gestaltete Oberfläche, Kamera unter iOS und Android
- [x] Eigenständige Android-App (Regeln, Fotoerkennung, Stimme, Vertrauensperson)
- [ ] Test auf echten Geräten und Signierung der APK für die Verteilung
- [ ] iPhone-App
- [ ] Oberfläche auf Niederländisch, Italienisch und Deutsch
- [ ] Regeln um aktuelle Betrugskampagnen in Belgien erweitern

## Wer steht hinter Vigie

Vigie ist freie Software, deren **Konzept von Pixel's ASBL** (Boussu, Belgien) entwickelt wurde, einem Verein, der Menschen im digitalen Alltag begleitet. Pixel's ASBL erhält keine analysierte Nachricht und bietet über die App keinen Support. Für Fragen zum Projekt selbst: Info@asblpixels.be.

Vigie baut auf [Tesseract](https://github.com/tesseract-ocr/tesseract) und [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0), [Capacitor](https://capacitorjs.com) (MIT), [Flask](https://flask.palletsprojects.com) (BSD-3) und der Schrift [Atkinson Hyperlegible Next](https://brailleinstitute.org/freefont) des Braille Institute (SIL OFL 1.1).

## Mitwirken und Probleme melden

Siehe [CONTRIBUTING.md](CONTRIBUTING.md) und [SECURITY.md](SECURITY.md). Ein Betrug wird nicht erkannt? Eröffnen Sie ein Ticket mit dem Text der Nachricht, **ohne** persönliche Daten.

## Lizenz

[GPL-3.0-or-later](LICENSE) · © Pixel's ASBL
