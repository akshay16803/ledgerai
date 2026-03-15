# LedgerAI Handoff For New MacBook / New Codex

Last updated: 2026-03-15

## 1. Project Location

The real working repo is:

- `/Users/akshaychouhan/ledgerai`

Do not use:

- `/Users/akshaychouhan/Downloads/LedgerAI`

That `Downloads/LedgerAI` folder was empty during this work and caused confusion earlier.

## 2. Stack And Main Files

- Frontend: React + Vite
- Main app logic: `/Users/akshaychouhan/ledgerai/src/App.jsx`
- Cloudflare AI worker: `/Users/akshaychouhan/ledgerai/scripts/cloudflare-ai-worker.js`
- Worker config: `/Users/akshaychouhan/ledgerai/wrangler.toml`
- Package scripts: `/Users/akshaychouhan/ledgerai/package.json`

Important note:

- Most product logic currently lives inside one large file: `/Users/akshaychouhan/ledgerai/src/App.jsx`

## 3. Production URLs

- Frontend production URL: `https://accounts.niprasha.com`
- AI worker production URL: `https://ledgerai-ai.akshaychouhan16803.workers.dev`

## 4. Deployment Workflow

### Frontend deploy

Run from:

- `/Users/akshaychouhan/ledgerai`

Command:

```bash
npm run deploy
```

What it does:

- runs `npm run build`
- publishes `dist/` via `gh-pages`
- custom domain is already configured

Relevant config:

- `origin` remote: `https://github.com/akshay16803/ledgerai.git`
- `dist/CNAME` has been used for `accounts.niprasha.com`

### Worker deploy

Run from:

- `/Users/akshaychouhan/ledgerai`

Command pattern:

```bash
TOKEN=$(sed -n 's/^export CF_API_TOKEN=//p' "$HOME/.config/ledgerai/cloudflare.env" | tr -d "'\r\n")
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler deploy --config wrangler.toml
```

Worker config currently in:

- `/Users/akshaychouhan/ledgerai/wrangler.toml`

Current worker config values:

- `name = "ledgerai-ai"`
- `account_id = "e6511c5ef79d9196449f976a22317eb7"`
- KV binding: `LEDGERAI_RETRY_KV`
- KV namespace id: `a69469191b6242df8bd51da9ccecb0ca`
- cron: `*/5 * * * *`

## 5. Secure Items

Do not put these into git.

### Local secure file that must be copied to new MacBook

- `~/.config/ledgerai/cloudflare.env`

This file currently contains:

- `CF_API_TOKEN`
- `CF_ZONE_NAME`
- `CF_RECORD_NAME`

### Worker secrets already stored in Cloudflare

Secret names currently present in the deployed worker:

- `LEDGERAI_SHARED_KEY`
- `OPENAI_API_KEY`

Important:

- the `OPENAI_API_KEY` does not need to be downloaded to the new MacBook just to keep production working, because it already exists in Cloudflare Worker secrets
- the new MacBook only needs the Cloudflare API token if you want to deploy/update the worker from that machine

### App AI settings that matter

Current production app is configured to talk to:

- `https://ledgerai-ai.akshaychouhan16803.workers.dev`

The shared key used by the app must match `LEDGERAI_SHARED_KEY` in the worker.

For safety, this handoff file does not store the raw secret value. Copy it securely from the old MacBook app settings or your secret notes before wiping the old machine.

## 6. What Was Changed In This Work

Major work completed in this collaboration:

- AI backend config persistence in the app
- Cloudflare Worker-based AI proxy for OpenAI
- Cloud AI retry queue with:
  - `POST /retry/enqueue`
  - `GET /retry/pull`
  - KV storage
  - cron background processing
- Gmail reconnect-loop fixes
- Outlook reconnect / popup-loop fixes
- OneDrive persistence improvements
- Factory reset changed to preserve connector configuration
- Local session persistence improved so email auth lasts much longer on the same machine/browser

## 7. Important App Behavior Changes

### Email session persistence

The app now tries to preserve email connection state locally as much as possible on the same machine/browser.

This includes fixes so that:

