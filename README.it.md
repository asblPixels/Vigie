<p align="center"><img src="static/logo.svg" alt="Vigie, di Pixel's ASBL" width="340"></p>

<p align="center">
<a href="README.md">Français</a> · <a href="README.nl.md">Nederlands</a> · <b>Italiano</b> · <a href="README.de.md">Deutsch</a>
</p>

<p align="center"><b>È una truffa? Verificalo con una foto.</b><br>
Gratuito · Senza pubblicità · Niente viene inviato su Internet</p>

---

> **Stato:** prototipo in prova. Repository privato, non diffondere.
> **Lingua dell'applicazione:** per ora solo in francese.

## In breve

Ricevete un SMS, un'e-mail o una lettera che vi preoccupa? Aprite **Vigie**, incollate il messaggio oppure fotografatelo. In pochi secondi Vigie vi risponde:

- 🔴 **Truffa probabile**: non fate nulla.
- 🟠 **Prudenza**: verificate prima di agire.
- 🟢 **Nessun segnale noto**: niente di sospetto (ma non è una garanzia).

Vedete anche **cosa fare** (3 passi semplici), **perché** Vigie lo pensa, e un pulsante per **chiamare una persona di fiducia**.

<p align="center">
<img src="docs/capture-accueil.png" alt="Schermata iniziale" width="250">
<img src="docs/capture-arnaque.png" alt="Risultato: truffa probabile" width="250">
</p>

## Come funziona

Vigie si installa **una sola volta** su un computer di casa. Poi:

- **Sul computer**: si apre nel browser (Firefox, Chrome, Edge, Safari).
- **Sul telefono o sul tablet** (iPhone, iPad, Android): si apre tramite il Wi-Fi di casa, scansionando un codice QR.

Tutto avviene a casa vostra. I messaggi e le foto non vanno su Internet e non vengono conservati.

## Installazione

Scegliete il vostro sistema. Ogni passaggio si fa una sola volta.

### Linux Fedora (il più semplice)

1. Scaricate Vigie: pulsante verde **Code** → **Download ZIP**, poi estraete il file.
2. Aprite un terminale nella cartella di Vigie.
3. Scrivete:
   ```bash
   bash installer_fedora.sh
   ```
   Su un computer vecchio o con poca memoria, scrivete invece `bash installer_fedora.sh --sans-ia`.

### Linux Ubuntu o Debian

```bash
sudo apt install tesseract-ocr tesseract-ocr-fra python3-pip
python3 -m pip install --user -r requirements.txt
```

### Windows 10 o 11

