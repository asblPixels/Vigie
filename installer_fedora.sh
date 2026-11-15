#!/usr/bin/env bash
# Vigie — installation sous Fedora (Pixel's ASBL)
# Usage :  bash installer_fedora.sh          (installe tout, IA comprise)
#          bash installer_fedora.sh --sans-ia (règles + OCR uniquement, pour les PC modestes)
set -euo pipefail

MODELE="${VIGIE_MODELE:-qwen2.5:3b}"

echo "==> Paquets système (OCR en français, Python)"
sudo dnf install -y tesseract tesseract-langpack-fra python3 python3-pip python3-pillow

echo "==> Flask et QR code (accès depuis le téléphone)"
python3 -m pip install --user flask qrcode

if [[ "${1:-}" != "--sans-ia" ]]; then
  if ! command -v ollama >/dev/null 2>&1; then
    echo "==> Ollama (IA locale) — script officiel d'installation"
    curl -fsSL https://ollama.com/install.sh | sh
  fi
  echo "==> Téléchargement du modèle $MODELE (quelques Go, une seule fois)"
  ollama pull "$MODELE"
fi

echo
echo "Installation terminée. Lancez Vigie avec :"
echo "  cd \"$(dirname "$(realpath "$0")")\" && python3 app.py"
echo "puis ouvrez http://127.0.0.1:5000 dans le navigateur."
echo
echo "Pour l'utiliser depuis un iPhone ou un Android (même Wi-Fi) :"
echo "  python3 app.py --telephone   (affiche un QR code à scanner)"
