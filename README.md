# README for Harjutame

## Harjutame (simple SFTP-deployable webapp)

This small project provides two interactive exercise blocks and a tiny deploy helper:

- **Etteütlus!** — shows random sentences from `sentences.txt` for writing practice.
- **Matemaatika!** — generates simple arithmetic problems (addition/subtraction and optional other ops) with one unknown.
- **deploy_sftp.sh** — helper script to upload the site files to a remote host using SFTP.

### Files to upload

Upload these files to your web host (via SFTP recommended): `index.html`, `script.js`, and `sentences.txt`.

### Etteütlus! block

- Trigger: the `Etteütlus!` button in `index.html` (handled by `btn` in `script.js`).
- Behavior: fetches `sentences.txt`, trims and filters lines, and displays up to the configured number of random sentences.
- Input format: `sentences.txt` is line-based; lines may optionally be `ID|sentence` — the part after the first `|` is used as the sentence.
- Safety: the script uses `textContent` for insertion to avoid XSS and enforces client-side limits (`MAX_LINES`, `MAX_LINE_LENGTH`).

### Matemaatika! block

- Trigger: the `Matemaatika!` button in `index.html` (handled by `math-btn` in `script.js`).
- Behavior: generates a list of arithmetic problems and displays them in the math area. One operand or the result is replaced by `_`.
- Configuration: the client loads overrides from `config.json` in the project root (optional). If missing or invalid, sensible defaults are used.

Default `config.json` fields (names and defaults used by `script.js`):

- `min_integer` (default: 1)
- `max_integer` (default: 10)
- `maximum_sum` (default: 16)
- `minimum_difference` (default: 1)
- `addition_allowed` (default: true)
- `subtraction_allowed` (default: true)
- `multiplication_allowed` (default: false)
- `division_allowed` (default: false)
- `maximum_product` (default: 100)
- `minimum_quotient` (default: 1)
- `dictation_lines` (default: 4)
- `math_problem_count` (default: 5)

Example `config.json`:

```json
{
  "min_integer": 1,
  "max_integer": 10,
  "maximum_sum": 16,
  "minimum_difference": 1,
  "addition_allowed": true,
  "subtraction_allowed": true,
  "multiplication_allowed": false,
  "division_allowed": false,
  "maximum_product": 100,
  "minimum_quotient": 1,
  "dictation_lines": 4,
  "math_problem_count": 5
}
```

Notes:

- `script.js` tries to fetch `./config.json` at load time and merges provided values with defaults.
- After editing `config.json`, reload the page to pick up changes.

### Deployment helper: `deploy_sftp.sh`

`deploy_sftp.sh` uploads files from the repository root to a remote host using SFTP. Key points:

- Configuration: the script reads an external `.env` file located at `$ENV_DIR/.env`, where `ENV_DIR` defaults to `$HOME/configs` unless you set `SFTP_ENV_DIR`.
- Required environment variables: `SFTP_HOST`, `SFTP_USER` (the script will exit if these are missing).
- Optional variables: `SFTP_PORT` (default `22`), `SFTP_REMOTE_DIR`, `FTP_REMOTE_DIR`, `SSH_KEY_PATH` (defaults to `$ENV_DIR/smws`), `KEY_PASSPHRASE`, `DEPLOY_LOG`.
- Authentication: prefers SSH key authentication. If `KEY_PASSPHRASE` is provided the script creates a temporary unlocked copy of the key for the upload and removes it afterwards.
- Defaults: uploads `index.html`, `script.js`, and `sentences.txt` (or files provided as arguments to the script).
- Logging: actions are appended to `deploy_sftp.log` in the project root by default; override with `DEPLOY_LOG`.

Quick dry-run (prints planned sftp batch):

```bash
SFTP_ENV_DIR=~/.config/harjutame bash -lc 'ENV_DIR="${SFTP_ENV_DIR}"; ENV_FILE="$ENV_DIR/.env"; set -a; source "$ENV_FILE"; set +a; REMOTE_DIR="${SFTP_REMOTE_DIR:-.}"; echo "cd $REMOTE_DIR"; echo "put index.html"; echo "put script.js"; echo "put sentences.txt"; echo bye'
```

To perform the upload (may overwrite remote files):

```bash
SFTP_ENV_DIR=~/.config/harjutame ./deploy_sftp.sh
```

### Security & recommendations

- Keep your `.env` file outside the repository and readable only by you (`chmod 600`). The script's default location is `$HOME/configs/.env`; using `~/.config/harjutame/.env` is also a reasonable per-user choice — set `SFTP_ENV_DIR` accordingly.
- Prefer SSH keys over plaintext passwords; prefer `ssh-agent` for passphrase-protected keys instead of putting passphrases in `.env` when possible.

If you'd like, I can add a `--dry-run` flag to `deploy_sftp.sh`, or make it prefer `ssh-agent` when available. Tell me which option you prefer.
