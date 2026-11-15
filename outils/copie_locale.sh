#!/usr/bin/env bash
# Vigie — garde une copie à jour du dépôt privé sur ce PC (Fedora).
# Installe un minuteur utilisateur qui met ~/vigie à jour toutes les 15 minutes, sans toucher à vos modifications locales.
# Usage :  bash copie_locale.sh            (installe et lance)
#          bash copie_locale.sh --retirer  (désinstalle le minuteur, garde le dossier)
set -euo pipefail

DEPOT="${VIGIE_DEPOT:-https://github.com/asblPixels/vigie.git}"
DOSSIER="${VIGIE_DOSSIER:-$HOME/vigie}"
UNITES="$HOME/.config/systemd/user"

if [ "${1:-}" = "--retirer" ]; then
  systemctl --user disable --now vigie-copie.timer 2>/dev/null || true
  rm -f "$UNITES/vigie-copie.service" "$UNITES/vigie-copie.timer"
  systemctl --user daemon-reload
  echo "Minuteur retiré. Le dossier $DOSSIER est conservé."; exit 0
fi

command -v git >/dev/null || { echo "Installez git : sudo dnf install -y git"; exit 1; }

if ! git ls-remote "$DEPOT" >/dev/null 2>&1; then
  cat <<MSG
Le dépôt est privé : connectez-vous d'abord à GitHub (une seule fois).
  sudo dnf install -y gh
  gh auth login          # choisissez GitHub.com, HTTPS, puis le navigateur
  gh auth setup-git
Relancez ensuite : bash $0
MSG
  exit 1
fi

if [ -d "$DOSSIER/.git" ]; then
  git -C "$DOSSIER" fetch --all --prune
else
  git clone "$DEPOT" "$DOSSIER"
fi

mkdir -p "$UNITES"
cat > "$UNITES/vigie-copie.service" <<UNITE
[Unit]
Description=Copie locale de Vigie (git pull sans écraser vos modifications)

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'git -C "$DOSSIER" fetch --all --prune && git -C "$DOSSIER" pull --ff-only || true'
UNITE
cat > "$UNITES/vigie-copie.timer" <<'UNITE'
[Unit]
Description=Met Vigie à jour toutes les 15 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=15min
Persistent=true

[Install]
WantedBy=timers.target
UNITE

systemctl --user daemon-reload
systemctl --user enable --now vigie-copie.timer
echo "Copie à jour dans $DOSSIER, puis toutes les 15 minutes."
echo "Dernier état : $(git -C "$DOSSIER" log -1 --format='%h %s')"
