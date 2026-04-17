/**
 * Email Processing Module
 * 
 * This module handles:
 * - Email fetching from Gmail and Microsoft Outlook
 * - AI-powered transaction extraction
 * - Cloud queue operations for retry logic
 * - Currency conversion and normalization
 */

import { decode as decodeBase64 } from "base-64";
import { cloudQueueLogger, aiAnalysisLogger } from "@lib/utils/logger";
import {
  DEFAULT_AI_MODEL,
  DEFAULT_BASE_CURRENCY,
  CURRENCY_ALIASES,
  ISO_DATE_RE,
  CLOUD_PULL_TIMEOUT_MS,
  CLOUD_ENQUEUE_TIMEOUT_MS,
} from "@lib/constants";

// ============================================================================
// MODULE-SPECIFIC CONSTANTS
// ============================================================================

const GRAPH = "https://graph.microsoft.com/v1.0";
const GMAIL_QUERY = "in:anywhere";
const FALLBACK_AI_ENDPOINT = "https://ledgerai-ai.akshaychouhan16803.workers.dev";
const DEFAULT_AI_ENDPOINT = normalizeAiEndpointUrl(
  String(process.env.EXPO_PUBLIC_AI_ENDPOINT_DEFAULT || "").trim() || FALLBACK_AI_ENDPOINT,
);

export type AiConfig = {
  endpoint: string;
  secret: string;
  bearerToken?: string;
  model: string;
};

export type EmailEvidence = {
  subject: string;
  from: string;
  rawDate: string;
  body: string;
  hasAttachment: boolean;
  attachmentNames: string[];
  attachmentText: string;
  eDate: string;
};

export type EmailExtractionContext = {
  acts: string[];
  cats: Record<string, string[]>;
  accountNames: string[];
  baseCurrency: string;
  aiConfig: AiConfig;
};

export type StatementParseContext = {
  accountName: string;
  accountType: string;
  accountCurrency: string;
  baseCurrency: string;
  aiConfig: AiConfig;
};

export type ExtractedEmailItem = {
  type: "income" | "expense" | "transfer";
  amount: number;
  originalAmount: number;
  baseAmount: number;
  currency: string;
  baseCurrency: string;
  businessActivity: string;
  category: string;
  subCategory: string;
  description: string;
  vendor: string;
  trackVendor: boolean;
  paymentMethod: string;
  accountName: string;
  targetAccountName: string;
  date: string;
  fxRate: number;
  fxDate: string;
  fxRateDate: string;
  fxSource: string;
};

// ============================================================================
// CLOUD QUEUE TYPES
// Types for cloud-based retry queue operations
// ============================================================================

export type EmailAnalysisResult = {
  status: "success" | "no_transaction" | "retry";
  reason: string;
  items: ExtractedEmailItem[];
  messages: Array<{ role: "user"; content: string }>;
};

export type CloudRetryJobPayload = {
  jobId: string;
  clientId: string;
  accountId: string;
  provider: "google" | "microsoft";
  msgId: string;
  rowId: string;
  subject: string;
  from: string;
  emailDate: string;
  model: string;
  max_tokens: number;
  messages: Array<{ role: "user"; content: string }>;
  queuedAt: string;
};

export type CloudRetryJobResult = {
  jobId: string;
  rowId: string;
  accountId: string;
  provider: "google" | "microsoft";
  msgId: string;
  subject: string;
  from: string;
  emailDate: string;
  outputText: string;
  status?: string;
  lastError?: string;
  usage: unknown;
  attempts: number;
  queuedAt: string;
  completedAt: string;
};

export type ProviderMessage = {
  id: string;
  subject?: string;
  from?: { emailAddress?: { address?: string } };
};

