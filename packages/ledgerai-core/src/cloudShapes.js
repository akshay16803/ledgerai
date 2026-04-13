import {
  DEFAULT_ACTIVITIES,
  DEFAULT_CATEGORIES,
  DEFAULT_BASE_CURRENCY,
} from "./constants.js";
import {
  applyMoneyNormalization,
  normalizeBaseCurrencyConfig,
  normalizeCurrencyCode,
  normalizeFxDate,
  roundMoney,
  todayIsoDate,
} from "./money.js";

function asString(value = "") {
  return String(value || "").trim();
}

function asBool(value) {
  return value === true;
}

function asJson(value, fallback = {}) {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function nowIso() {
  return new Date().toISOString();
}

export function normalizeTransactionEntity(tx = {}) {
  return applyMoneyNormalization(
    {
      id: asString(tx.id),
      date: asString(tx.date || todayIsoDate()),
      type: asString(tx.type || "expense"),
      description: asString(tx.description),
      businessActivity: asString(tx.businessActivity || tx.business_activity),
      category: asString(tx.category),
      subCategory: asString(tx.subCategory || tx.sub_category),
      vendor: asString(tx.vendor),
      trackVendor: tx.trackVendor === true || tx.track_vendor === true,
      paymentMethod: asString(tx.paymentMethod || tx.payment_method),
      accountId: asString(tx.accountId || tx.account_id),
      accountName: asString(tx.accountName || tx.account_name),
      targetAccountId: asString(tx.targetAccountId || tx.target_account_id),
      targetAccountName: asString(tx.targetAccountName || tx.target_account_name),
      liabilityAccountId: asString(tx.liabilityAccountId || tx.liability_account_id),
      liabilityAccountName: asString(tx.liabilityAccountName || tx.liability_account_name),
      borrowSource: asString(tx.borrowSource || tx.borrow_source),
      notes: asString(tx.notes),
      amount: roundMoney(Number(tx.amount) || 0),
      originalAmount: roundMoney(Number(tx.originalAmount ?? tx.original_amount ?? tx.amount) || 0),
      currency: normalizeCurrencyCode(tx.currency || tx.baseCurrency || DEFAULT_BASE_CURRENCY, DEFAULT_BASE_CURRENCY),
      fxRate: Number(tx.fxRate ?? tx.fx_rate) || 1,
      fxDate: normalizeFxDate(tx.fxDate || tx.fx_date || tx.date || todayIsoDate()),
      fxRateDate: normalizeFxDate(tx.fxRateDate || tx.fx_rate_date || tx.fxDate || tx.date || todayIsoDate()),
      fxSource: asString(tx.fxSource || tx.fx_source || "manual"),
      source: asString(tx.source || "manual"),
      createdAt: asString(tx.createdAt || tx.created_at),
      updatedAt: asString(tx.updatedAt || tx.updated_at),
    },
    {
      baseCurrency: normalizeCurrencyCode(tx.baseCurrency || tx.base_currency || DEFAULT_BASE_CURRENCY, DEFAULT_BASE_CURRENCY),
      fallbackCurrency: normalizeCurrencyCode(tx.currency || DEFAULT_BASE_CURRENCY, DEFAULT_BASE_CURRENCY),
    },
  );
}

export function toCloudTransaction(tx = {}, userId = "") {
  const normalized = normalizeTransactionEntity(tx);
  return {
    id: asString(normalized.id) || undefined,
    user_id: asString(userId),
    date: normalized.date,
    type: normalized.type,
    description: normalized.description,
    business_activity: normalized.businessActivity,
    category: normalized.category,
    sub_category: normalized.subCategory || "",
    vendor: normalized.vendor || "",
    track_vendor: asBool(normalized.trackVendor),
    payment_method: normalized.paymentMethod || "",
    account_id: normalized.accountId || "",
    account_name: normalized.accountName || "",
    target_account_id: normalized.targetAccountId || "",
    target_account_name: normalized.targetAccountName || "",
    liability_account_id: normalized.liabilityAccountId || "",
    liability_account_name: normalized.liabilityAccountName || "",
    borrow_source: normalized.borrowSource || "",
    notes: normalized.notes || "",
    amount: normalized.amount,
    original_amount: normalized.originalAmount,
    base_amount: normalized.baseAmount,
    currency: normalized.currency,
    base_currency: normalized.baseCurrency,
    fx_rate: normalized.fxRate,
    fx_date: normalized.fxDate,
    fx_rate_date: normalized.fxRateDate,
    fx_source: normalized.fxSource,
    source: normalized.source || "manual",
    created_at: normalized.createdAt || nowIso(),
    updated_at: nowIso(),
  };
}

export function fromCloudTransaction(row = {}) {
  return normalizeTransactionEntity(row);
}

export function normalizeInboxEntity(item = {}) {
  const normalized = normalizeTransactionEntity(item);
  return {
    ...normalized,
    iid: asString(item.iid || item._iid || item.id),
    ts: Number(item.ts ?? item._ts ?? Date.now()) || Date.now(),
    reviewStatus: asString(item.reviewStatus || item.review_status || "pending"),
    emailAccountId: asString(item.emailAccountId || item.email_account_id),
    emailMsgId: asString(item.emailMsgId || item.email_msg_id),
  };
}

export function toCloudInboxItem(item = {}, userId = "") {
  const normalized = normalizeInboxEntity(item);
  return {
    id: normalized.iid || undefined,
    user_id: asString(userId),
    payload: normalized,
    review_status: normalized.reviewStatus,
    account_id: normalized.accountId || "",
    date: normalized.date || todayIsoDate(),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

export function fromCloudInboxItem(row = {}) {
  const payload = asJson(row.payload, row);
  return normalizeInboxEntity({
    ...payload,
    iid: row.id || payload.iid || payload._iid,
    reviewStatus: row.review_status || payload.reviewStatus,
  });
}

export function normalizeBookkeepingAccountEntity(account = {}) {
  const accountCurrency = normalizeCurrencyCode(account.accountCurrency || account.account_currency || DEFAULT_BASE_CURRENCY, DEFAULT_BASE_CURRENCY);
  return {
    id: asString(account.id),
    name: asString(account.name),
    cls: asString(account.cls || "asset"),
    type: asString(account.type),
    typeName: asString(account.typeName || account.type_name),
    bank: asString(account.bank),
    number: asString(account.number),
    accountCurrency,
    balance: roundMoney(Number(account.balance) || 0),
    originalBalance: roundMoney(Number(account.originalBalance ?? account.original_balance ?? account.balance) || 0),
    balanceBaseCurrency: normalizeCurrencyCode(account.balanceBaseCurrency || account.balance_base_currency || DEFAULT_BASE_CURRENCY, DEFAULT_BASE_CURRENCY),
    balanceFxRate: Number(account.balanceFxRate ?? account.balance_fx_rate) || 1,
    balanceFxDate: normalizeFxDate(account.balanceFxDate || account.balance_fx_date || todayIsoDate()),
    balanceRateDate: normalizeFxDate(account.balanceRateDate || account.balance_rate_date || todayIsoDate()),
    balanceFxSource: asString(account.balanceFxSource || account.balance_fx_source || "manual"),
    createdAt: asString(account.createdAt || account.created_at),
    updatedAt: asString(account.updatedAt || account.updated_at),
  };
}

export function toCloudBookkeepingAccount(account = {}, userId = "") {
  const normalized = normalizeBookkeepingAccountEntity(account);
  return {
    id: normalized.id || undefined,
    user_id: asString(userId),
    name: normalized.name,
    cls: normalized.cls,
    type: normalized.type,
    type_name: normalized.typeName,
    bank: normalized.bank,
    number: normalized.number,
    account_currency: normalized.accountCurrency,
    balance: normalized.balance,
    original_balance: normalized.originalBalance,
    balance_base_currency: normalized.balanceBaseCurrency,
    balance_fx_rate: normalized.balanceFxRate,
    balance_fx_date: normalized.balanceFxDate,
    balance_rate_date: normalized.balanceRateDate,
    balance_fx_source: normalized.balanceFxSource,
    created_at: normalized.createdAt || nowIso(),
    updated_at: nowIso(),
  };
}

export function fromCloudBookkeepingAccount(row = {}) {
  return normalizeBookkeepingAccountEntity(row);
}

export function normalizeEmailAccountEntity(account = {}) {
  return {
    id: asString(account.id),
    provider: asString(account.provider || "google").toLowerCase() === "microsoft" ? "microsoft" : "google",
    email: asString(account.email),
    label: asString(account.label),
    connected: asBool(account.connected),
    enabled: account.enabled !== false,
    userDisconnected: asBool(account.userDisconnected || account.user_disconnected),
    reauthRequired: asBool(account.reauthRequired || account.reauth_required),
    syncQuery: asString(account.syncQuery || account.sync_query),
    syncFromDate: asString(account.syncFromDate || account.sync_from_date),
    maxEmails: Number(account.maxEmails || account.max_emails || 100) || 100,
    firstSyncCompleted: asBool(account.firstSyncCompleted || account.first_sync_completed),
    autoSyncHourly: account.autoSyncHourly !== false && account.auto_sync_hourly !== false,
    lastSync: asString(account.lastSync || account.last_sync),
    lastAuthAt: asString(account.lastAuthAt || account.last_auth_at),
    lastError: asString(account.lastError || account.last_error),
    lastErrorAt: asString(account.lastErrorAt || account.last_error_at),
    msClientId: asString(account.msClientId || account.ms_client_id),
    msAccountId: asString(account.msAccountId || account.ms_account_id),
    msUsername: asString(account.msUsername || account.ms_username),
  };
}

export function toCloudEmailAccount(account = {}, userId = "") {
  const normalized = normalizeEmailAccountEntity(account);
  return {
    id: normalized.id || undefined,
    user_id: asString(userId),
    provider: normalized.provider,
    email: normalized.email,
    label: normalized.label,
    connected: normalized.connected,
    enabled: normalized.enabled,
    user_disconnected: normalized.userDisconnected,
    reauth_required: normalized.reauthRequired,
    sync_query: normalized.syncQuery,
    sync_from_date: normalized.syncFromDate,
    max_emails: normalized.maxEmails,
    first_sync_completed: normalized.firstSyncCompleted,
    auto_sync_hourly: normalized.autoSyncHourly,
    last_sync: normalized.lastSync,
    last_auth_at: normalized.lastAuthAt,
    last_error: normalized.lastError,
    last_error_at: normalized.lastErrorAt,
    ms_client_id: normalized.msClientId,
    ms_account_id: normalized.msAccountId,
    ms_username: normalized.msUsername,
    updated_at: nowIso(),
  };
}

export function fromCloudEmailAccount(row = {}) {
  return normalizeEmailAccountEntity(row);
}

export function normalizeActivityCatalog(catalog = {}) {
  const activities = Array.isArray(catalog.activities) && catalog.activities.length
    ? catalog.activities.map((item) => asString(item)).filter(Boolean)
    : [...DEFAULT_ACTIVITIES];

  const categories = asJson(catalog.categories, DEFAULT_CATEGORIES);
  return { activities, categories };
}

export function toCloudActivityCategoryState(state = {}, userId = "") {
  const normalized = normalizeActivityCatalog(state);
  return {
    user_id: asString(userId),
    activities: normalized.activities,
    categories: normalized.categories,
    updated_at: nowIso(),
  };
}

export function fromCloudActivityCategoryState(row = {}) {
  return normalizeActivityCatalog(row);
}

export function normalizeRecurringEntity(item = {}) {
  return applyMoneyNormalization(
    {
      id: asString(item.id),
      type: asString(item.type || "expense"),
      description: asString(item.description),
      amount: roundMoney(Number(item.amount) || 0),
      originalAmount: roundMoney(Number(item.originalAmount ?? item.original_amount ?? item.amount) || 0),
      currency: normalizeCurrencyCode(item.currency || DEFAULT_BASE_CURRENCY, DEFAULT_BASE_CURRENCY),
      businessActivity: asString(item.businessActivity || item.business_activity),
      category: asString(item.category),
      subCategory: asString(item.subCategory || item.sub_category),
      paymentMethod: asString(item.paymentMethod || item.payment_method),
      accountId: asString(item.accountId || item.account_id),
      cadence: asString(item.cadence || "monthly"),
      dayOfWeek: Number(item.dayOfWeek ?? item.day_of_week ?? -1),
      dayOfMonth: Number(item.dayOfMonth ?? item.day_of_month ?? -1),
      startDate: asString(item.startDate || item.start_date),
      endDate: asString(item.endDate || item.end_date),
      nextRunDate: asString(item.nextRunDate || item.next_run_date),
      lastRunDate: asString(item.lastRunDate || item.last_run_date),
      enabled: item.enabled !== false,
      notes: asString(item.notes),
    },
    { baseCurrency: DEFAULT_BASE_CURRENCY, fallbackCurrency: DEFAULT_BASE_CURRENCY },
  );
}

export function toCloudRecurringItem(item = {}, userId = "") {
  const normalized = normalizeRecurringEntity(item);
  return {
    id: normalized.id || undefined,
    user_id: asString(userId),
    type: normalized.type,
    description: normalized.description,
    amount: normalized.amount,
    original_amount: normalized.originalAmount,
    base_amount: normalized.baseAmount,
    currency: normalized.currency,
    base_currency: normalized.baseCurrency,
    fx_rate: normalized.fxRate,
    fx_date: normalized.fxDate,
    fx_rate_date: normalized.fxRateDate,
    fx_source: normalized.fxSource,
    business_activity: normalized.businessActivity,
    category: normalized.category,
    sub_category: normalized.subCategory,
    payment_method: normalized.paymentMethod,
    account_id: normalized.accountId,
    cadence: normalized.cadence,
    day_of_week: normalized.dayOfWeek,
    day_of_month: normalized.dayOfMonth,
    start_date: normalized.startDate,
    end_date: normalized.endDate,
    next_run_date: normalized.nextRunDate,
    last_run_date: normalized.lastRunDate,
    enabled: normalized.enabled,
    notes: normalized.notes,
    updated_at: nowIso(),
  };
}

export function fromCloudRecurringItem(row = {}) {
  return normalizeRecurringEntity(row);
}

export function normalizeAppSettingsEntity(settings = {}) {
  const currencyCfg = normalizeBaseCurrencyConfig(settings.currencyCfg || settings.currency_cfg || settings);
  const aiCfg = settings.aiCfg || settings.ai_cfg || settings.ai || {};
  return {
    baseCurrency: currencyCfg.baseCurrency,
    aiEndpoint: asString(aiCfg.endpoint || aiCfg.aiEndpoint || settings.aiEndpoint),
    aiModel: asString(aiCfg.model || aiCfg.aiModel || settings.aiModel),
    aiSharedKeyConfigured: asBool(aiCfg.sharedKeyConfigured || aiCfg.shared_key_configured || settings.aiSharedKeyConfigured),
    cloud: asJson(settings.cloud || settings.cloud_cfg, {}),
    misc: asJson(settings.misc, {}),
    updatedAt: asString(settings.updatedAt || settings.updated_at),
  };
}

export function toCloudAppSettings(settings = {}, userId = "") {
  const normalized = normalizeAppSettingsEntity(settings);
  return {
    user_id: asString(userId),
    base_currency: normalized.baseCurrency,
    ai_endpoint: normalized.aiEndpoint,
    ai_model: normalized.aiModel,
    ai_shared_key_configured: normalized.aiSharedKeyConfigured,
    cloud_cfg: normalized.cloud,
    misc: normalized.misc,
    updated_at: nowIso(),
  };
}

export function fromCloudAppSettings(row = {}) {
  return normalizeAppSettingsEntity(row);
}

export function normalizeAiPendingEntity(item = {}) {
  return {
    id: asString(item.id),
    accountId: asString(item.accountId || item.account_id),
    provider: asString(item.provider || "google").toLowerCase() === "microsoft" ? "microsoft" : "google",
    msgId: asString(item.msgId || item.msg_id),
    subject: asString(item.subject),
    from: asString(item.from),
    emailDate: asString(item.emailDate || item.email_date),
    snippet: asString(item.snippet),
    queuedAt: asString(item.queuedAt || item.queued_at || nowIso()),
    lastTriedAt: asString(item.lastTriedAt || item.last_tried_at),
    attempts: Math.max(0, Number(item.attempts) || 0),
    nextRetryAt: asString(item.nextRetryAt || item.next_retry_at),
    lastError: asString(item.lastError || item.last_error),
    cloudQueued: asBool(item.cloudQueued || item.cloud_queued),
    cloudJobId: asString(item.cloudJobId || item.cloud_job_id),
  };
}

export function toCloudAiPendingItem(item = {}, userId = "") {
  const normalized = normalizeAiPendingEntity(item);
  return {
    id: normalized.id || undefined,
    user_id: asString(userId),
    account_id: normalized.accountId,
    provider: normalized.provider,
    msg_id: normalized.msgId,
    subject: normalized.subject,
    from_text: normalized.from,
    email_date: normalized.emailDate,
    snippet: normalized.snippet,
    queued_at: normalized.queuedAt,
    last_tried_at: normalized.lastTriedAt,
    attempts: normalized.attempts,
    next_retry_at: normalized.nextRetryAt,
    last_error: normalized.lastError,
    cloud_queued: normalized.cloudQueued,
    cloud_job_id: normalized.cloudJobId,
    updated_at: nowIso(),
  };
}

export function fromCloudAiPendingItem(row = {}) {
  return normalizeAiPendingEntity(row);
}

export function normalizeReconciliationArtifact(item = {}) {
  return {
    id: asString(item.id),
    accountId: asString(item.accountId || item.account_id),
    accountName: asString(item.accountName || item.account_name),
    fromDate: asString(item.fromDate || item.from_date),
    toDate: asString(item.toDate || item.to_date),
    sourceLabel: asString(item.sourceLabel || item.source_label),
    status: asString(item.status || "completed"),
    result: asJson(item.result, {}),
    createdAt: asString(item.createdAt || item.created_at || nowIso()),
    updatedAt: asString(item.updatedAt || item.updated_at || nowIso()),
  };
}

export function toCloudReconciliationArtifact(item = {}, userId = "") {
  const normalized = normalizeReconciliationArtifact(item);
  return {
    id: normalized.id || undefined,
    user_id: asString(userId),
    account_id: normalized.accountId,
    account_name: normalized.accountName,
    from_date: normalized.fromDate,
    to_date: normalized.toDate,
    source_label: normalized.sourceLabel,
    status: normalized.status,
    result: normalized.result,
    created_at: normalized.createdAt,
    updated_at: nowIso(),
  };
}

export function fromCloudReconciliationArtifact(row = {}) {
  return normalizeReconciliationArtifact(row);
}
