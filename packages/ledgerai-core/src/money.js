import {
  CURRENCY_ALIASES,
  DEFAULT_BASE_CURRENCY,
  ISO_DATE_RE,
} from "./constants.js";

function asString(value = "") {
  return String(value || "").trim();
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeCurrencyCode(value = "", fallback = DEFAULT_BASE_CURRENCY) {
  const raw = asString(value).toUpperCase();
  if (!raw) return fallback;
  if (CURRENCY_ALIASES[raw]) return CURRENCY_ALIASES[raw];
  const letters = raw.replace(/[^A-Z]/g, "");
  if (CURRENCY_ALIASES[letters]) return CURRENCY_ALIASES[letters];
  if (/^[A-Z]{3}$/.test(letters)) return letters;
  return fallback;
}

export function normalizeFxDate(value = "") {
  const raw = asString(value);
  if (ISO_DATE_RE.test(raw)) return raw;
  const ts = Date.parse(raw);
  if (Number.isFinite(ts)) return new Date(ts).toISOString().slice(0, 10);
  return todayIsoDate();
}

export function normalizeBaseCurrencyConfig(cfg = {}) {
  return {
    baseCurrency: normalizeCurrencyCode(cfg.baseCurrency || DEFAULT_BASE_CURRENCY, DEFAULT_BASE_CURRENCY),
  };
}

export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function formatMoney(value, currency = DEFAULT_BASE_CURRENCY, locale = "en-IN") {
  const amount = Number(value) || 0;
  const code = normalizeCurrencyCode(currency, DEFAULT_BASE_CURRENCY);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(Number.isInteger(amount) ? 0 : 2)}`;
  }
}

export function fxCacheKey(from = "", to = "", date = "") {
  return `${normalizeCurrencyCode(from, "")}::${normalizeCurrencyCode(to, "")}::${normalizeFxDate(date)}`;
}

export function identityFxResult(item = {}, baseCurrency = DEFAULT_BASE_CURRENCY) {
  const from = normalizeCurrencyCode(item.from || item.currency || baseCurrency, baseCurrency);
  const to = normalizeCurrencyCode(item.to || item.baseCurrency || baseCurrency, baseCurrency);
  const requestedDate = normalizeFxDate(item.date || item.fxDate || todayIsoDate());
  return {
    id: asString(item.id),
    amount: roundMoney(Number(item.amount) || 0),
    from,
    to,
    requestedDate,
    rateDate: requestedDate,
    rate: 1,
    converted: roundMoney(Number(item.amount) || 0),
    provider: "identity",
  };
}

export function applyMoneyNormalization(entry = {}, { baseCurrency = DEFAULT_BASE_CURRENCY, fallbackCurrency = DEFAULT_BASE_CURRENCY } = {}) {
  const amount = roundMoney(Number(entry.amount ?? 0) || 0);
  const sourceCurrency = normalizeCurrencyCode(entry.currency || entry.baseCurrency || fallbackCurrency, fallbackCurrency);
  return {
    ...entry,
    amount,
    baseAmount: roundMoney(Number(entry.baseAmount ?? amount) || amount),
    originalAmount: roundMoney(Number(entry.originalAmount ?? amount) || amount),
    currency: sourceCurrency,
    baseCurrency: normalizeCurrencyCode(entry.baseCurrency || baseCurrency, baseCurrency),
    fxRate: Number(entry.fxRate) || 1,
    fxDate: normalizeFxDate(entry.fxDate || entry.date || todayIsoDate()),
    fxRateDate: normalizeFxDate(entry.fxRateDate || entry.fxDate || entry.date || todayIsoDate()),
    fxSource: asString(entry.fxSource || "manual"),
  };
}

export function currencyMetaLabel(entry = {}, baseCurrency = DEFAULT_BASE_CURRENCY, locale = "en-IN") {
  const source = normalizeCurrencyCode(entry.currency || entry.accountCurrency || "", baseCurrency);
  const original = Number(entry.originalAmount ?? entry.originalBalance);
  const baseAmount = Number(entry.baseAmount ?? entry.balance ?? entry.amount);
  const rate = Number(entry.fxRate ?? entry.balanceFxRate);
  const rateDate = entry.fxRateDate || entry.balanceRateDate || entry.fxDate || entry.balanceFxDate || "";
  if (!Number.isFinite(original) || source === baseCurrency) return "";
  const parts = [`${formatMoney(original, source, locale)} original`];
  if (Number.isFinite(baseAmount)) parts.push(`-> ${formatMoney(baseAmount, baseCurrency, locale)}`);
  if (Number.isFinite(rate) && rate > 0) parts.push(`@ ${rate.toFixed(4)}`);
  if (rateDate) parts.push(rateDate);
  return parts.join(" ");
}