function asString(value: unknown, fallback = "") {
  return String(value || fallback).trim();
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// ============================================================================
// UTILITY FUNCTIONS
// Date formatting, currency normalization, ID generation
// ============================================================================

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function roundMoney(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export function normalizeCurrencyCode(value: unknown, fallback = DEFAULT_BASE_CURRENCY) {
  const raw = asString(value).toUpperCase();
  if (!raw) return fallback;
  if (CURRENCY_ALIASES[raw]) return CURRENCY_ALIASES[raw];
  const letters = raw.replace(/[^A-Z]/g, "");
  if (!letters) return fallback;
  if (CURRENCY_ALIASES[letters]) return CURRENCY_ALIASES[letters];
  return /^[A-Z]{3}$/.test(letters) ? letters : fallback;
}

export function formatIsoDate(value: unknown, fallback = todayIso()) {
  const raw = asString(value);
  if (!raw) return fallback;
  if (ISO_DATE_RE.test(raw)) return raw;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : fallback;
}

export function gmailDate(value: string) {
  const normalized = formatIsoDate(value, "");
  return normalized ? normalized.replace(/-/g, "/") : "";
}

export function makeEmailInboxClientId(accountId: string, msgId: string, index: number) {
  return `email-inbox:${accountId}:${msgId}:${index}`;
}

export function makeAiPendingId(accountId: string, msgId: string) {
  return `${String(accountId || "").trim()}::${String(msgId || "").trim()}`;
}

export function quickHash(str = "") {
  let hash = 2166136261;
  for (let index = 0; index < str.length; index += 1) {
    hash ^= str.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function stableAiCloudClientId(owner = "") {
  const normalizedOwner = asString(owner || "ledgerai-user").toLowerCase();
  return `ledger-${quickHash(normalizedOwner)}`;
}

export function normalizeAiEndpointUrl(value: string) {
  const raw = asString(value);
  if (!raw) return "";
  const prefixed = raw.startsWith("//") ? `https:${raw}` : raw;
  const withScheme = /^https?:\/\//i.test(prefixed) ? prefixed : `https://${prefixed}`;
  return withScheme.replace(/\/+$/, "");
}

export function normalizeAiConfig(value: unknown): AiConfig {
  const cfg = asObject(value);
  return {
    endpoint: normalizeAiEndpointUrl(asString(cfg.endpoint)) || DEFAULT_AI_ENDPOINT,
    secret: asString(cfg.secret),
    bearerToken: asString(cfg.bearerToken),
    model: asString(cfg.model || DEFAULT_AI_MODEL) || DEFAULT_AI_MODEL,
  };
}

/** Auth mode used for a given AI worker call. Exposed via thrown errors so callers
 * (and logs) can distinguish bearer-JWT 401s from shared-key 401s from "no auth
 * configured" failures without sniffing header strings.
 */
type AiAuthMode = "bearer" | "shared-key" | "none";

function resolveAiAuthMode(aiConfig: AiConfig): AiAuthMode {
  if (asString(aiConfig.bearerToken)) return "bearer";
  if (aiConfig.secret) return "shared-key";
  return "none";
}

function aiAuthHeaders(aiConfig: AiConfig, includeJson = true) {
  const headers: Record<string, string> = {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
  };
  const mode = resolveAiAuthMode(aiConfig);
  if (mode === "bearer") {
    headers.Authorization = `Bearer ${asString(aiConfig.bearerToken)}`;
  } else if (mode === "shared-key") {
    headers["x-ledgerai-key"] = aiConfig.secret;
  }
  return headers;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.ceil(ms / 1000)}s`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ============================================================================
// AI WORKER FUNCTIONS
// Functions for calling AI endpoints (OpenAI via Cloudflare Worker)
// ============================================================================

function normalizeAIText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => normalizeAIText(item)).join("\n");
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.output_text === "string") return obj.output_text;
  }
  return "";
}

async function callAiWorker(aiConfig: AiConfig, messages: Array<{ role: "user"; content: string }>, maxTokens = 1600) {
  aiAnalysisLogger.debug("Calling AI worker", {
    endpoint: aiConfig.endpoint,
    model: aiConfig.model,
    maxTokens,
    messageLength: messages[0]?.content?.length || 0,
  });

  if (!aiConfig.endpoint) {
    aiAnalysisLogger.error("AI backend endpoint missing");
    throw new Error("AI backend endpoint missing. Configure LedgerAI AI backend before syncing email.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch(aiConfig.endpoint, {
      method: "POST",
      headers: aiAuthHeaders(aiConfig, true),
      body: JSON.stringify({
        model: aiConfig.model || DEFAULT_AI_MODEL,
        max_tokens: maxTokens,
        messages,
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text || "{}");
    } catch {}

    aiAnalysisLogger.debug("AI worker response", {
      status: response.status,
      ok: response.ok,
      hasText: Boolean(data.text),
      error: data.error,
    });

    if (!response.ok) {
      const authMode = resolveAiAuthMode(aiConfig);
      const isAuth = response.status === 401 || response.status === 403;
      const baseMessage = asString(data.error || data.message || text || `AI ${response.status}`);
      const errMessage = isAuth
        ? `AI worker rejected ${authMode} auth (HTTP ${response.status}): ${baseMessage}`
        : baseMessage;
      const err = new Error(errMessage) as Error & { status?: number; authMode?: AiAuthMode; authFailure?: boolean };
      err.status = response.status;
      err.authMode = authMode;
      err.authFailure = isAuth;
      aiAnalysisLogger.error("AI worker failed", { status: response.status, authMode, authFailure: isAuth, error: errMessage });
      throw err;
    }
    return normalizeAIText(data.text ?? data.output_text ?? data.output ?? data.content) || "";
  } finally {
    clearTimeout(timer);
  }
}

async function callFxConvert(aiConfig: AiConfig, items: Array<{ id: string; amount: number; from: string; to: string; date: string }>) {
  if (!aiConfig.endpoint || !items.length) {
    return {
      ok: false,
      results: [],
    };
  }
  const url = `${normalizeAiEndpointUrl(aiConfig.endpoint)}/fx/convert`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: aiAuthHeaders(aiConfig, true),
      body: JSON.stringify({ items }),
      signal: controller.signal,
    });
    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text || "{}");
    } catch {}
    if (!response.ok) {
      return {
        ok: false,
        results: [],
      };
    }
    return {
      ok: Boolean(data.ok !== false),
      results: Array.isArray(data.results) ? data.results as Array<Record<string, unknown>> : [],
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callCloudQueueEndpoint(
  aiConfig: AiConfig,
  path: string,
  init: RequestInit,
  label: string,
) {
  const endpoint = normalizeAiEndpointUrl(aiConfig.endpoint || "");
  if (!endpoint) {
    cloudQueueLogger.error("AI backend endpoint missing for cloud queue");
    throw new Error("AI backend endpoint missing. Configure LedgerAI AI backend before syncing email.");
  }

  const url = `${endpoint}${path}`;
  const controller = new AbortController();
  // Use longer timeout for /retry/pull which processes multiple AI jobs
  const timeoutMs = path.includes("/retry/pull") ? CLOUD_PULL_TIMEOUT_MS : CLOUD_ENQUEUE_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  cloudQueueLogger.debug("Calling cloud queue endpoint", {
    path,
    timeoutMs,
    method: init.method || "GET",
  });

  try {
    const response = await fetch(url, {
      ...init,
      headers: aiAuthHeaders(aiConfig, init.body !== undefined),
      signal: controller.signal,
    });
    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text || "{}");
    } catch {}

    cloudQueueLogger.debug("Cloud queue response", {
      path,
      status: response.status,
      ok: response.ok,
      jobCount: Array.isArray(data.jobs) ? data.jobs.length : undefined,
    });

    if (!response.ok) {
      const authMode = resolveAiAuthMode(aiConfig);
      const isAuth = response.status === 401 || response.status === 403;
      const baseMessage = asString(data.error || data.message || text || `${label} ${response.status}`);
      const errMessage = isAuth
        ? `${label} rejected ${authMode} auth (HTTP ${response.status}): ${baseMessage}`
        : baseMessage;
      const err = new Error(errMessage) as Error & { status?: number; authMode?: AiAuthMode; authFailure?: boolean };
      err.status = response.status;
      err.authMode = authMode;
      err.authFailure = isAuth;
      cloudQueueLogger.error("Cloud queue request failed", { path, status: response.status, authMode, authFailure: isAuth, error: errMessage });
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function enqueueCloudRetryJob(aiConfig: AiConfig, job: CloudRetryJobPayload) {
  const data = await callCloudQueueEndpoint(aiConfig, "/retry/enqueue", {
    method: "POST",
    body: JSON.stringify(job || {}),
  }, "Cloud AI retry enqueue");
  return {
    ok: true,
    jobId: asString(data.jobId || job.jobId),
  };
}

export async function pullCloudRetryJobs(aiConfig: AiConfig, clientId: string, limit = 40) {
  const endpoint = normalizeAiEndpointUrl(aiConfig.endpoint || "");
  if (!endpoint) {
    throw new Error("AI backend endpoint missing. Configure LedgerAI AI backend before syncing email.");
  }
  const url = new URL(`${endpoint}/retry/pull`);
  url.searchParams.set("clientId", asString(clientId));
  url.searchParams.set("limit", String(Math.max(1, Math.min(Number(limit) || 40, 200))));
  const data = await callCloudQueueEndpoint(aiConfig, "/retry/pull?" + url.searchParams.toString(), {
    method: "GET",
  }, "Cloud AI retry pull");
  return {
    ok: true,
    jobs: Array.isArray(data.jobs) ? data.jobs as Array<CloudRetryJobResult> : [],
    processedCount: Number(data.processedCount) || 0,
  };
}

export async function parseStatementWithAi(text: string, context: StatementParseContext) {
  const raw = await withTimeout(callAiWorker(context.aiConfig, [{
    role: "user",
    content: `Parse bank/card statement.
Account: ${context.accountName} (${context.accountType})
Account currency hint: ${context.accountCurrency || "unknown"}
Ledger base currency: ${context.baseCurrency}
Statement text:
${String(text || "").slice(0, 7000)}
Detect the currency for every transaction row and return ISO currency code.
Return ONLY JSON array: [{"date":"YYYY-MM-DD","description":"","amount":0,"currency":"","type":"debit|credit","reference":"","balance":null,"balanceCurrency":""}]`,
  }], 1800), 35_000, "AI statement parse");

  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : [];
  } catch {
    return [];
  }
}

export async function convertStatementRowsToBaseCurrency(
  rows: Array<Record<string, unknown>>,
  context: {
    aiConfig: AiConfig;
    baseCurrency: string;
    fallbackCurrency: string;
    dateResolver?: (row: Record<string, unknown>) => string;
  },
) {
  const normalizedBase = normalizeCurrencyCode(context.baseCurrency, DEFAULT_BASE_CURRENCY);
  const fallbackCurrency = normalizeCurrencyCode(context.fallbackCurrency, normalizedBase);
  const resolveDate = context.dateResolver || ((row: Record<string, unknown>) => asString(row.date) || todayIso());

  const prepared = rows.map((row, index) => {
    const amount = Number(row.originalAmount ?? row.amount ?? 0);
    return {
      row,
      id: asString(row._sid || row.id || `statement-row-${index}`),
      amount: Number.isFinite(amount) ? amount : 0,
      from: normalizeCurrencyCode(row.currency, fallbackCurrency),
      to: normalizedBase,
      date: formatIsoDate(resolveDate(row), todayIso()),
    };
  });

  const fx = await callFxConvert(context.aiConfig, prepared.map((item) => ({
    id: item.id,
    amount: item.amount,
    from: item.from,
    to: item.to,
    date: item.date,
  })));
  const fxById = new Map(fx.results.map((row) => [asString(row.id), row]));

  return prepared.map((item) => {
    const fxRow = fxById.get(item.id);
    const originalAmount = roundMoney(item.amount);
    const identity = item.from === normalizedBase;
    const converted = Number(fxRow?.converted || 0);
    const rate = Number(fxRow?.rate || 0);
    return {
      ...item.row,
      currency: item.from,
      originalAmount,
      amount: roundMoney(identity ? originalAmount : (converted || originalAmount)),
      baseAmount: roundMoney(identity ? originalAmount : (converted || originalAmount)),
      baseCurrency: normalizedBase,
      fxRate: identity ? 1 : (rate > 0 ? rate : 1),
      fxDate: item.date,
      fxRateDate: asString(fxRow?.rateDate || item.date),
      fxSource: asString(fxRow?.provider || (identity ? "identity" : "worker_fx")),
    };
  });
}

function decodeB64(value = "") {
  try {
    return decodeURIComponent(escape(decodeBase64(String(value || "").replace(/-/g, "+").replace(/_/g, "/"))));
  } catch {
    return "";
  }
}

function decodeB64Binary(value = "") {
  try {
    return decodeBase64(String(value || "").replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return "";
  }
}

function htmlToText(html = "") {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmailTextAll(payload: Record<string, unknown> | null | undefined, depth = 0, out: string[] = []) {
  if (depth > 8 || !payload) return out;
  const mime = asString(payload.mimeType).toLowerCase();
  const body = asObject(payload.body);
  const data = body.data ? decodeB64(asString(body.data)) : "";
  if (data) {
    out.push(mime.includes("html") ? htmlToText(data) : data.replace(/\s+/g, " ").trim());
  }
  const parts = Array.isArray(payload.parts) ? payload.parts as Array<Record<string, unknown>> : [];
  parts.forEach((part) => extractEmailTextAll(part, depth + 1, out));
  return out;
}

function collapseTextParts(parts: string[]) {
  const seen = new Set<string>();
  const merged: string[] = [];
  parts.forEach((part) => {
    const text = asString(part).replace(/\s+/g, " ").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    merged.push(text);
  });
  return merged.join("\n");
}

function collectGmailAttachmentMeta(payload: Record<string, unknown> | null | undefined, out: Array<Record<string, unknown>> = []) {
  if (!payload) return out;
  const filename = asString(payload.filename);
  const body = asObject(payload.body);
  const attachmentId = asString(body.attachmentId);
  const size = Number(body.size) || 0;
  const mimeType = asString(payload.mimeType).toLowerCase();
  if (filename && attachmentId) {
    out.push({ name: filename, attachmentId, size, mimeType });
  }
  const parts = Array.isArray(payload.parts) ? payload.parts as Array<Record<string, unknown>> : [];
  parts.forEach((part) => collectGmailAttachmentMeta(part, out));
  return out;
}

function extractReadableAttachmentText(rawBinary = "") {
  return rawBinary.replace(/[^\x20-\x7E\r\n]+/g, " ");
}

function extractAttachmentMoneyHints(text = "") {
  const source = text.replace(/\s+/g, " ");
  const regex = /((?:₹|rs\.?|inr|\$|usd|eur|gbp)\s*[0-9]+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?\s*(?:usd|inr|eur|gbp))/ig;
  const out: string[] = [];
  let match;
  while ((match = regex.exec(source)) && out.length < 8) {
    const value = asString(match[1]);
    if (value && !out.includes(value)) out.push(value);
  }
  return out.join(", ");
}

function extractPdfLikeText(binary = "") {
  const ascii = extractReadableAttachmentText(binary);
  const literals: string[] = [];
  const regex = /\(([^()]{2,240})\)/g;
  let match;
  while ((match = regex.exec(binary)) && literals.length < 400) {
    const text = asString(match[1]).replace(/\\[nrtbf()\\]/g, " ").replace(/\s+/g, " ").trim();
    if (text) literals.push(text);
  }
  return [ascii, ...literals].join(" ").replace(/\s+/g, " ").trim();
}

export function extractAttachmentTextByType(binary = "", mimeType = "", name = "") {
  const type = mimeType.toLowerCase();
  const filename = name.toLowerCase();
  if (type.startsWith("text/") || type.includes("json") || type.includes("xml") || type.includes("csv") || type.includes("html") || /\.(txt|csv|json|xml|html?|md|log)$/i.test(filename)) {
    return extractReadableAttachmentText(binary).replace(/\s+/g, " ").trim();
  }
  if (type.includes("pdf") || filename.endsWith(".pdf")) {
    return extractPdfLikeText(binary);
  }
  return extractReadableAttachmentText(binary).replace(/\s+/g, " ").trim();
}

function clipTextForAI(text = "", max = 12_000) {
  const source = text.replace(/\s+/g, " ").trim();
  if (source.length <= max) return source;
  const keyRegex = /(₹|rs\.?|inr|\$|usd|eur|gbp|invoice|receipt|debited|credited|payment|amount|total|refund|payout|settlement|upi|card|account)/ig;
  const windows: string[] = [];
  let match;
  while ((match = keyRegex.exec(source)) && windows.length < 16) {
    const index = match.index || 0;
    windows.push(source.slice(Math.max(0, index - 120), Math.min(source.length, index + 240)));
  }
  const focused = windows.join(" ... ").replace(/\s+/g, " ").trim();
  if (focused.length >= Math.min(max, 4000)) return focused.slice(0, max);
  const head = source.slice(0, Math.floor(max * 0.45));
  const tail = source.slice(-Math.floor(max * 0.45));
  return `${head} ... ${focused} ... ${tail}`.slice(0, max);
}

async function fetchJsonWithRetry(url: string, init: RequestInit, label: string, attempts = 4) {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(text || "{}");
      } catch {}
      if (!response.ok) {
        const err = new Error(asString(data.error || data.message || text || `${label} ${response.status}`));
        (err as Error & { status?: number }).status = response.status;
        throw err;
      }
      return data;
    } catch (error) {
      lastError = error as Error;
      const status = Number((error as Error & { status?: number }).status || 0);
      const retryable = status === 429 || status >= 500 || String((error as Error).message || "").toLowerCase().includes("timed out");
      if (!retryable || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error(`${label} failed`);
}

async function gmailFetch(url: string, token: string, label: string) {
  return fetchJsonWithRetry(url, {
    headers: { Authorization: `Bearer ${token}` },
  }, label);
}

export async function fetchGoogleProfile(token: string) {
  return gmailFetch("https://www.googleapis.com/gmail/v1/users/me/profile", token, "Gmail profile");
}

export async function listGmailMessages(token: string, fromDate: string, maxEmails: number, syncQuery = GMAIL_QUERY) {
  const queryParts = [syncQuery || GMAIL_QUERY];
  const after = gmailDate(fromDate);
  if (after) queryParts.push(`after:${after}`);
  const query = encodeURIComponent(queryParts.join(" ").trim());
  const limit = Math.max(1, Math.min(Number(maxEmails) || 100, 5000));
  let nextPageToken = "";
  const all: ProviderMessage[] = [];
  while (all.length < limit) {
    const params = [`maxResults=${Math.min(100, limit - all.length)}`, `q=${query}`];
    if (nextPageToken) params.push(`pageToken=${encodeURIComponent(nextPageToken)}`);
    const page = await gmailFetch(`https://www.googleapis.com/gmail/v1/users/me/messages?${params.join("&")}`, token, "Gmail list");
    const batch = Array.isArray(page.messages) ? page.messages as ProviderMessage[] : [];
    all.push(...batch);
    nextPageToken = asString(page.nextPageToken);
    if (!nextPageToken || !batch.length) break;
  }
  return all.slice(0, limit);
}

async function gmailGetMessageMetadata(token: string, id: string) {
  return gmailFetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, token, "Gmail message metadata");
}

async function gmailGetMessage(token: string, id: string) {
  try {
    return await gmailFetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, token, "Gmail message");
  } catch {
    const meta = await gmailGetMessageMetadata(token, id);
    return { ...meta, __lite: true };
  }
}

