function asString(value = "") {
  return String(value || "").trim();
}

export function inDateRange(date = "", from = "", to = "") {
  const value = asString(date);
  if (!value) return true;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

export function textSimilarity(a = "", b = "") {
  const left = asString(a).toLowerCase();
  const right = asString(b).toLowerCase();
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  let score = 0;
  for (const ch of left) {
    if (right.includes(ch)) score += 1;
  }
  return score / Math.max(left.length, right.length, 1);
}

export function matchesAccountForReconciliation(tx = {}, accountId = "", accountName = "") {
  const id = asString(accountId);
  const name = asString(accountName);
  if (!id && !name) return false;
  return (
    asString(tx.accountId) === id
    || asString(tx.targetAccountId) === id
    || (name && asString(tx.accountName) === name)
    || (name && asString(tx.targetAccountName) === name)
  );
}

export function reconciliationScore(statementRow = {}, ledgerTx = {}) {
  const days = Math.abs((Date.parse(statementRow.date || "") - Date.parse(ledgerTx.date || "")) / 86400000 || 0);
  const amountGap = Math.abs((Number(statementRow.amount) || 0) - (Number(ledgerTx.amount) || 0));
  const desc = textSimilarity(statementRow.description || "", ledgerTx.description || ledgerTx.category || "");
  return Math.max(0, (1 / (1 + days)) * 30 + Math.max(0, 25 - amountGap * 4) + desc * 45);
}

function txDirection(tx = {}) {
  const side = asString(tx._reconSide);
  if (side === "credit" || side === "debit") return side;
  if (tx.type === "income") return "credit";
  if (tx.type === "expense" || tx.type === "borrow") return "debit";
  return "";
}

export function buildReconciliationResult(statementRows = [], ledgerRows = []) {
  const unmatchedLedger = new Set((ledgerRows || []).map((tx) => tx.id));
  const matched = [];
  const amountMismatches = [];
  const statementOnly = [];
  const ledgerOnly = [];

  (statementRows || []).forEach((row, idx) => {
    const candidates = (ledgerRows || [])
      .filter((tx) => unmatchedLedger.has(tx.id))
      .map((tx) => ({
        tx,
        days: Math.abs((Date.parse(row.date || "") - Date.parse(tx.date || "")) / 86400000 || 0),
        amountGap: Math.abs((Number(row.amount) || 0) - (Number(tx.amount) || 0)),
        desc: textSimilarity(row.description || "", tx.description || tx.category || ""),
        score: reconciliationScore(row, tx),
      }))
      .filter((candidate) => candidate.days <= 5 || candidate.desc >= 0.3)
      .sort((a, b) => b.score - a.score);

    const best = candidates[0] || null;
    const sameDirection = best ? asString(row.type) === txDirection(best.tx) : false;

    if (best && sameDirection && best.amountGap < 2 && best.days <= 3) {
      unmatchedLedger.delete(best.tx.id);
      matched.push({ id: `match-${idx}`, statementRow: row, ledgerTx: best.tx, score: best.score });
      return;
    }

    if (best && sameDirection && best.days <= 5 && best.desc >= 0.25) {
      unmatchedLedger.delete(best.tx.id);
      amountMismatches.push({
        id: `mismatch-${idx}`,
        statementRow: row,
        ledgerTx: best.tx,
        score: best.score,
        amountGap: best.amountGap,
        dayGap: best.days,
      });
      return;
    }

    statementOnly.push({ id: `stmt-${idx}`, statementRow: row });
  });

  (ledgerRows || []).forEach((tx) => {
    if (unmatchedLedger.has(tx.id)) {
      ledgerOnly.push({ id: `ledger-${tx.id}`, ledgerTx: tx });
    }
  });

  return { matched, amountMismatches, statementOnly, ledgerOnly };
}