1. Installate **Python** da [python.org](https://www.python.org/downloads/). Spuntate **«Add Python to PATH»**.
2. Installate **Tesseract** (lettura delle foto) da [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki). Durante l'installazione spuntate la lingua **French**.
3. Aprite **PowerShell** nella cartella di Vigie e scrivete:
   ```powershell
   py -m pip install -r requirements.txt
   ```

### macOS

Con [Homebrew](https://brew.sh):

```bash
brew install tesseract tesseract-lang python
python3 -m pip install -r requirements.txt
```

### L'IA locale (facoltativa)

Spiega il risultato con parole semplici. Richiede un computer con **8 GB di memoria**.

1. Installate [Ollama](https://ollama.com/download).
2. Scrivete: `ollama pull qwen2.5:3b`

Senza l'IA, Vigie funziona lo stesso: il verdetto non dipende mai da lei.

## Utilizzo

### Sul computer

```bash
python3 app.py
```

Su Windows: `py app.py`. Se Windows non trova Tesseract, scrivete prima:
`$env:VIGIE_TESSERACT = "C:\Program Files\Tesseract-OCR\tesseract.exe"`

Poi aprite **http://127.0.0.1:5000** nel browser.

### Su un iPhone, un iPad o un Android

1. Il telefono e il computer devono essere sullo **stesso Wi-Fi**.
2. Sul computer scrivete: `python3 app.py --telephone`
3. Appare un **codice QR**. Inquadratelo con la fotocamera del telefono e aprite il link.
4. Consiglio: aggiungete Vigie alla schermata Home.
   - **iPhone / iPad** (Safari): pulsante Condividi → **Aggiungi alla schermata Home**.
   - **Android** (Chrome): menu ⋮ → **Aggiungi a schermata Home**.

### Verificare un messaggio

- **Prendre en photo** (scatta una foto): si apre la fotocamera. Fotografate lo schermo o la lettera, anche se appartiene a un'altra persona. Il risultato arriva da solo.
- **Capture d'écran** (screenshot): scegliete un'immagine già salvata.
- **Coller** (incolla): incollate il testo del messaggio, poi premete **Vérifier le message** (verifica il messaggio).

## Impostazioni

Si può cambiare la persona da chiamare, per esempio un familiare:

```bash
VIGIE_AIDANT_NOM="Mia figlia Giulia" VIGIE_AIDANT_TEL="+32470000000" python3 app.py
```

| Impostazione | A cosa serve | Predefinito |
| --- | --- | --- |
| `VIGIE_AIDANT_NOM` | Nome sul pulsante di chiamata | Pixel's ASBL |
| `VIGIE_AIDANT_TEL` | Numero chiamato | +32456960328 |
| `VIGIE_MODELE` | Modello di IA | qwen2.5:3b |
| `VIGIE_OLLAMA` | Indirizzo dell'IA | http://127.0.0.1:11434 |
| `VIGIE_TESSERACT` | Posizione di Tesseract | tesseract |
| `VIGIE_HOTE` | `0.0.0.0` per la rete di casa | 127.0.0.1 |
| `VIGIE_PORT` | Porta | 5000 |

## In caso di problemi

| Problema | Soluzione |
| --- | --- |
| Il telefono non apre la pagina | Stesso Wi-Fi? Computer acceso? Su Fedora: `sudo firewall-cmd --add-port=5000/tcp` |
| «Je n'ai pas réussi à lire l'image» (immagine non letta) | Rifate la foto di fronte, ben illuminata, senza riflessi. Oppure incollate il testo. |
| Nessuna spiegazione dell'IA | Ollama non è avviato: non è grave, il verdetto resta affidabile. |
| «Vigie n'est pas joignable» (non raggiungibile) | Il computer è spento o il telefono non è più sul Wi-Fi di casa. |

## Numeri utili (Belgio)

- Avete dato un codice o i dati della carta: **Card Stop 078 170 170**, poi la vostra banca.
- Inoltrate i messaggi sospetti a **suspect@safeonweb.be**.
- Emergenza polizia: **101**.

## Sicurezza e privacy

- Tutto funziona **sul vostro computer**. Le foto vengono cancellate subito dopo la lettura.
- Con `--telephone`, chiunque sia collegato **allo stesso Wi-Fi** può aprire Vigie. Usate questa modalità a casa, mai su un Wi-Fi pubblico.
- Vigie è **un aiuto, non una garanzia**. Nel dubbio: non fate nulla e chiamate una persona di fiducia.

## Per i tecnici

- `app.py`: applicazione web (Flask), lettura delle foto, IA, PWA.
- `regles.py`: regole anti-truffa e domini ufficiali belgi. **Solo queste regole decidono il verdetto**: 5 punti o più danno rosso, da 2 a 4 danno arancione.
- `test_vigie.py`: test (`python3 test_vigie.py`). Aggiungete ogni nuova truffa, resa anonima, e anche veri messaggi legittimi.
- Foto: il telefono le riduce (circa 70 KB), il computer le raddrizza, gestisce la modalità scura e le legge con Tesseract.
- Installare Vigie come vera app sul telefono (anche offline) richiederà un accesso **HTTPS**, previsto per la versione pubblica.

**Colori di Pixel's:** blu notte `#0E2A38` · turchese `#008080` · menta `#5EEAD4`. Logo: `static/logo.svg`.

## Licenza e contatti

Software libero con licenza **GPL-3.0** (vedi [LICENSE](LICENSE)).

**Pixel's ASBL** · Rue Alfred Dendal 56, 7300 Boussu · info@asblpixels.be · +32 456 96 03 28
