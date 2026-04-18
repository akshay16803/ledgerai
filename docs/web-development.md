# LedgerAI Web Development

## Local development

From `/Users/akshaychouhan/ledgerai`:

```bash
npm install
npm run dev
```

The web app runs on:

- `http://localhost:3000`

## Environment

Configure `/Users/akshaychouhan/ledgerai/.env.example` values in your real `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_MICROSOFT_CLIENT_ID` if Outlook/OneDrive default setup should be prefilled
- optional AI defaults if needed

If Supabase env vars are missing:

- on `localhost`, LedgerAI falls back to the legacy app boot path for developer work only
- on non-local deployments, LedgerAI blocks launch and shows a cloud configuration error instead of exposing a legacy-first product mode

Other setup required for the full web launch path:

- hosted Supabase Auth redirect/password-reset URLs
- deployed Cloudflare AI worker plus in-product AI settings
- Google/Microsoft OAuth credentials for the email/provider flows you plan to expose

## Production deploy

Frontend:

```bash
npm run deploy
```

This publishes the Vite build to GitHub Pages for:

- `https://spentyai.com`

Worker:

Deploy separately with Wrangler using:

- `/Users/akshaychouhan/ledgerai/scripts/cloudflare-ai-worker.js`
- `/Users/akshaychouhan/ledgerai/wrangler.toml`

## Notes

- The authenticated shell loads cloud data first, then mounts the existing `App.jsx`.
- A signed-in user with no cloud data lands in a clean account-backed workspace.
- OneDrive remains optional backup/export inside the product, not launch onboarding.

## Manual validation before launch

- sign up / sign in / sign out
- forgot-password email and reset completion
- session persistence after browser refresh
- empty-account first run with no migration/import prompt
- user A vs user B isolation
- Gmail/Outlook reconnect and sync with real provider credentials
- AI retry behavior with the deployed worker
