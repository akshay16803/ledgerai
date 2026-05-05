// Meta Pixel helper. Wraps window.fbq() so a missing/blocked Pixel
// (ad blocker, privacy mode, fbq not yet loaded) silently no-ops.
// Every call is try/catch'd — tracking failures must NEVER break the UI.
//
// Initial PageView fires from the base snippet in index.html. Use
// trackPageView() for SPA route changes (Pixel doesn't auto-track those).
//
// trackPurchase emits a deterministic eventID derived from order_id so the
// backend CAPI can dedupe (Step 6).

const DEFAULT_CURRENCY = 'INR';

function isPixelReady() {
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
}

function devLog(eventName, payload, eventID) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[Pixel]', eventName, payload || {}, eventID ? `eventID=${eventID}` : '');
  }
}

export function generateEventId(prefix, key) {
  const k = key != null ? String(key) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${k}_${Date.now()}`;
}

export function trackPageView() {
  try {
    if (!isPixelReady()) return;
    window.fbq('track', 'PageView');
    devLog('PageView');
  } catch {
    // Swallow — never break UI on tracking failure.
  }
}

export function trackViewContent({ content_name, content_category, value, currency } = {}) {
  try {
    if (!isPixelReady()) return;
    const payload = {
      ...(content_name !== undefined && { content_name }),
      ...(content_category !== undefined && { content_category }),
      ...(value !== undefined && { value }),
      currency: currency || DEFAULT_CURRENCY,
    };
    window.fbq('track', 'ViewContent', payload);
    devLog('ViewContent', payload);
  } catch {
    /* noop */
  }
}

export function trackLead({ content_name, value, currency } = {}) {
  try {
    if (!isPixelReady()) return;
    const payload = {
      ...(content_name !== undefined && { content_name }),
      ...(value !== undefined && { value }),
      currency: currency || DEFAULT_CURRENCY,
    };
    window.fbq('track', 'Lead', payload);
    devLog('Lead', payload);
  } catch {
    /* noop */
  }
}

export function trackInitiateCheckout({ content_name, content_ids, value, currency, num_items } = {}) {
  try {
    if (!isPixelReady()) return;
    const payload = {
      ...(content_name !== undefined && { content_name }),
      ...(content_ids !== undefined && { content_ids }),
      ...(value !== undefined && { value }),
      ...(num_items !== undefined && { num_items }),
      currency: currency || DEFAULT_CURRENCY,
    };
    window.fbq('track', 'InitiateCheckout', payload);
    devLog('InitiateCheckout', payload);
  } catch {
    /* noop */
  }
}

export function trackAddPaymentInfo({ content_category, currency, value } = {}) {
  try {
    if (!isPixelReady()) return;
    const payload = {
      ...(content_category !== undefined && { content_category }),
      ...(value !== undefined && { value }),
      currency: currency || DEFAULT_CURRENCY,
    };
    window.fbq('track', 'AddPaymentInfo', payload);
    devLog('AddPaymentInfo', payload);
  } catch {
    /* noop */
  }
}

// CRITICAL: emit a deterministic eventID so the backend CAPI Purchase event
// (Step 6) can dedupe with the same eventID. If order_id is provided we use
// `purchase_<order_id>` (stable across browser/server). Otherwise we fall back
// to a generated id — dedupe won't work but the event still fires.
export function trackPurchase({ content_name, content_ids, value, currency, order_id } = {}) {
  try {
    if (!isPixelReady()) return;
    const eventID = order_id
      ? `purchase_${order_id}`
      : generateEventId('purchase', null);
    const payload = {
      ...(content_name !== undefined && { content_name }),
      ...(content_ids !== undefined && { content_ids }),
      ...(value !== undefined && { value }),
      ...(order_id !== undefined && { order_id }),
      currency: currency || DEFAULT_CURRENCY,
    };
    window.fbq('track', 'Purchase', payload, { eventID });
    devLog('Purchase', payload, eventID);
  } catch {
    /* noop */
  }
}
