import type { DocumentPickerAsset } from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { decode as decodeBase64 } from "base-64";
import type { AiConfig } from "@lib/email/emailProcessing";
import {
  convertStatementRowsToBaseCurrency,
  extractAttachmentTextByType,
  formatIsoDate,
  normalizeCurrencyCode,
  parseStatementWithAi,
  roundMoney,
  todayIso,
} from "@lib/email/emailProcessing";

export type StatementRow = Record<string, unknown> & {
  _sid: string;
  amount: number;
  originalAmount: number;
  baseAmount: number;
  currency: string;
  baseCurrency: string;
  type: "debit" | "credit";
  date: string;
  description: string;
  reference: string;
  fxRate: number;
  fxDate: string;
  fxRateDate: string;
  fxSource: string;
};

export type ReconciliationLedgerRow = Record<string, unknown> & {
  id: string;
  date: string;
  amount: number;
  type: string;
  description?: string;
  category?: string;
  accountId?: string;
  accountName?: string;
  targetAccountId?: string;
  targetAccountName?: string;
  _reconSide: "debit" | "credit";
};

export type ReconciliationMatch = {
  id: string;
  statementRow: StatementRow;
  ledgerTx: ReconciliationLedgerRow;
  score: number;
};

export type ReconciliationMismatch = {
  id: string;
  statementRow: StatementRow;
  ledgerTx: ReconciliationLedgerRow;
  score: number;
  amountGap: number;
  dayGap: number;
};

export type ReconciliationStatementOnly = {
  id: string;
  statementRow: StatementRow;
};

export type ReconciliationLedgerOnly = {
  id: string;
  ledgerTx: ReconciliationLedgerRow;
};

export type ReconciliationComputation = {
  matched: ReconciliationMatch[];
  amountMismatches: ReconciliationMismatch[];
  statementOnly: ReconciliationStatementOnly[];
  ledgerOnly: ReconciliationLedgerOnly[];
};

function asString(value: unknown, fallback = "") {
  return String(value || fallback).trim();
}

function looksLikeTextFile(mimeType = "", name = "") {
  const type = mimeType.toLowerCase();
  const fileName = name.toLowerCase();
  return type.startsWith("text/")
    || type.includes("json")
    || type.includes("xml")
    || type.includes("csv")
    || type.includes("html")
    || /\.(txt|csv|json|xml|html?|md|log)$/i.test(fileName);
}

export async function readStatementDocumentText(asset: DocumentPickerAsset) {
  const uri = asString(asset.uri);
  const name = asString(asset.name || "statement");
  const mimeType = asString(asset.mimeType);
  if (!uri) throw new Error("Selected statement file is missing a readable URI.");

  if (looksLikeTextFile(mimeType, name)) {
    const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
    if (!asString(text)) throw new Error("This statement file is empty.");
    return {
      label: name,
      text,
      mimeType,
    };
  }

  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const binary = decodeBase64(base64);
  const text = extractAttachmentTextByType(binary, mimeType, name);
  if (!asString(text)) {
    throw new Error("Unable to extract readable text from this statement. Use CSV, text, or a text-based PDF.");
  }
  return {
    label: name,
    text,
    mimeType,
  };
}

export async function parseAndPrepareStatementRows(input: {
  sourceText: string;
  accountName: string;
  accountType: string;
  accountCurrency: string;
  baseCurrency: string;
  aiConfig: AiConfig;
  dateFallback: string;
}) {
  const parsed = await parseStatementWithAi(input.sourceText, {
    accountName: input.accountName,
    accountType: input.accountType,
    accountCurrency: input.accountCurrency,
    baseCurrency: input.baseCurrency,
    aiConfig: input.aiConfig,
  });
  const sanitized = sanitizeStatementRows(parsed, {
    accountCurrency: input.accountCurrency,
    baseCurrency: input.baseCurrency,
    dateFallback: input.dateFallback,
  });
  return prepareStatementRows(sanitized, {
    aiConfig: input.aiConfig,
    accountCurrency: input.accountCurrency,
    baseCurrency: input.baseCurrency,
    dateFallback: input.dateFallback,
  });
}

export function sanitizeStatementRows(rows: Array<Record<string, unknown>>, ctx: {
  accountCurrency: string;
  baseCurrency: string;
  dateFallback: string;
}) {
  const fallbackCurrency = normalizeCurrencyCode(ctx.accountCurrency || ctx.baseCurrency, ctx.baseCurrency);
  return rows
    .map((row, index) => {
      const amount = Number(row.amount);
      if (!(amount > 0)) return null;
      const rawType = asString(row.type).toLowerCase();
      const type = rawType === "credit" ? "credit" : "debit";
      const date = formatIsoDate(row.date, ctx.dateFallback || todayIso());
      const description = asString(row.description || row.reference || `Statement ${type}`) || `Statement ${type}`;
      return {
        ...row,
        _sid: asString(row._sid || `stmt-${index}`),
        amount,
        originalAmount: roundMoney(row.originalAmount ?? amount),
        baseAmount: roundMoney(row.originalAmount ?? amount),
        currency: normalizeCurrencyCode(row.currency || row.balanceCurrency, fallbackCurrency),
        baseCurrency: normalizeCurrencyCode(ctx.baseCurrency, fallbackCurrency),
        balance: Number.isFinite(Number(row.balance)) ? Number(row.balance) : null,
        balanceCurrency: normalizeCurrencyCode(row.balanceCurrency || row.currency, fallbackCurrency),
        type,
        date,
        description: description.slice(0, 220),
        reference: asString(row.reference).slice(0, 120),
        fxRate: 1,
        fxDate: date,
        fxRateDate: date,
        fxSource: "identity",
      };
    })
    .filter(Boolean) as StatementRow[];
}

