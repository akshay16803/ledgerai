/**
 * Cloudflare Worker: LedgerAI AI proxy + optional cloud retry queue
 *
 * Required secrets:
 * - OPENAI_API_KEY (for GPT/o models) or ANTHROPIC_API_KEY (for Claude models)
 *
 * Optional secrets/vars:
 * - LEDGERAI_SHARED_KEY  (recommended)
 * - ALLOWED_ORIGIN       (default "*")
 *
 * Optional KV binding (for background retry queue):
 * - LEDGERAI_RETRY_KV
 *
 * Routes:
 * - POST /                    { model, max_tokens, messages } -> { text, usage }
 * - POST /retry/enqueue       enqueue AI retry job for background processing
 * - GET  /retry/pull?clientId=<id>&limit=<n>   pull completed jobs
 *
 * Cron:
 * - Configure a cron trigger (for example every 5 minutes) to process retries
 */

const DEFAULT_MODEL = "gpt-4.1-mini";
const MAX_TOKENS = 4096;
const MIN_TOKENS = 64;
const RETRY_PREFIX = "retry:";
const MAX_RETRY_ATTEMPTS = 10;
const JOB_TTL_SECONDS = 14 * 24 * 60 * 60;
const FX_API_BASE = "https://api.frankfurter.dev/v1";
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_ALIASES = {
  "₹": "INR",
  RS: "INR",
  INR: "INR",
  RUPEE: "INR",
  RUPEES: "INR",
  "$": "USD",
  USD: "USD",
  DOLLAR: "USD",
  DOLLARS: "USD",
  "€": "EUR",
  EUR: "EUR",
  EURO: "EUR",
  EUROS: "EUR",
  "£": "GBP",
  GBP: "GBP",
  POUND: "GBP",
  POUNDS: "GBP",
  AED: "AED",
  DIRHAM: "AED",
  DIRHAMS: "AED",
  AUD: "AUD",
  CAD: "CAD",
  SGD: "SGD",
  JPY: "JPY",
  YEN: "JPY",
  CNY: "CNY",
  RMB: "CNY",
  HKD: "HKD",
  CHF: "CHF",
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

function corsHeaders(origin, allowedOrigin = "*") {
  const allow = allowedOrigin === "*" ? "*" : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,x-ledgerai-key",
    Vary: "Origin",
    "X-Request-Origin": origin || "",
  };
}

function normalizePath(pathname = "/") {
  const clean = String(pathname || "/").trim();
  if (!clean) return "/";
  if (clean === "/") return "/";
  return clean.replace(/\/+$/, "");
}

function sanitizeId(value = "", fallback = "") {
  const clean = String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "");
  return clean || fallback;
}

function normalizeModel(model) {
  const m = String(model || DEFAULT_MODEL).trim();
  return m || DEFAULT_MODEL;
}

function normalizeMaxTokens(value) {
  return Math.max(MIN_TOKENS, Math.min(Number(value) || 800, MAX_TOKENS));
}

function normalizeCurrencyCode(value = "", fallback = "") {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return fallback;
  if (CURRENCY_ALIASES[raw]) return CURRENCY_ALIASES[raw];
  const letters = raw.replace(/[^A-Z]/g, "");
  if (CURRENCY_ALIASES[letters]) return CURRENCY_ALIASES[letters];
  if (/^[A-Z]{3}$/.test(letters)) return letters;
  return fallback;
}

function normalizeFxDate(value = "") {
  const raw = String(value || "").trim();
  if (ISO_DATE_RE.test(raw)) return raw;
  const ts = Date.parse(raw);
  if (Number.isFinite(ts)) return new Date(ts).toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const clipped = messages.slice(0, 12).map((m) => ({
    role: String(m?.role || "user"),
    content: m?.content,
  }));
  return clipped;
}

function authFailed(request, env) {
  if (!env.LEDGERAI_SHARED_KEY) return false;
  const got = request.headers.get("x-ledgerai-key") || "";
  return got !== env.LEDGERAI_SHARED_KEY;
}

function retryDelayMs(attempt) {
  const a = Math.max(1, Number(attempt) || 1);
  const exp = Math.min(12 * 60 * 60 * 1000, 5 * 60 * 1000 * 2 ** (a - 1));
  const jitter = Math.floor(Math.random() * 20_000);
  return exp + jitter;
}

function kvMissing(env) {
  return !env.LEDGERAI_RETRY_KV;
}

