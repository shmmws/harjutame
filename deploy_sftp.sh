#!/usr/bin/env bash
set -euo pipefail

# Simple SFTP upload script with basic logging.
# Expects a .env file located in: SFTP_ENV_DIR or $HOME/configs/.env
# Required env vars in .env: SFTP_HOST, SFTP_USER
# Optional vars: SFTP_PORT (default 22), SFTP_REMOTE_DIR, FTP_REMOTE_DIR,
# SSH_KEY_PATH (defaults to SFTP_ENV_DIR/smws), KEY_PASSPHRASE, DEPLOY_LOG

ENV_DIR="${SFTP_ENV_DIR:-$HOME/configs}"
ENV_FILE="$ENV_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Logging setup: default to `deploy_sftp.log` in project root unless `DEPLOY_LOG` set
LOG_FILE="${DEPLOY_LOG:-$ROOT_DIR/deploy_sftp.log}"
mkdir -p "$(dirname "$LOG_FILE")"
log() {
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "$ts $*"
  echo "$ts $*" >>"$LOG_FILE"
}
log_error() {
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "$ts $*" >&2
  echo "$ts $*" >>"$LOG_FILE"
}

# Helper to print paths with $HOME abbreviated to '~' to avoid leaking local usernames
abbrev() {
  local p="$1"
  if [[ -n "$HOME" && "$p" == "$HOME"* ]]; then
    printf "%s" "~${p#$HOME}"
  else
    printf "%s" "$p"
  fi
}

SSH_KEY_PATH="${SSH_KEY_PATH:-$ENV_DIR/smws}"
SFTP_PORT="${SFTP_PORT:-22}"

DEFAULT_FILES=(index.html practice.js sentences.txt config.json)
if [[ $# -gt 0 ]]; then
  FILES=("$@")
else
  FILES=("${DEFAULT_FILES[@]}")
fi

: "${SFTP_HOST:?Need SFTP_HOST in env file ($ENV_FILE)}"
: "${SFTP_USER:?Need SFTP_USER in env file ($ENV_FILE)}"

# Prefer SFTP_REMOTE_DIR, fall back to FTP_REMOTE_DIR, then to current dir
REMOTE_DIR="${SFTP_REMOTE_DIR:-${FTP_REMOTE_DIR:-.}}"

log "Using SSH key: $(abbrev "$SSH_KEY_PATH")"
log "Remote directory: $REMOTE_DIR"

if [[ ! -f "$SSH_KEY_PATH" ]]; then
  log_error "SSH key not found: $SSH_KEY_PATH"
  exit 1
fi

UPLOAD_FILES=()
for f in "${FILES[@]}"; do
  if [[ -f "$f" ]]; then
    UPLOAD_FILES+=("$f")
  else
    log_error "Warning: local file not found, skipping: $f"
  fi
done

if [[ ${#UPLOAD_FILES[@]} -eq 0 ]]; then
  log_error "No files to upload; exiting."
  exit 1
fi

TMP_BATCH=$(mktemp)
if [[ -n "${REMOTE_DIR:-}" && "$REMOTE_DIR" != "." ]]; then
  echo "cd $REMOTE_DIR" >"$TMP_BATCH"
fi
for f in "${UPLOAD_FILES[@]}"; do
  echo "put $f" >>"$TMP_BATCH"
done
echo "bye" >>"$TMP_BATCH"

KEY_TO_USE="$SSH_KEY_PATH"
TEMP_KEY=""
cleanup_temp_key() {
  if [[ -n "$TEMP_KEY" && -f "$TEMP_KEY" ]]; then
    if command -v shred >/dev/null 2>&1; then
      shred -u "$TEMP_KEY" 2>/dev/null || rm -f "$TEMP_KEY"
    else
      rm -f "$TEMP_KEY"
    fi
  fi
}

if [[ -n "${KEY_PASSPHRASE:-}" ]]; then
  log "Using KEY_PASSPHRASE from env: creating temporary unlocked key"
  TEMP_KEY=$(mktemp)
  cp "$SSH_KEY_PATH" "$TEMP_KEY"
  chmod 600 "$TEMP_KEY"
  if ! ssh-keygen -p -f "$TEMP_KEY" -P "$KEY_PASSPHRASE" -N "" >/dev/null 2>&1; then
    log_error "Failed to remove passphrase from temporary key"
    rm -f "$TEMP_KEY"
    exit 1
  fi
  KEY_TO_USE="$TEMP_KEY"
  trap cleanup_temp_key EXIT
fi

log "Uploading ${#UPLOAD_FILES[@]} file(s) to ${SFTP_USER}@${SFTP_HOST}:${REMOTE_DIR}"
sftp -oIdentityFile="$KEY_TO_USE" -oPort="$SFTP_PORT" "${SFTP_USER}@${SFTP_HOST}" <"$TMP_BATCH"
RC=$?
rm -f "$TMP_BATCH"
if [[ $RC -ne 0 ]]; then
  log_error "Upload failed (exit $RC)"
  exit $RC
fi

log "Upload complete."


echo "Upload complete."
