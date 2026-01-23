# Harjutame

A simple SFTP-deployable web app for preschool practice: random dictation sentences and math problems.

## Quick Start

Start a local HTTP server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` and click **Etteütlus!** or **Matemaatika!**.

> **Note:** Do not open `index.html` directly (CORS restrictions). Use an HTTP server. On localhost, the app auto-reloads when you edit files.

## Customize

Edit `config.json` to adjust:

- `dictation_lines` — sentences per practice
- `math_problem_count` — problems to generate
- `min_integer`, `max_integer` — number ranges
- `prefer_sentences_with` — filter sentences by characters (e.g., `["r", "l"]`)
- Enable/disable operations: `addition_allowed`, `subtraction_allowed`, etc.

Edit `sentences.txt` to add custom sentences (one per line, optionally as `ID|sentence`).

## Deploy to Remote Host

1. Copy `.env.example` to `$HOME/configs/.env` and fill in your SFTP credentials
2. Run `./deploy_sftp.sh`

This uploads `index.html`, `practice.js`, `sentences.txt`, and optionally `config.json`.

**Security:** Keep `.env` private (`chmod 600`). Use SSH keys, not passwords. See `.env.example` for all options.

## Features

- **Etteütlus!** — Random sentences for writing practice
- **Matemaatika!** — Arithmetic problems with configurable difficulty
- **Auto-reload** — Live updates on localhost when config/sentences change
- **Optional config** — Sensible defaults if `config.json` missing