function retryKey(clientId, jobId) {
  return `${RETRY_PREFIX}${clientId}:${jobId}`;
}

async function callAiProvider(env, payload = {}) {
  const model = normalizeModel(payload.model);
  const maxTokens = normalizeMaxTokens(payload.max_tokens);
  const messages = normalizeMessages(payload.messages);
  if (!messages) {
    const err = new Error("messages[] is required");
    err.status = 400;
    throw err;
  }

  const useOpenAI = /^(gpt|o[0-9])/i.test(model);
  let upstream;
  if (useOpenAI) {
    if (!env.OPENAI_API_KEY) {
      const err = new Error(`Missing OPENAI_API_KEY for model ${model}`);
      err.status = 500;
      throw err;
    }
    upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0,
        max_tokens: maxTokens,
      }),
    });
  } else {
    if (!env.ANTHROPIC_API_KEY) {
      const err = new Error(`Missing ANTHROPIC_API_KEY for model ${model}`);
      err.status = 500;
      throw err;
    }
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages,
      }),
    });
  }

  const raw = await upstream.text();
  let data = {};
  try {
    data = JSON.parse(raw || "{}");
  } catch {}

  if (!upstream.ok) {
    const err = new Error(
      data?.error?.message || data?.message || raw.slice(0, 300) || `Upstream ${upstream.status}`,
    );
    err.status = upstream.status;
    throw err;
  }

  const text = useOpenAI
    ? data?.choices?.[0]?.message?.content || ""
    : data?.content?.[0]?.text || "";

  return {
    text: String(text || ""),
    usage: data?.usage || null,
  };
}

async function fetchFxRate(from = "", to = "", date = "") {
  const source = normalizeCurrencyCode(from, "");
  const target = normalizeCurrencyCode(to, "");
  const requestedDate = normalizeFxDate(date);
  if (!source || !target) {
    const err = new Error("from/to currency is required");
    err.status = 400;
    throw err;
  }
  if (source === target) {
    return {
      from: source,
      to: target,
      requestedDate,
      rateDate: requestedDate,
      rate: 1,
      provider: "identity",
    };
  }

  const url = `${FX_API_BASE}/${requestedDate}?base=${encodeURIComponent(source)}&symbols=${encodeURIComponent(target)}`;
  const upstream = await fetch(url, { headers: { Accept: "application/json" } });
  const raw = await upstream.text();
  let data = {};
  try {
    data = JSON.parse(raw || "{}");
  } catch {}

  if (!upstream.ok) {
    const err = new Error(data?.message || raw.slice(0, 300) || `FX upstream ${upstream.status}`);
    err.status = upstream.status;
    throw err;
  }

  const rate = Number(data?.rates?.[target]);
  if (!(rate > 0)) {
    const err = new Error(`FX rate unavailable for ${source}/${target}`);
    err.status = 502;
    throw err;
  }

  return {
    from: source,
    to: target,
    requestedDate,
    rateDate: String(data?.date || requestedDate),
    rate,
    provider: "ECB via Frankfurter",
  };
}

async function convertFxItems(payload = {}) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) {
    return { ok: false, status: 400, error: "items[] is required" };
  }

  const clean = items
    .slice(0, 250)
    .map((item, idx) => {
      const amount = Number(item?.amount);
      if (!Number.isFinite(amount)) return null;
      const from = normalizeCurrencyCode(item?.from || item?.currency || "", "");
      const to = normalizeCurrencyCode(item?.to || item?.baseCurrency || "", "");
      if (!from || !to) return null;
      return {
        id: String(item?.id || idx),
        amount,
        from,
        to,
        date: normalizeFxDate(item?.date || item?.fxDate || ""),
      };
    })
    .filter(Boolean);

  if (!clean.length) {
    return { ok: false, status: 400, error: "No valid FX conversion items were provided" };
  }

  const rateCache = new Map();
  await Promise.all(
    clean.map(async (item) => {
      const key = `${item.from}:${item.to}:${item.date}`;
      if (rateCache.has(key)) return;
      const rate = await fetchFxRate(item.from, item.to, item.date);
      rateCache.set(key, rate);
    }),
  );

  return {
    ok: true,
    results: clean.map((item) => {
      const key = `${item.from}:${item.to}:${item.date}`;
      const fx = rateCache.get(key);
      const converted = Number((item.amount * fx.rate).toFixed(2));
      return {
        id: item.id,
        amount: item.amount,
        from: fx.from,
        to: fx.to,
        requestedDate: fx.requestedDate,
        rateDate: fx.rateDate,
        rate: fx.rate,
        converted,
        provider: fx.provider,
      };
    }),
  };
}