async function gmailGetAttachment(token: string, msgId: string, attachmentId: string) {
  return gmailFetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${attachmentId}`, token, "Gmail attachment");
}

async function gmailAttachmentEvidenceText(token: string, msgId: string, attachments: Array<Record<string, unknown>>) {
  let totalBytes = 0;
  const keep = attachments
    .filter((item) => item.attachmentId && (Number(item.size) || 0) <= 8_000_000)
    .filter((item) => {
      if (totalBytes > 12_000_000) return false;
      totalBytes += Number(item.size) || 0;
      return true;
    })
    .slice(0, 8);

  const chunks: string[] = [];
  for (const item of keep) {
    try {
      const payload = await withTimeout(gmailGetAttachment(token, msgId, asString(item.attachmentId)), 18_000, `Attachment ${asString(item.name)}`);
      const binary = decodeB64Binary(asString(payload.data));
      const compact = extractAttachmentTextByType(binary, asString(item.mimeType), asString(item.name));
      const hints = extractAttachmentMoneyHints(compact);
      const sample = clipTextForAI(compact, 9000);
      if (sample) {
        chunks.push(`[${asString(item.name)}] ${hints ? `Amount hints: ${hints}. ` : ""}${sample}`);
      }
    } catch {}
  }
  return chunks.join("\n");
}

async function msGraphFetch(url: string, token: string, extraHeaders: Record<string, string> = {}) {
  return fetchJsonWithRetry(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...extraHeaders,
    },
  }, "Microsoft Graph");
}

export async function fetchMicrosoftProfileByToken(token: string) {
  return msGraphFetch(`${GRAPH}/me`, token);
}

export async function listMicrosoftMessages(token: string, fromDate: string, maxEmails: number) {
  const target = Math.max(1, Math.min(Number(maxEmails) || 100, 5000));
  const params = new URLSearchParams({
    $top: String(Math.min(50, target)),
    $select: "id,subject,from,receivedDateTime,hasAttachments",
    $orderby: "receivedDateTime desc",
  });
  if (fromDate) params.set("$filter", `receivedDateTime ge ${fromDate}T00:00:00Z`);
  let next = `${GRAPH}/me/messages?${params.toString()}`;
  const all: ProviderMessage[] = [];
  while (next && all.length < target) {
    const page = await msGraphFetch(next, token);
    const batch = Array.isArray(page.value) ? page.value as ProviderMessage[] : [];
    all.push(...batch);
    next = asString(page["@odata.nextLink"]);
  }
  return all.slice(0, target);
}

async function msGetMessage(token: string, id: string) {
  return msGraphFetch(`${GRAPH}/me/messages/${id}?$select=id,subject,from,receivedDateTime,body,bodyPreview,hasAttachments`, token, {
    Prefer: 'outlook.body-content-type="text"',
  });
}

async function msListAttachments(token: string, msgId: string) {
  const data = await msGraphFetch(`${GRAPH}/me/messages/${msgId}/attachments?$top=25&$select=id,name,contentType,size,isInline,@odata.type`, token);
  return Array.isArray(data.value) ? data.value as Array<Record<string, unknown>> : [];
}

async function msGetAttachment(token: string, msgId: string, attachmentId: string) {
  return msGraphFetch(`${GRAPH}/me/messages/${msgId}/attachments/${attachmentId}`, token);
}

async function msAttachmentEvidenceText(token: string, msgId: string, attachments: Array<Record<string, unknown>>) {
  let totalBytes = 0;
  const keep = attachments
    .filter((item) => item.id && item.isInline !== true)
    .filter((item) => (Number(item.size) || 0) <= 8_000_000)
    .filter((item) => {
      if (totalBytes > 12_000_000) return false;
      totalBytes += Number(item.size) || 0;
      return true;
    })
    .slice(0, 8);

  const chunks: string[] = [];
  for (const item of keep) {
    try {
      const full = await withTimeout(msGetAttachment(token, msgId, asString(item.id)), 18_000, `Outlook attachment ${asString(item.name)}`);
      const kind = asString(full["@odata.type"]).toLowerCase();
      if (!kind.includes("fileattachment")) continue;
      const binary = decodeB64Binary(asString(full.contentBytes));
      const compact = extractAttachmentTextByType(binary, asString(full.contentType || item.contentType), asString(full.name || item.name));
      const hints = extractAttachmentMoneyHints(compact);
      const sample = clipTextForAI(compact, 9000);
      if (sample) {
        chunks.push(`[${asString(full.name || item.name || "attachment")}] ${hints ? `Amount hints: ${hints}. ` : ""}${sample}`);
      }
    } catch {}
  }
  return chunks.join("\n");
}

function msExtractBody(message: Record<string, unknown>) {
  const text = `${asString(asObject(message.body).content)} ${asString(message.bodyPreview)}`;
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function fetchMessageEvidence(provider: "google" | "microsoft", token: string, msgId: string): Promise<EmailEvidence> {
  let subject = "";
  let from = "";
  let rawDate = "";
  let body = "";
  let hasAttachment = false;
  let attachmentNames: string[] = [];
  let attachmentText = "";

  if (provider === "microsoft") {
    const message = await withTimeout(msGetMessage(token, msgId), 20_000, "Outlook message fetch");
    subject = asString(message.subject);
    const fromObj = asObject(message.from);
    const emailAddress = asObject(fromObj.emailAddress);
    const address = asString(emailAddress.address);
    const name = asString(emailAddress.name);
    from = name && address ? `${name} <${address}>` : (address || name);
    rawDate = asString(message.receivedDateTime);
    body = msExtractBody(message);
    hasAttachment = message.hasAttachments === true;
    if (hasAttachment) {
      const meta = await withTimeout(msListAttachments(token, msgId), 18_000, "Outlook attachment list");
      attachmentNames = meta.map((item) => asString(item.name)).filter(Boolean);
      hasAttachment = attachmentNames.length > 0;
      if (hasAttachment) {
        attachmentText = await msAttachmentEvidenceText(token, msgId, meta);
      }
    }
  } else {
    const message = await withTimeout(gmailGetMessage(token, msgId), 20_000, "Gmail message fetch");
    const payload = asObject(message.payload);
    const headers = Array.isArray(payload.headers) ? payload.headers as Array<Record<string, unknown>> : [];
    subject = asString(headers.find((item) => asString(item.name) === "Subject")?.value);
    from = asString(headers.find((item) => asString(item.name) === "From")?.value);
    rawDate = asString(headers.find((item) => asString(item.name) === "Date")?.value);
    const bodyParts = extractEmailTextAll(payload, 0, []);
    if (asString(message.snippet)) bodyParts.push(asString(message.snippet));
    body = collapseTextParts(bodyParts);
    const meta = collectGmailAttachmentMeta(payload, []);
    attachmentNames = meta.map((item) => asString(item.name)).filter(Boolean);
    hasAttachment = attachmentNames.length > 0;
    if (hasAttachment) {
      attachmentText = await gmailAttachmentEvidenceText(token, msgId, meta);
    }
  }

  const parsed = rawDate ? new Date(rawDate) : null;
  return {
    subject,
    from,
    rawDate,
    body,
    hasAttachment,
    attachmentNames,
    attachmentText,
    eDate: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : todayIso(),
  };
}

function sanitizeEmailTransactions(items: Array<Record<string, unknown>>, ctx: { acts: string[]; cats: Record<string, string[]>; baseCurrency: string; eDate: string; subject: string; from: string }) {
  const activities = Array.isArray(ctx.acts) ? ctx.acts : [];
  const categories = ctx.cats && typeof ctx.cats === "object" ? ctx.cats : {};
  const fallbackActivity = activities.includes("Personal") ? "Personal" : (activities[0] || "Personal");
  const fallbackCurrency = normalizeCurrencyCode(ctx.baseCurrency, DEFAULT_BASE_CURRENCY);

  return items
    .map((item, index) => {
      const type = asString(item.type).toLowerCase();
      if (!["income", "expense", "transfer"].includes(type)) return null;
      const amount = Number(item.amount);
      if (!(amount > 0)) return null;

      const requestedActivity = asString(item.businessActivity || fallbackActivity);
      const businessActivity = activities.includes(requestedActivity) ? requestedActivity : fallbackActivity;
      const categoryList = categories[businessActivity] || [];
      const category = asString(item.category || (type === "transfer" ? "Account Transfer" : "Other"));
      const vendor = asString(item.vendor || ctx.from);
      return {
        _aiIndex: index,
        type: type as "income" | "expense" | "transfer",
        amount,
        originalAmount: roundMoney(item.originalAmount ?? amount),
        baseAmount: roundMoney(amount),
        currency: normalizeCurrencyCode(item.currency || item.currencyCode, fallbackCurrency),
        baseCurrency: fallbackCurrency,
        businessActivity,
        category,
        subCategory: asString(item.subCategory).slice(0, 120),
        description: asString(item.description || ctx.subject || `${type} from email`).slice(0, 180),
        vendor: vendor.slice(0, 140),
        trackVendor: Boolean(vendor),
        paymentMethod: asString(item.paymentMethod || (type === "transfer" ? "Account Transfer" : "")).slice(0, 80),
        date: formatIsoDate(item.date, ctx.eDate || todayIso()),
        accountName: asString(item.accountName || item.fromAccountName).slice(0, 120),
        targetAccountName: asString(item.targetAccountName || item.toAccountName).slice(0, 120),
        fxRate: 1,
        fxDate: formatIsoDate(item.date, ctx.eDate || todayIso()),
        fxRateDate: formatIsoDate(item.date, ctx.eDate || todayIso()),
        fxSource: "identity",
        isNewCategory: type === "transfer" ? false : Boolean(item.isNewCategory || (category && !categoryList.includes(category))),
      };
    })
    .filter(Boolean) as ExtractedEmailItem[];
}

async function convertItemsToBaseCurrency(items: ExtractedEmailItem[], aiConfig: AiConfig, baseCurrency: string) {
  const normalizedBase = normalizeCurrencyCode(baseCurrency, DEFAULT_BASE_CURRENCY);
  const fxRequest = items
    .filter((item) => normalizeCurrencyCode(item.currency, normalizedBase) !== normalizedBase)
    .map((item, index) => ({
      id: String(index),
      amount: item.amount,
      from: normalizeCurrencyCode(item.currency, normalizedBase),
      to: normalizedBase,
      date: formatIsoDate(item.date, todayIso()),
    }));

  let fxResultsById = new Map<string, Record<string, unknown>>();
  if (fxRequest.length) {
    const fx = await callFxConvert(aiConfig, fxRequest);
    fxResultsById = new Map(fx.results.map((row) => [asString(row.id), row]));
  }

  return items.map((item, index) => {
    const originalCurrency = normalizeCurrencyCode(item.currency, normalizedBase);
    if (originalCurrency === normalizedBase) {
      return {
        ...item,
        currency: originalCurrency,
        baseCurrency: normalizedBase,
        originalAmount: roundMoney(item.amount),
        baseAmount: roundMoney(item.amount),
        fxRate: 1,
        fxDate: formatIsoDate(item.date, todayIso()),
        fxRateDate: formatIsoDate(item.date, todayIso()),
        fxSource: "identity",
      };
    }

    const fx = fxResultsById.get(String(index));
    const rate = Number(fx?.rate || 0);
    const converted = Number(fx?.converted || 0);
    return {
      ...item,
      currency: originalCurrency,
      baseCurrency: normalizedBase,
      originalAmount: roundMoney(item.amount),
      baseAmount: roundMoney(converted || item.amount),
      fxRate: rate > 0 ? rate : 1,
      fxDate: asString(fx?.requestedDate || item.date || todayIso()),
      fxRateDate: asString(fx?.rateDate || item.date || todayIso()),
      fxSource: asString(fx?.provider || "worker_fx"),
    };
  });
}

export function buildAiEmailAnalysisMessages(subject: string, from: string, body: string, acts: string[], cats: Record<string, string[]>, meta: { attachmentNames: string[]; attachmentText: string; hasAttachment: boolean; accountNames: string[]; baseCurrency: string }) {
  const categories = Object.entries(cats).map(([activity, names]) => `${activity}: ${names.join(", ")}`).join("\n");
  const accountList = Array.isArray(meta.accountNames) ? meta.accountNames.filter(Boolean) : [];
  const accountsLine = accountList.length ? accountList.join(", ") : "Unknown";
  const attachmentNames = (meta.attachmentNames || []).slice(0, 12).join(", ");
  return [{
    role: "user" as const,
    content: `You are a cashflow extraction engine for bookkeeping.
Analyze this ENTIRE email body and ENTIRE attachment text.
You must decide cashflow directly from the content without relying on external rules.

Tasks:
1) Determine whether this email has real cash movement data.
2) Extract all transactions if present.
3) Transaction type can be expense, income, or transfer.
4) For transfer, populate accountName (from) and targetAccountName (to) when inferable.
5) If account cannot be inferred, keep accountName/targetAccountName blank and still extract.
6) Detect the original currency explicitly for every transaction and return ISO currency code such as INR, USD, EUR, GBP, AED.

