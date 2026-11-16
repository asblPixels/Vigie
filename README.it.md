<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="static/logo-sombre.svg">
  <img src="static/logo.svg" alt="Vigie, di Pixel's ASBL" width="420">
</picture>

### Il copilota anti-truffa, gratuito e offline,<br>per chi è lontano dal mondo digitale.

[Français](README.md) · [Nederlands](README.nl.md) · **Italiano** · [Deutsch](README.de.md)

![Licenza](https://img.shields.io/badge/licenza-GPL--3.0-0E2A38?style=flat-square)
![Android](https://img.shields.io/badge/Android-autonomo-007A7A?style=flat-square)
![Linux](https://img.shields.io/badge/Linux-Fedora-007A7A?style=flat-square)
![Offline](https://img.shields.io/badge/funziona-offline-14B8A6?style=flat-square)
![Senza account](https://img.shields.io/badge/senza-account%20né%20pubblicità-14B8A6?style=flat-square)

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/capture-accueil-dark.png">
  <img src="docs/capture-accueil-light.png" alt="Schermata iniziale di Vigie" width="260">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/capture-arnaque-dark.png">
  <img src="docs/capture-arnaque-light.png" alt="Vigie segnala una probabile truffa" width="260">
</picture>

</div>

> **Repository privato.** Vigie è in sviluppo e non è ancora accessibile al pubblico.

## In breve

Un SMS, un'e-mail o una lettera ti preoccupa? **Fotografalo** o **incollalo** in Vigie. In pochi secondi Vigie risponde con uno di tre verdetti, a caratteri grandi e con parole semplici:

| Verdetto | Cosa dice Vigie |
|---|---|
| **Truffa probabile** | Non fare nulla con questo messaggio. Ecco i tre gesti da fare. |
| **Prudenza** | Ci sono indizi preoccupanti. Verifica prima di agire. |
| **Nessun segnale noto** | Nulla di sospetto, ma resta attento: non è una garanzia. |

Vigie è pensata per chi usa poco gli strumenti digitali: una sola schermata, un solo gesto, pulsanti grandi, un carattere progettato per la leggibilità e la lettura ad alta voce del risultato.

## Perché Vigie

- **Gratuita e libera.** Nessun abbonamento, nessun account, nessuna pubblicità. Licenza GPL-3.0.
- **Offline e privata.** Il messaggio viene analizzato sul dispositivo e non è inviato da nessuna parte.
- **Trasparente.** I verdetti nascono da regole leggibili (`regles.py`), non da una scatola nera. Un'IA locale facoltativa può spiegare il risultato, mai deciderlo.
- **Per tutti.** Si può fotografare il messaggio di un'altra persona: un genitore, un vicino, una lettera ricevuta.
- **Una persona di fiducia scelta da te.** In caso di dubbio Vigie propone di chiamare la persona che hai scelto tu stesso tra i tuoi contatti. Nessun altro.

## Nell'app Android

- **Analisi animata**: percentuale a grandi cifre, fascio di scansione sulla foto, passaggi visibili a schermo.
- **Livello di rischio** chiaro (basso, medio, alto) e tre gesti da fare.
- **Cronologia** dei messaggi verificati, conservata sul telefono, disattivabile e cancellabile con un tocco.
- **Aiuto**: cosa fare se si è cliccato, si sono dati i codici, si è pagato o si è ricevuta una finta telefonata della banca; numeri utili.
- **Segnala a Safeonweb** e **condividi** il risultato con un tocco.
- **Impostazioni**: dimensione del testo (3 livelli), tema chiaro, scuro o automatico, lettura ad alta voce, persona di fiducia.

## Installare

### Android (app autonoma)

L'app contiene tutto: regole, lettura delle foto, voce. Funziona senza computer e senza Internet.

1. Su GitHub: scheda **Actions**, ultima esecuzione **Application Android**, sezione **Artifacts**, poi scarica **Vigie-android**.
2. Apri `Vigie-android.apk` sul telefono. Android chiederà di autorizzare l'installazione da questa fonte: accetta per questa volta.
3. Apri Vigie. La fotocamera viene richiesta solo quando tocchi « Prendre en photo » (scatta una foto).

### Computer con Fedora (e altri Linux)

```bash
git clone https://github.com/asblPixels/vigie.git ~/vigie && cd ~/vigie
bash installer_fedora.sh      # installa Python, Tesseract (francese) e le dipendenze
python3 app.py                # poi apri http://127.0.0.1:5000
```

### iPhone, o un telefono vicino al PC

```bash
python3 app.py --telephone    # mostra un indirizzo e un codice QR da scansionare (stessa rete Wi-Fi)
```

Apri l'indirizzo in Safari e scegli « Aggiungi alla schermata Home ». Un'app iPhone nativa non esiste ancora (vedi la tabella di marcia).

## La tua persona di fiducia

Vigie non propone mai di chiamare un numero scelto al posto tuo. In **Réglages → Ma personne de confiance** scegli un contatto della tua rubrica oppure digiti un numero a mano. Resta salvato solo sul tuo dispositivo.

Su Android la scelta passa dal selettore di contatti del sistema: Vigie riceve solo il contatto scelto e **non** ha l'autorizzazione a leggere la tua rubrica.

## Privacy

| Dato | Dove va |
|---|---|
| Testo del messaggio | Analizzato sul dispositivo, mai inviato |
| Foto | Letta sul dispositivo; Vigie non ne conserva alcuna copia |
| Persona di fiducia | Salvata solo sul dispositivo |
| Cronologia | Solo sul dispositivo, disattivabile e cancellabile |
| Statistiche, cookie, account | Nessuno |

L'app Android impone inoltre una politica di sicurezza (CSP) che vieta il caricamento di contenuti esterni e non include alcun tracker.

## Sotto il cofano

| Elemento | Tecnologia |
|---|---|
| Rilevamento | Regole leggibili: marchi e domini ufficiali, accorciatori di link, estensioni sospette, linguaggio di pressione (`regles.py`) |
| Stesso verdetto ovunque | Le regole sono esportate sul telefono (`regles.json`); `outils/verifier_parite.py` dimostra che PC e Android rispondono in modo identico |
| Lettura delle foto | Tesseract (PC) · Tesseract.js incorporato con la lingua francese (Android) |
| App Android | Capacitor 8, selettore di contatti nativo, sintesi vocale |
| Interfaccia | Un solo foglio di stile per PC e Android, tema chiaro e scuro, carattere Atkinson Hyperlegible Next |
| IA facoltativa (PC) | Ollama in locale (`qwen2.5:3b`): spiega, non decide mai |

## Sviluppare

```bash
python3 test_vigie.py                 # 11 messaggi di prova
python3 outils/verifier_parite.py     # PC e telefono danno lo stesso verdetto
python3 outils/exporter_regles.py     # dopo ogni modifica a regles.py
python3 outils/generer_logos.py       # loghi chiaro e scuro

cd mobile && npm ci && npm run sync   # prepara l'app Android
```

L'APK viene costruito da GitHub Actions (`.github/workflows/android.yml`) a ogni modifica e allegato a una release quando si invia un tag `v…`.

## Tabella di marcia

- [x] Prototipo per PC, interfaccia ripensata, fotocamera su iOS e Android
- [x] App Android autonoma (regole, lettura delle foto, voce, persona di fiducia)
- [ ] Prove su dispositivi reali e firma dell'APK per la distribuzione
- [ ] App per iPhone
- [ ] Interfaccia in olandese, italiano e tedesco
- [ ] Regole arricchite con le recenti campagne di truffe in Belgio

## Chi c'è dietro Vigie

Vigie è un software libero il cui **concetto è stato ideato da Pixel's ASBL** (Boussu, Belgio), un'associazione che accompagna le persone nella loro vita digitale. Pixel's ASBL non riceve alcun messaggio analizzato e non offre assistenza tramite l'app. Per una domanda sul progetto: Info@asblpixels.be.

Vigie si basa su [Tesseract](https://github.com/tesseract-ocr/tesseract) e [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0), [Capacitor](https://capacitorjs.com) (MIT), [Flask](https://flask.palletsprojects.com) (BSD-3) e sul carattere [Atkinson Hyperlegible Next](https://brailleinstitute.org/freefont) del Braille Institute (SIL OFL 1.1).

## Contribuire e segnalare un problema

Vedi [CONTRIBUTING.md](CONTRIBUTING.md) e [SECURITY.md](SECURITY.md). Una truffa non viene rilevata? Apri una segnalazione con il testo del messaggio, **senza** dati personali.

## Licenza

[GPL-3.0-or-later](LICENSE) · © Pixel's ASBL
