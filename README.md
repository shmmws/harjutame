# README for Harjutame

## Harjutame (simple SFTP-deployable webapp)

This small project provides two interactive exercise blocks and a tiny deploy helper:

- **Etteütlus!** — shows random sentences from `sentences.txt` for writing practice.
- **Matemaatika!** — generates simple arithmetic problems (addition/subtraction) with one unknown.
- **deploy_sftp.sh** — helper script to upload the three site files to a remote server using SFTP.

### Files to upload

Upload these files to your web host (via SFTP recommended): `index.html`, `script.js`, and `sentences.txt`.

### Etteütlus! block

- Trigger: the `Etteütlus!` button in `index.html` (handled by `btn` in `script.js`).
- Behavior: fetches `sentences.txt`, sanitizes and filters lines (client-side limits apply), and displays up to 4 random sentences.
- Input format: `sentences.txt` is line-based; lines may optionally be `ID|sentence` — the part after the first `|` is used as the sentence.
- Safety: text is inserted with `textContent` to avoid XSS; the client limits processed lines and line length for robustness.

### Matemaatika! block

- Trigger: the `Matemaatika!` button in `index.html` (handled by `math-btn` in `script.js`).
- Behavior: generates a list of simple arithmetic problems (addition or subtraction) with one unknown shown as `_` and displays them in the math area.
- Numbers are small positive integers and problems avoid negative or trivial results.

### Configuring the Matemaatika block

You can customize the Matemaatika generator by placing a `maths.json` file in the project root. The file is optional — if missing the app uses sensible defaults.

Fields (JSON):

- `min_integer` (integer, default 1): smallest integer used in problems.
- `max_integer` (integer, default 10): largest integer used in problems.
- `maximum_sum` (integer, default 16): maximum allowed sum for addition problems.
- `minimum_difference` (integer, default 1): minimum allowed difference for subtraction problems.
- `addition_allowed` (boolean, default true)
- `subtraction_allowed` (boolean, default true)
- `multiplication_allowed` (boolean, default false)
- `division_allowed` (boolean, default false)
- `maximum_product` (integer, default 100): maximum allowed product for multiplication.
- `minimum_quotient` (integer, default 1): minimum quotient for division problems.

Example `maths.json`:

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
  "minimum_quotient": 1
}
```

Notes:

- The script performs a best-effort load of `maths.json` at page load; if the file is invalid or missing the defaults are used.
- Enable `multiplication_allowed` or `division_allowed` to include those operations; the generator respects `maximum_product` and `minimum_quotient` when producing problems.
- After editing `maths.json`, reload the page to pick up changes.

### Deployment helper: `deploy_sftp.sh`

`deploy_sftp.sh` uploads the three files from the repository root to your remote host. Highlights:

- Configuration: reads an external `.env` file (default: `~/.config/harjutame/.env` or set `SFTP_ENV_DIR`). Recognized variables include `SFTP_HOST`, `SFTP_USER`, `SFTP_PORT`, `SFTP_REMOTE_DIR`, `SSH_KEY_PATH`, and `KEY_PASSPHRASE`.
- Authentication: prefers SSH key authentication. If `KEY_PASSPHRASE` is provided, the script temporarily creates an unlocked copy of the key for non-interactive upload and removes it securely afterwards.
- Defaults: uploads `index.html`, `script.js`, and `sentences.txt` from the repository root to the remote directory (`SFTP_REMOTE_DIR`) or remote home if not set.
- Logging: actions are appended to `deploy_sftp.log` in the project root (this file is listed in `.gitignore`). Override with `DEPLOY_LOG` if needed.

Quick dry-run (prints planned sftp batch):

```bash
SFTP_ENV_DIR=~/.config/harjutame bash -lc 'ENV_DIR="${SFTP_ENV_DIR}"; ENV_FILE="$ENV_DIR/.env"; set -a; source "$ENV_FILE"; set +a; REMOTE_DIR="${SFTP_REMOTE_DIR:-.}"; echo "cd $REMOTE_DIR"; echo "put index.html"; echo "put script.js"; echo "put sentences.txt"; echo bye'
```

To perform the upload (may overwrite remote files):

```bash
SFTP_ENV_DIR=~/.config/harjutame ./deploy_sftp.sh
```

### Security & recommendations

- Keep your `.env` file outside the repository and readable only by you (`chmod 600`). Default recommended location: `~/.config/harjutame/.env`.
- Prefer SSH keys over plaintext passwords; consider using `ssh-agent` for passphrase-protected keys instead of storing passphrases in `.env`.
- Serve the site over HTTPS and add appropriate security headers when hosting publicly.

If you'd like, I can add a `--dry-run` flag to `deploy_sftp.sh`, or make it prefer `ssh-agent` when available. Tell me which option you prefer.

## Harjutame (simple FTP-deployable webapp)

Files to upload via FTP: `index.html`, `script.js`, and `sentences.txt`.

Usage:

- Upload the three files to your web host via FTP.
- Open `index.html` in a browser via HTTP (not file://). Click the "Etteütlus!" button to show 4 random sentences.

Notes:

- `sentences.txt` is a simple line-based list. Each line may be optionally prefixed with an ID and a pipe, e.g. `1|Sentence here`.
- `sentences.txt` is listed in `.gitignore` to avoid committing it; you still need to upload it to your FTP server.

Deployment script and `.env`

----------------------------

This repository includes a `deploy_sftp.sh` helper script that uploads your site to a remote server. For security the script prefers an external `.env` file outside the repo.

- Where to place the `.env` file:
  - Preferred location (recommended): `~/.config/harjutame/.env` (created per-user, not in the repository). The script will read this file by default.
  - Alternative: set `SFTP_ENV_FILE=/path/to/my.env` (or `SFTP_ENV_DIR=/path/to/dir`) when running the script.

- Minimal `.env` format (KEY=VALUE lines):

FTP_HOST=ftp.example.com
FTP_PORT=21
FTP_USER=username
FTP_PASS=plainpassword
FTP_REMOTE_DIR=/path/on/server/

- Security recommendations for `.env`:
  - Protect the file on disk: `chmod 600 ~/.config/harjutame/.env` and keep it out of the repository.
  - Rotate any plaintext password if it was previously committed or exposed.

- Prefer SSH key authentication for SFTP (recommended):

1. Generate a key pair locally (if you don't have one):

    ```bash
    ssh-keygen -t ed25519 -C "deploy@local" -f ~/.ssh/harjutame_deploy
    ```

2. Copy the public key to the server's `~/.ssh/authorized_keys` for the deploy user:

    ```bash
    ssh-copy-id -i ~/.ssh/harjutame_deploy.pub user@host
    ```

3. Use `lftp` (recommended) for the deploy script. `lftp` will use your SSH agent or `~/.ssh` keys for sftp. Alternatively, use `scp`/`rsync -e "ssh -i ~/.ssh/harjutame_deploy"` from CI or scripts.

Example using `rsync` with a key:

```bash
rsync -avz -e "ssh -i ~/.ssh/harjutame_deploy" ./ user@host:/path/on/server/
```

If you need, I can update `deploy_sftp.sh` to support explicit SSH key options or add a `--dry-run` flag.  
