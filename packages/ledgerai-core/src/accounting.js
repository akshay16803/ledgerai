function asString(value = "") {
  return String(value || "").trim();
}

export function isVendorTracked(entry = {}) {
  if (entry.trackVendor === true) return true;
  if (entry.trackVendor === false) return false;
  return Boolean(asString(entry.vendor));
}

export function normalizeTrackedVendor(entry = {}) {
  const vendor = asString(entry.vendor).slice(0, 140);
  return {
    ...entry,
    vendor,
    trackVendor: isVendorTracked({ ...entry, vendor }),
  };
}

export function getAccountingValidationMessage(entry = {}, accounts = []) {
  const tx = normalizeTrackedVendor(entry);
  const errors = [];
  const amt = Number(tx.amount);
  if (!(amt > 0)) errors.push("enter a valid amount");

  if (tx.type === "transfer") {
    if ((accounts || []).length < 2) errors.push("add at least two accounts before approving a transfer");
    if (!tx.accountId) errors.push("select the transfer from account");
    if (!tx.targetAccountId) errors.push("select the transfer to account");
    if (tx.accountId && tx.targetAccountId && tx.accountId === tx.targetAccountId) {
      errors.push("choose different transfer from and to accounts");
    }
  } else {
    if ((accounts || []).length === 0) errors.push("add at least one account before approving");
    if (!tx.accountId) errors.push(tx.type === "income" ? "select the receiving account" : "select the account used");
  }

  if (tx.type === "borrow" && !tx.liabilityAccountId && !asString(tx.borrowSource)) {
    errors.push("select a liability account or enter the borrowed source");
  }

  if (tx.type !== "transfer" && tx.type !== "borrow") {
    if (!asString(tx.businessActivity)) errors.push("select the business activity");
    if (!asString(tx.category)) errors.push("select the category");
  }

  if (tx.trackVendor && !asString(tx.vendor)) {
    errors.push("enter the vendor name or turn off vendor tracking");
  }

  if (!errors.length) return "";
  return `Update the mandatory fields before saving or approving: ${errors.join(", ")}.`;
}

export function ensureCategoryInMap(categoryMap = {}, activity = "", category = "") {
  const act = asString(activity);
  const cat = asString(category);
  if (!act || !cat) return categoryMap;
  const existing = Array.isArray(categoryMap[act]) ? categoryMap[act] : [];
  if (existing.includes(cat)) return categoryMap;
  return {
    ...categoryMap,
    [act]: [...existing, cat],
  };
}

export function isAccountTransfer(entry = {}) {
  return asString(entry.type).toLowerCase() === "transfer";
}
