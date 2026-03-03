/**
 * Cloudflare Worker: LedgerAI AI proxy
 *
 * Deploy this worker and set:
 * - ANTHROPIC_API_KEY (optional)
 * - OPENAI_API_KEY (optional)
 * - LEDGERAI_SHARED_KEY (optional, recommended)
 * - ALLOWED_ORIGIN (optional, e.g. https://accounts.niprasha.com)
 *
 * Endpoint expected by frontend:
 * POST /  body: { model, max_tokens, messages }
 * Header (optional): x-ledgerai-key
 * Response: { text, usage }
 */

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
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,x-ledgerai-key",
    Vary: "Origin",
    "X-Request-Origin": origin || "",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN || "*");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    if (env.LEDGERAI_SHARED_KEY) {
      const got = request.headers.get("x-ledgerai-key") || "";
      if (got !== env.LEDGERAI_SHARED_KEY) {
        return json({ error: "Unauthorized" }, 401, cors);
      }
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, cors);
    }

    const model = (payload?.model || "claude-sonnet-4-20250514") + "";
    const maxTokens = Math.max(64, Math.min(Number(payload?.max_tokens) || 800, 4096));
    const messages = Array.isArray(payload?.messages) ? payload.messages : null;
    if (!messages || !messages.length) {
      return json({ error: "messages[] is required" }, 400, cors);
    }

    const useOpenAI = /^(gpt|o[0-9])/i.test(model);
    let upstream;
    if (useOpenAI) {
      if (!env.OPENAI_API_KEY) {
        return json({ error: "Missing OPENAI_API_KEY for model " + model }, 500, cors);
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
        return json({ error: "Missing ANTHROPIC_API_KEY for model " + model }, 500, cors);
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
      return json(
        {
          error: data?.error?.message || data?.message || raw.slice(0, 300),
          upstream_status: upstream.status,
        },
        upstream.status,
        cors,
      );
    }

    const text = useOpenAI
      ? (data?.choices?.[0]?.message?.content || "")
      : (data?.content?.[0]?.text || "");
    return json({ text, usage: data?.usage || null }, 200, cors);
  },
};