Output status:
- "success" when at least one valid transaction is extracted.
- "no_transaction" when email was processed and contains no cash movement.
- "retry" when extraction failed due to unreadable/insufficient/processing issues.

Subject: "${subject}"
From: "${from}"
Has attachment: ${meta.hasAttachment ? "yes" : "no"}
Attachment names: "${attachmentNames}"
Body:
${clipTextForAI(body || "", 11_000)}
Attachment text:
${clipTextForAI(meta.attachmentText || "", 11_000)}

Activities: ${acts.join(", ")}
Categories:
${categories}
Known ledger account names (optional):
${accountsLine}
Ledger base currency: ${normalizeCurrencyCode(meta.baseCurrency, DEFAULT_BASE_CURRENCY)}

Return ONLY JSON:
{
  "status": "success|no_transaction|retry",
  "reason": "",
  "transactions": [
    {"type":"expense|income|transfer","businessActivity":"","category":"","isNewCategory":false,"description":"","amount":0,"currency":"","date":"YYYY-MM-DD","vendor":"","paymentMethod":"","accountName":"","targetAccountName":""}
  ]
}`,
  }];
}

function parseAiEmailAnalysisRaw(raw = "") {
  try {
    const parsed = JSON.parse(String(raw || "").replace(/```json|```/g, "").trim()) as Record<string, unknown>;
    const transactions = Array.isArray(parsed.transactions) ? parsed.transactions as Array<Record<string, unknown>> : [];
    const statusRaw = asString(parsed.status).toLowerCase();
    const status = statusRaw === "success" || statusRaw === "no_transaction" || statusRaw === "retry"
      ? statusRaw
      : (transactions.length ? "success" : "no_transaction");
    return {
      status: status as "success" | "no_transaction" | "retry",
      reason: asString(parsed.reason),
      transactions,
    };
  } catch {
    return {
      status: "retry" as const,
      reason: "parse_failed",
      transactions: [],
    };
  }
}

export async function resolveEmailAnalysisFromRaw(
  raw: string,
  context: {
    subject: string;
    from: string;
    eDate: string;
    acts: string[];
    cats: Record<string, string[]>;
    accountNames: string[];
    baseCurrency: string;
    aiConfig: AiConfig;
  },
): Promise<EmailAnalysisResult> {
  const parsed = parseAiEmailAnalysisRaw(raw);
  const messages: Array<{ role: "user"; content: string }> = [];
  if (parsed.status === "retry") {
    return {
      status: "retry",
      reason: parsed.reason || "ai_retry_required",
      items: [],
      messages,
    };
  }

  const sanitized = sanitizeEmailTransactions(parsed.transactions, {
    acts: context.acts,
    cats: context.cats,
    baseCurrency: context.baseCurrency,
    eDate: context.eDate || todayIso(),
    subject: context.subject || "",
    from: context.from || "",
  });

  if (parsed.status !== "success" || !sanitized.length) {
    return {
      status: "no_transaction",
      reason: parsed.reason || "",
      items: [],
      messages,
    };
  }

  const converted = await convertItemsToBaseCurrency(sanitized, context.aiConfig, context.baseCurrency);
  return {
    status: "success",
    reason: parsed.reason || "",
    items: converted,
    messages,
  };
}

export async function analyzeEmailEvidence(evidence: EmailEvidence, context: EmailExtractionContext): Promise<EmailAnalysisResult> {
  const messages = buildAiEmailAnalysisMessages(
    evidence.subject || "",
    evidence.from || "",
    evidence.body || "",
    context.acts,
    context.cats,
    {
      attachmentNames: evidence.attachmentNames || [],
      attachmentText: evidence.attachmentText || "",
      hasAttachment: Boolean(evidence.hasAttachment),
      accountNames: context.accountNames,
      baseCurrency: context.baseCurrency,
    },
  );

  const raw = await withTimeout(callAiWorker(context.aiConfig, messages, 1600), 35_000, "AI mail analysis");
  const resolved = await resolveEmailAnalysisFromRaw(raw, {
    subject: evidence.subject || "",
    from: evidence.from || "",
    eDate: evidence.eDate || todayIso(),
    acts: context.acts,
    cats: context.cats,
    accountNames: context.accountNames,
    baseCurrency: context.baseCurrency,
    aiConfig: context.aiConfig,
  });
  return {
    ...resolved,
    messages,
  };
}

export function classifySyncError(error: unknown) {
  const message = String((error as Error & { message?: string })?.message || "").toLowerCase();
  const status = Number((error as Error & { status?: number }).status || 0);
  if (message.includes("ai_retry_required")) return "ai-retry";
  if (message.includes("parse_failed")) return "parse";
  if (message.includes("not configured") || message.includes("missing openai_api_key") || message.includes("missing anthropic_api_key")) return "config";
  if (status === 401 || status === 403 || message.includes("unauthorized") || message.includes("forbidden")) return "auth";
  if (status === 429) return "rate-limit";
  if (status >= 500 && status < 600) return "server";
  if (message.includes("timed out")) return "timeout";
  if (message.includes("network") || message.includes("failed to fetch")) return "network";
  return status ? `http-${status}` : "other";
}

export function getDefaultGmailQuery() {
  return GMAIL_QUERY;
}