- reloads do not immediately strip local email session data
- OneDrive restore/load does not overwrite valid local email auth with token-free cloud copies
- local backup restore/import does not unnecessarily wipe active local auth when same accounts already exist

### Retry AI Pending

The `Retry AI Pending` flow was changed so that:

- forced/manual retry can use explicit user-initiated auth when required
- fresh auth is reused across rows in the same retry run
- repeated prompts for the same account in one retry pass are blocked
- accounts marked `re-auth needed` are excluded from normal `Sync` / `Sync All Accounts` flows

## 8. Remaining Limitations

These are not normal app bugs anymore. They are mostly provider/browser limits:

- if browser site data/local storage/cookies are cleared, reconnect may be required
- if Google or Microsoft revoke session or consent, reconnect is required
- if browser privacy settings block silent auth, reconnect may eventually be required
- moving to a different browser or different MacBook does not carry live OAuth sessions automatically

Important practical point:

- OneDrive/cloud backup can restore app data and email account configuration
- it cannot safely transfer live OAuth tokens across machines

## 9. Best Migration Path To A New MacBook

### Recommended migration approach

1. Clone the repo on the new MacBook:

```bash
git clone https://github.com/akshay16803/ledgerai.git ~/ledgerai
cd ~/ledgerai
```

2. Copy the secure Cloudflare config directory from the old MacBook:

```bash
mkdir -p ~/.config/ledgerai
```

Then transfer:

- old Mac: `~/.config/ledgerai/cloudflare.env`
- new Mac: `~/.config/ledgerai/cloudflare.env`

3. Install dependencies:

```bash
cd ~/ledgerai
npm install
```

4. Verify local build:

```bash
npm run build
```

5. Verify Cloudflare auth:

```bash
TOKEN=$(sed -n 's/^export CF_API_TOKEN=//p' "$HOME/.config/ledgerai/cloudflare.env" | tr -d "'\r\n")
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler whoami
```

6. Verify worker access:

```bash
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler secret list --config wrangler.toml
```

7. Open the app and confirm:

- frontend URL is `https://accounts.niprasha.com`
- AI backend points to `https://ledgerai-ai.akshaychouhan16803.workers.dev`
- shared key matches the worker secret

### Important migration truth

Even after copying the repo and secure config, Gmail/Outlook may still need one reconnect on the new MacBook because browser/provider OAuth sessions do not automatically migrate between machines.

That is expected.

## 10. What New Codex Should Know First

If a new Codex session starts on the new MacBook, it should know these points immediately:

- use `/Users/akshaychouhan/ledgerai`, not the empty Downloads folder
- production frontend deploy is `npm run deploy`
- production worker deploy is Wrangler with the Cloudflare token from `~/.config/ledgerai/cloudflare.env`
- the most sensitive runtime logic is in `/Users/akshaychouhan/ledgerai/src/App.jsx`
- reconnect-loop and pending-retry issues were already heavily worked on in this session
- if reconnect appears again, the next best debugging step is to add a small per-account "last auth error" debug line in the UI rather than guessing

## 11. Repo State Warning

This repo has local/uncommitted work and should be transferred carefully.

At various points during this worktree, these files were modified or present:

- `/Users/akshaychouhan/ledgerai/src/App.jsx`
- `/Users/akshaychouhan/ledgerai/scripts/cloudflare-ai-worker.js`
- `/Users/akshaychouhan/ledgerai/wrangler.toml`
- `/Users/akshaychouhan/ledgerai/package.json`
- `/Users/akshaychouhan/ledgerai/package-lock.json`
- `/Users/akshaychouhan/ledgerai/README.md`
- plus some user-local files like `app.json`, `eas.json`, `.wrangler/`, `.claude/`

If moving machines before cleaning up git history, transfer the whole repo directory including `.git`.

## 12. Suggested First Commands For New Codex

```bash
cd ~/ledgerai
git status --short
npm install
npm run build
TOKEN=$(sed -n 's/^export CF_API_TOKEN=//p' "$HOME/.config/ledgerai/cloudflare.env" | tr -d "'\r\n")
CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler whoami
```