export async function prepareStatementRows(rows: StatementRow[], ctx: {
  aiConfig: AiConfig;
  accountCurrency: string;
  baseCurrency: string;
  dateFallback: string;
}) {
  return await convertStatementRowsToBaseCurrency(rows as Array<Record<string, unknown>>, {
    aiConfig: ctx.aiConfig,
    baseCurrency: ctx.baseCurrency,
    fallbackCurrency: ctx.accountCurrency || ctx.baseCurrency,
    dateResolver: (row) => asString(row.date) || ctx.dateFallback || todayIso(),
  }) as StatementRow[];
}

export function inDateRange(date = "", from = "", to = "") {
  const value = asString(date);
  if (!value) return true;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

export function matchesAccountForReconciliation(tx: Record<string, unknown>, accountId = "", accountName = "") {
  const id = asString(accountId);
  const name = asString(accountName);
  if (!id && !name) return false;
  return asString(tx.accountId) === id
    || asString(tx.targetAccountId) === id
    || (Boolean(name) && asString(tx.accountName) === name)
    || (Boolean(name) && asString(tx.targetAccountName) === name);
}

export function buildLedgerRowsForReconciliation(
  transactions: Array<Record<string, unknown>>,
  accountId: string,
  accountName: string,
  fromDate: string,
  toDate: string,
) {
  return transactions
    .filter((tx) => matchesAccountForReconciliation(tx, accountId, accountName))
    .filter((tx) => inDateRange(asString(tx.date), fromDate, toDate))
    .map((tx) => {
      const isOutgoing = asString(tx.accountId) === accountId || asString(tx.accountName) === accountName;
      const isIncoming = asString(tx.targetAccountId) === accountId || asString(tx.targetAccountName) === accountName;
      const reconSide = tx.type === "transfer"
        ? (isIncoming && !isOutgoing ? "credit" : "debit")
        : tx.type === "income" || tx.type === "borrow"
          ? "credit"
          : "debit";
      return {
        ...tx,
        _reconSide: reconSide,
      };
    }) as ReconciliationLedgerRow[];
}

function textSimilarity(a = "", b = "") {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  let matches = 0;
  for (const char of left) {
    if (right.includes(char)) matches += 1;
  }
  return matches / Math.max(left.length, right.length, 1);
}

function reconciliationScore(statementRow: StatementRow, ledgerTx: ReconciliationLedgerRow) {
  const days = Math.abs((Date.parse(statementRow.date || "") - Date.parse(ledgerTx.date || "")) / 86400000 || 0);
  const amountGap = Math.abs((Number(statementRow.amount) || 0) - (Number(ledgerTx.amount) || 0));
  const desc = textSimilarity(statementRow.description || "", asString(ledgerTx.description || ledgerTx.category));
  return Math.max(0, (1 / (1 + days)) * 30 + Math.max(0, 25 - amountGap * 4) + desc * 45);
}

export function buildReconciliationResult(statementRows: StatementRow[], ledgerRows: ReconciliationLedgerRow[]): ReconciliationComputation {
  const unmatchedLedger = new Set((ledgerRows || []).map((tx) => tx.id));
  const matched: ReconciliationMatch[] = [];
  const amountMismatches: ReconciliationMismatch[] = [];
  const statementOnly: ReconciliationStatementOnly[] = [];
  const ledgerOnly: ReconciliationLedgerOnly[] = [];

  (statementRows || []).forEach((row, index) => {
    const candidates = (ledgerRows || [])
      .filter((tx) => unmatchedLedger.has(tx.id))
      .map((tx) => ({
        tx,
        days: Math.abs((Date.parse(row.date || "") - Date.parse(tx.date || "")) / 86400000 || 0),
        amountGap: Math.abs((Number(row.amount) || 0) - (Number(tx.amount) || 0)),
        desc: textSimilarity(row.description || "", asString(tx.description || tx.category)),
        score: reconciliationScore(row, tx),
      }))
      .filter((candidate) => candidate.days <= 5 || candidate.desc >= 0.3)
      .sort((left, right) => right.score - left.score);

    const best = candidates[0] || null;
    const txDirection = best?.tx?._reconSide || (best?.tx?.type === "income" ? "credit" : "debit");
    const sameDirection = row.type === txDirection;
    if (best && sameDirection && best.amountGap < 2 && best.days <= 3) {
      unmatchedLedger.delete(best.tx.id);
      matched.push({ id: `match-${index}`, statementRow: row, ledgerTx: best.tx, score: best.score });
      return;
    }
    if (best && sameDirection && best.days <= 5 && best.desc >= 0.25) {
      unmatchedLedger.delete(best.tx.id);
      amountMismatches.push({
        id: `mismatch-${index}`,
        statementRow: row,
        ledgerTx: best.tx,
        score: best.score,
        amountGap: best.amountGap,
        dayGap: best.days,
      });
      return;
    }
    statementOnly.push({ id: `stmt-${index}`, statementRow: row });
  });

  (ledgerRows || []).forEach((tx) => {
    if (unmatchedLedger.has(tx.id)) {
      ledgerOnly.push({ id: `ledger-${tx.id}`, ledgerTx: tx });
    }
  });

  return {
    matched,
    amountMismatches,
    statementOnly,
    ledgerOnly,
  };
}