async function enqueueRetryJob(env, payload = {}) {
  if (kvMissing(env)) {
    return { ok: false, status: 501, error: "LEDGERAI_RETRY_KV binding is missing" };
  }

  const clientId = sanitizeId(payload.clientId, "");
  const accountId = sanitizeId(payload.accountId, "");
  const msgId = String(payload.msgId || "").trim();
  const rowId = String(payload.rowId || "").trim();
  const provider = String(payload.provider || "google").toLowerCase() === "microsoft" ? "microsoft" : "google";
  const subject = String(payload.subject || "");
  const from = String(payload.from || "");
  const emailDate = String(payload.emailDate || "");
  const messages = normalizeMessages(payload.messages);
  const model = normalizeModel(payload.model);
  const maxTokens = normalizeMaxTokens(payload.max_tokens);
  const queuedAt = String(payload.queuedAt || new Date().toISOString());
  const jobId = sanitizeId(payload.jobId, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  if (!clientId) return { ok: false, status: 400, error: "clientId is required" };
  if (!accountId) return { ok: false, status: 400, error: "accountId is required" };
  if (!msgId) return { ok: false, status: 400, error: "msgId is required" };
  if (!messages) return { ok: false, status: 400, error: "messages[] is required" };

  const messagesSize = JSON.stringify(messages).length;
  if (messagesSize > 220_000) {
    return { ok: false, status: 413, error: "messages payload too large" };
  }

  const nowIso = new Date().toISOString();
  const key = retryKey(clientId, jobId);
  const job = {
    jobId,
    clientId,
    rowId: rowId || `${accountId}::${msgId}`,
    accountId,
    provider,
    msgId,
    subject: subject.slice(0, 400),
    from: from.slice(0, 300),
    emailDate: emailDate.slice(0, 30),
    model,
    max_tokens: maxTokens,
    messages,
    status: "pending",
    attempts: 0,
    nextRetryAt: nowIso,
    lastError: "",
    outputText: "",
    usage: null,
    queuedAt,
    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: "",
  };

  await env.LEDGERAI_RETRY_KV.put(key, JSON.stringify(job), { expirationTtl: JOB_TTL_SECONDS });
  return { ok: true, jobId, key };
}

async function processRetryQueue(env, opts = {}) {
  if (kvMissing(env)) return { processedCount: 0 };
  const budget = Math.max(1, Math.min(Number(opts.budget) || 50, 300));
  let cursor = undefined;
  let processed = 0;
  let scannedPages = 0;

  while (processed < budget) {
    scannedPages += 1;
    if (scannedPages > 30) break;
    const page = await env.LEDGERAI_RETRY_KV.list({ prefix: RETRY_PREFIX, cursor, limit: 100 });
    if (!page?.keys?.length) break;

    for (const k of page.keys) {
      if (processed >= budget) break;
      const key = k?.name || "";
      if (!key) continue;

      let job = await env.LEDGERAI_RETRY_KV.get(key, "json");
      if (!job || typeof job !== "object") {
        await env.LEDGERAI_RETRY_KV.delete(key);
        continue;
      }
      if (job.status !== "pending") continue;

      const dueAtMs = Date.parse(job.nextRetryAt || "");
      if (Number.isFinite(dueAtMs) && dueAtMs > Date.now()) continue;

      try {
        const out = await callAiProvider(env, {
          model: job.model,
          max_tokens: job.max_tokens,
          messages: job.messages,
        });
        job = {
          ...job,
          status: "done",
          outputText: String(out.text || ""),
          usage: out.usage || null,
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          lastError: "",
        };
      } catch (err) {
        const attempts = Math.max(0, Number(job.attempts) || 0) + 1;
        const terminal = attempts >= MAX_RETRY_ATTEMPTS;
        const nextRetry = new Date(Date.now() + retryDelayMs(attempts)).toISOString();
        job = {
          ...job,
          status: terminal ? "failed" : "pending",
          attempts,
          updatedAt: new Date().toISOString(),
          nextRetryAt: terminal ? "" : nextRetry,
          lastError: String(err?.message || "retry_failed").slice(0, 300),
        };
      }

      await env.LEDGERAI_RETRY_KV.put(key, JSON.stringify(job), { expirationTtl: JOB_TTL_SECONDS });
      processed += 1;
    }

    if (page.list_complete) break;
    cursor = page.cursor;
  }

  return { processedCount: processed };
}

async function pullCompletedJobs(env, clientId, limit = 40) {
  if (kvMissing(env)) return { jobs: [] };
  const safeClient = sanitizeId(clientId, "");
  if (!safeClient) return { jobs: [] };
  const cap = Math.max(1, Math.min(Number(limit) || 40, 200));
  const prefix = `${RETRY_PREFIX}${safeClient}:`;

  let cursor = undefined;
  const jobs = [];
  const keysToDelete = [];
  let scannedPages = 0;

  while (jobs.length < cap) {
    scannedPages += 1;
    if (scannedPages > 30) break;
    const page = await env.LEDGERAI_RETRY_KV.list({ prefix, cursor, limit: 100 });
    if (!page?.keys?.length) break;

    for (const k of page.keys) {
      if (jobs.length >= cap) break;
      const key = k?.name || "";
      if (!key) continue;
      const job = await env.LEDGERAI_RETRY_KV.get(key, "json");
      if (!job || typeof job !== "object") {
        keysToDelete.push(key);
        continue;
      }
      if (job.status !== "done") continue;
      jobs.push({
        jobId: String(job.jobId || ""),
        rowId: String(job.rowId || ""),
        accountId: String(job.accountId || ""),
        provider: String(job.provider || "google"),
        msgId: String(job.msgId || ""),
        subject: String(job.subject || ""),
        from: String(job.from || ""),
        emailDate: String(job.emailDate || ""),
        outputText: String(job.outputText || ""),
        usage: job.usage || null,
        attempts: Math.max(0, Number(job.attempts) || 0),
        queuedAt: String(job.queuedAt || ""),
        completedAt: String(job.completedAt || ""),
      });
      keysToDelete.push(key);
    }

    if (page.list_complete) break;
    cursor = page.cursor;
  }

  if (keysToDelete.length) {
    await Promise.all(keysToDelete.map((key) => env.LEDGERAI_RETRY_KV.delete(key)));
  }
  return { jobs };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN || "*");
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (authFailed(request, env)) {
      return json({ error: "Unauthorized" }, 401, cors);
    }

    if (path === "/retry/enqueue") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
      let payload = null;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400, cors);
      }
      const out = await enqueueRetryJob(env, payload || {});
      return json(out.ok ? { ok: true, jobId: out.jobId } : { error: out.error }, out.status || 200, cors);
    }

    if (path === "/fx/convert") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
      let payload = null;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400, cors);
      }
      try {
        const out = await convertFxItems(payload || {});
        return json(out.ok ? { ok: true, results: out.results } : { error: out.error }, out.status || 200, cors);
      } catch (err) {
        const status = Math.max(400, Math.min(Number(err?.status) || 500, 599));
        return json({ error: String(err?.message || "FX conversion failed").slice(0, 300) }, status, cors);
      }
    }

    if (path === "/retry/pull") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, cors);
      if (kvMissing(env)) return json({ error: "LEDGERAI_RETRY_KV binding is missing" }, 501, cors);
      const clientId = sanitizeId(url.searchParams.get("clientId") || "", "");
      if (!clientId) return json({ error: "clientId is required" }, 400, cors);
      const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 40, 200));
      const proc = await processRetryQueue(env, { budget: 25 });
      const pulled = await pullCompletedJobs(env, clientId, limit);
      return json(
        {
          ok: true,
          jobs: pulled.jobs || [],
          processedCount: Number(proc.processedCount) || 0,
        },
        200,
        cors,
      );
    }

    if (path !== "/") {
      return json({ error: "Not found" }, 404, cors);
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    let payload = null;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, cors);
    }

    try {
      const out = await callAiProvider(env, payload || {});
      return json({ text: out.text, usage: out.usage }, 200, cors);
    } catch (err) {
      const status = Math.max(400, Math.min(Number(err?.status) || 500, 599));
      return json(
        {
          error: String(err?.message || "AI upstream failed").slice(0, 300),
          upstream_status: status,
        },
        status,
        cors,
      );
    }
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(processRetryQueue(env, { budget: 180 }));
  },
};
