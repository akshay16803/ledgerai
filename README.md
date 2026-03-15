# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## LedgerAI AI Backend (Production)

LedgerAI now expects an AI backend endpoint in **Settings -> AI Backend (Production)**.

Use the included Cloudflare Worker:

1. Install Wrangler: `npm i -g wrangler`
2. Create a Worker project and copy `scripts/cloudflare-ai-worker.js` as worker code.
3. Set Worker secrets:
   - `ANTHROPIC_API_KEY` (for Claude models) OR `OPENAI_API_KEY` (for ChatGPT models)
   - `LEDGERAI_SHARED_KEY` (optional, recommended)
4. Set optional Worker variable:
   - `ALLOWED_ORIGIN=https://accounts.niprasha.com`
5. (Recommended for true background AI retry) add a KV binding named `LEDGERAI_RETRY_KV` and add a cron trigger (for example every 5 minutes).
6. Deploy worker and copy URL (for example `https://ledgerai-ai.your-subdomain.workers.dev`).
7. In app Settings, set:
   - `AI Endpoint URL` = worker URL
   - `Shared Key` = same as `LEDGERAI_SHARED_KEY` (if used)
   - `Model` = `claude-sonnet-4-20250514` or `gpt-4.1-mini`
8. Click **Save AI Config** then **Test AI Backend**.

When KV + cron are configured, AI pending retry items are processed in cloud (`/retry/enqueue`, `/retry/pull`) even when the browser is closed.

If AI backend is not configured, LedgerAI falls back to heuristic parsing with lower accuracy.

## Outlook One-Click OAuth (Owner Setup Once)

To make `+ Connect Outlook Account` one-click for end users, set a deploy-time env var:

- `VITE_MICROSOFT_CLIENT_ID=<your Azure App Registration Client ID>`

After this is set and deployed, users only click Connect Outlook -> Microsoft sign-in -> consent.
