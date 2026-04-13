/**
 * SMS Analysis Enqueuer Module
 * Handles SMS message analysis via Cloudflare AI worker
 * Follows emailProcessing.ts pattern for consistency
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedSmsMessage } from "./types";
import type { AiConfig, EmailAnalysisResult } from "@lib/email/emailProcessing";
import { DEFAULT_BASE_CURRENCY, DEFAULT_AI_MODEL } from "@lib/constants";

// Type definitions for SMS analysis context and results
export type SmsExtractionContext = {
  accountName: string;
  baseCurrency: string;
  businessActivities: string[];
  categories: Record<string, string[]>;
  aiConfig: AiConfig;
};

export type SmsAnalysisStatus = {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  lastAnalysisAt?: string;
  nextRetryAt?: string;
};

export type SmsRetryResult = {
  retried: number;
  recovered: number;
  remaining: number;
};

// Utility functions
function asString(value: unknown, fallback = "") {
  return String(value || fallback).trim();
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Build AI analysis messages for SMS
 * Follows the same pattern as buildAiEmailAnalysisMessages
 * @param sms - Normalized SMS message
 * @param context - Extraction context (accounts, categories, config)
 * @returns Array of messages for ChatGPT
 */
export function buildAiSmsAnalysisMessages(
  sms: NormalizedSmsMessage,
  context: SmsExtractionContext,
): Array<{ role: "user"; content: string }> {
  const categories = Object.entries(context.categories)
    .map(([activity, names]) => `${activity}: ${names.join(", ")}`)
    .join("\n");

  const activitiesList = context.businessActivities.join(", ");

  return [
    {
      role: "user" as const,
      content: `You are a cashflow extraction engine for bookkeeping.
Analyze this SMS message to extract transaction details.

Tasks:
1) Determine whether this SMS contains real cash movement data.
2) Extract all transactions if present.
3) Transaction type can be expense, income, or transfer.
4) Detect the original currency explicitly (ISO code: INR, USD, EUR, GBP, AED, etc).
5) Extract vendor/sender name from SMS content.

Output status:
- "success" when at least one valid transaction is extracted.
- "no_transaction" when SMS was processed and contains no cash movement.
- "retry" when extraction failed due to unreadable/insufficient data.

SMS Message:
${sms.body}

Message Date: ${sms.normalizedDate}
Sender: ${sms.sender}

Activities: ${activitiesList}
Categories:
${categories}
Ledger base currency: ${context.baseCurrency || DEFAULT_BASE_CURRENCY}

Return ONLY JSON:
{
  "status": "success|no_transaction|retry",
  "reason": "",
  "transactions": [
    {"type":"expense|income|transfer","businessActivity":"","category":"","isNewCategory":false,"description":"","amount":0,"currency":"","date":"YYYY-MM-DD","vendor":"","paymentMethod":"","accountName":"","targetAccountName":""}
  ]
}`,
    },
  ];
}

/**
 * Parse ChatGPT raw response into structured format
 * @param raw - Raw response text from AI worker
 * @returns Parsed analysis result
 */
function parseSmsAnalysisRaw(raw = "") {
  try {
    const parsed = JSON.parse(String(raw || "").replace(/```json|```/g, "").trim()) as Record<string, unknown>;
    const transactions = Array.isArray(parsed.transactions)
      ? (parsed.transactions as Array<Record<string, unknown>>)
      : [];
    const statusRaw = asString(parsed.status).toLowerCase();
    const status =
      statusRaw === "success" || statusRaw === "no_transaction" || statusRaw === "retry"
        ? statusRaw
        : transactions.length
        ? "success"
        : "no_transaction";
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

/**
 * Call Cloudflare AI worker endpoint
 * Reuses pattern from emailProcessing.ts
 * @param aiConfig - AI configuration (endpoint, auth, model)
 * @param messages - Chat messages for AI
 * @param maxTokens - Max tokens for response
 * @returns Raw response text
 */
async function callAiWorker(
  aiConfig: AiConfig,
  messages: Array<{ role: "user"; content: string }>,
  maxTokens = 800,
): Promise<string> {
  if (!aiConfig.endpoint) {
    throw new Error("AI backend endpoint missing. Configure LedgerAI AI backend before analyzing SMS.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const bearer = asString(aiConfig.bearerToken);
    if (bearer) {
      headers.Authorization = `Bearer ${bearer}`;
    } else if (aiConfig.secret) {
      headers["x-ledgerai-key"] = aiConfig.secret;
    }

    const response = await fetch(aiConfig.endpoint, {
      method: "POST",
      headers,
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
    } catch (e) { // JSON parse fallback
    }

    if (!response.ok) {
      const err = new Error(asString(data.error || data.message || text || `AI ${response.status}`));
      (err as Error & { status?: number }).status = response.status;
      throw err;
    }

    return asString(data.text ?? data.output_text ?? data.output ?? data.content ?? "");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Analyze SMS text via AI worker
 * Sends normalized SMS to ChatGPT for extraction
 * @param sms - Normalized SMS message
 * @param context - Extraction context
 * @returns Analysis result
 */
export async function analyzeSmsText(
  sms: NormalizedSmsMessage,
  context: SmsExtractionContext,
): Promise<EmailAnalysisResult> {
  const messages = buildAiSmsAnalysisMessages(sms, context);

  try {
    // Use configured AI model or default
    const aiModel = context.aiConfig.model || DEFAULT_AI_MODEL;
    const raw = await callAiWorker(context.aiConfig, messages, 1200);
    const parsed = parseSmsAnalysisRaw(raw);

    if (parsed.status === "retry") {
      console.warn("[SMS] Analysis requires retry:", { smsId: sms.id, reason: parsed.reason, model: aiModel });
      return {
        status: "retry",
        reason: parsed.reason || "ai_retry_required",
        items: [],
        messages,
      };
    }

    // Sanitize transactions (reuse email pattern would require sharing code)
    // For now, return transactions as-is; validation happens in repository
    if (parsed.status !== "success" || !parsed.transactions.length) {
      return {
        status: "no_transaction",
        reason: parsed.reason || "no_transactions_extracted",
        items: [],
        messages,
      };
    }

    // Convert to ExtractedEmailItem format
    const items = parsed.transactions
      .map((item) => ({
        type: asString(item.type).toLowerCase() as "income" | "expense" | "transfer",
        amount: Number(item.amount) || 0,
        originalAmount: Number(item.amount) || 0,
        baseAmount: Number(item.amount) || 0,
        currency: asString(item.currency || context.baseCurrency || DEFAULT_BASE_CURRENCY).toUpperCase(),
        baseCurrency: context.baseCurrency || DEFAULT_BASE_CURRENCY,
        businessActivity: asString(item.businessActivity || context.businessActivities[0] || "Personal"),
        category: asString(item.category || "Other"),
        subCategory: asString(item.subCategory || ""),
        description: asString(item.description || "SMS transaction"),
        vendor: asString(item.vendor || "SMS Vendor"),
        trackVendor: Boolean(item.vendor),
        paymentMethod: asString(item.paymentMethod || ""),
        accountName: asString(item.accountName || context.accountName || ""),
        targetAccountName: asString(item.targetAccountName || ""),
        date: asString(item.date || sms.normalizedDate),
        fxRate: 1,
        fxDate: asString(item.date || sms.normalizedDate),
        fxRateDate: asString(item.date || sms.normalizedDate),
        fxSource: "identity",
      }))
      .filter((item) => item.amount > 0);

    return {
      status: items.length ? "success" : "no_transaction",
      reason: parsed.reason || "",
      items,
      messages,
    };
  } catch (err) {
    const message = String((err as Error & { message?: string })?.message || "").toLowerCase();
    console.error("[SMS] Analysis failed:", { smsId: sms.id, error: message });
    return {
      status: "retry",
      reason: message.includes("timed out") ? "timeout" : "analysis_failed",
      items: [],
      messages,
    };
  }
}

/**
 * Save SMS message and analysis to Supabase
 * @param sms - Normalized SMS message
 * @param analysis - Analysis result
 * @param supabase - Supabase client
 * @param userId - User ID
 * @returns IDs of created records
 */
export async function saveSmsMessageAndAnalysis(
  sms: NormalizedSmsMessage,
  analysis: EmailAnalysisResult,
  supabase: SupabaseClient,
  userId: string,
): Promise<{ messageId: string; analysisId?: string }> {
  try {
    // Insert SMS message
    const { data: messageData, error: messageError } = await supabase
      .from("ledger_sms_messages")
      .insert({
        user_id: userId,
        phone_number: sms.sender,
        message_body: sms.body,
        message_date: sms.normalizedDate,
        message_timestamp: sms.timestamp,
        sms_thread_id: sms.id,
        analysis_status: analysis.status === "success" ? "completed" : analysis.status === "retry" ? "failed" : "pending",
        is_processed: analysis.status !== "retry",
        processing_completed_at: new Date().toISOString(),
        payload: {
          sms_hash: sms.hash,
          status: sms.status,
        },
      })
      .select("id")
      .single();

    if (messageError) {
      throw new Error(`[SMS] Message insert failed: ${messageError.message}`);
    }

    const messageId = messageData?.id as string;

    // Insert analysis results if successful
    if (analysis.status === "success" && analysis.items.length > 0) {
      const { data: analysisData, error: analysisError } = await supabase
        .from("ledger_sms_analysis")
        .insert(
          analysis.items.map((item) => ({
            user_id: userId,
            sms_message_id: messageId,
            input_text: sms.body,
            analysis_model: "gpt-4o-mini",
            extracted_amount: item.amount,
            extracted_currency: item.currency,
            extracted_entry_type: item.type,
            extracted_vendor: item.vendor,
            extracted_category: item.category,
            extracted_description: item.description,
            confidence_score: 0.85, // Default confidence
            raw_response: {
              ...item,
            },
            extraction_succeeded: true,
            payload: {
              business_activity: item.businessActivity,
              account_name: item.accountName,
              target_account_name: item.targetAccountName,
            },
          })),
        )
        .select("id")
        .limit(1);

      if (analysisError) {
        console.warn("[SMS] Analysis insert failed:", { messageError: analysisError.message });
      }

      return {
        messageId,
        analysisId: analysisData?.[0]?.id as string | undefined,
      };
    }

    return { messageId };
  } catch (err) {
    console.error("[SMS] Save failed:", err);
    throw err;
  }
}

/**
 * Enqueue SMS message for retry after failed analysis
 * @param smsMessageId - SMS message ID
 * @param userId - User ID
 * @param analysis - Failed analysis result
 * @param supabase - Supabase client
 */
export async function enqueueRetryJob(
  smsMessageId: string,
  userId: string,
  analysis: EmailAnalysisResult,
  supabase: SupabaseClient,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("ledger_sms_analysis")
      .update({
        extraction_succeeded: false,
        extraction_error: analysis.reason || "retry_queued",
        updated_at: new Date().toISOString(),
      })
      .eq("sms_message_id", smsMessageId)
      .eq("user_id", userId);

    if (error) {
      console.warn("[SMS] Retry queue update failed:", error.message);
    }
  } catch (err) {
    console.error("[SMS] Enqueue retry failed:", err);
  }
}

/**
 * Enqueue SMS messages for analysis
 * Main entry point: accepts normalized SMS, calls AI worker, saves results
 * @param messages - Array of normalized SMS messages
 * @param supabase - Supabase client
 * @param config - AI configuration
 */
export async function enqueueSmsForAnalysis(
  messages: NormalizedSmsMessage[],
  supabase: SupabaseClient,
  config: SmsExtractionContext,
): Promise<void> {
  if (!messages.length) {
    console.warn("[SMS] No messages to analyze");
    return;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.id) {
    throw new Error("[SMS] Authentication required for SMS analysis");
  }

  const userId = userData.user.id;
  let successCount = 0;
  let failureCount = 0;

  for (const sms of messages) {
    try {
      console.log("[SMS] Analyzing:", { smsId: sms.id, sender: sms.sender });

      // Analyze SMS
      const analysis = await analyzeSmsText(sms, config);

      // Save to database
      const result = await saveSmsMessageAndAnalysis(sms, analysis, supabase, userId);

      if (analysis.status === "success") {
        console.log("[SMS] Analysis succeeded:", { smsId: sms.id, analysisId: result.analysisId, itemCount: analysis.items.length });
        successCount += 1;
      } else if (analysis.status === "retry") {
        console.warn("[SMS] Analysis queued for retry:", { smsId: sms.id, reason: analysis.reason });
        await enqueueRetryJob(result.messageId, userId, analysis, supabase);
        failureCount += 1;
      } else {
        console.log("[SMS] No transactions found:", { smsId: sms.id });
      }
    } catch (err) {
      console.error("[SMS] Processing failed:", { smsId: sms.id, error: String(err) });
      failureCount += 1;
    }
  }

  console.log("[SMS] Batch analysis complete:", { total: messages.length, success: successCount, failed: failureCount });
}

/**
 * Get SMS analysis status
 * Returns counts of pending, processing, completed, and failed analyses
 * @param supabase - Supabase client
 * @returns Analysis status summary
 */
export async function getSmsAnalysisStatus(supabase: SupabaseClient): Promise<SmsAnalysisStatus> {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user?.id) {
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }

    const userId = userData.user.id;

    // Fetch status counts
    const { data, error } = await supabase
      .from("ledger_sms_messages")
      .select("analysis_status, created_at")
      .eq("user_id", userId);

    if (error) {
      console.error("[SMS] Status fetch failed:", error.message);
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }

    const messages = Array.isArray(data) ? data : [];
    const status: SmsAnalysisStatus = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    // Count by status
    messages.forEach((msg) => {
      const s = asString(msg.analysis_status);
      if (s === "pending") status.pending += 1;
      else if (s === "processing") status.processing += 1;
      else if (s === "completed") status.completed += 1;
      else if (s === "failed") status.failed += 1;
    });

    // Find last analysis and next retry time
    const sortedByDate = messages.sort((a, b) =>
      new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
    );

    if (sortedByDate.length > 0) {
      const lastMsg = sortedByDate[0];
      status.lastAnalysisAt = asString(lastMsg.created_at);
      // Estimate next retry in 5 minutes (would be set by cron job in production)
      if (lastMsg.analysis_status === "failed") {
        const nextRetry = new Date(lastMsg.created_at);
        nextRetry.setMinutes(nextRetry.getMinutes() + 5);
        status.nextRetryAt = nextRetry.toISOString();
      }
    }

    return status;
  } catch (err) {
    console.error("[SMS] Status calculation failed:", err);
    return { pending: 0, processing: 0, completed: 0, failed: 0 };
  }
}

/**
 * Retry failed SMS analyses
 * Re-analyzes SMS messages that previously failed
 * @param smsMessageIds - Array of SMS message IDs to retry
 * @param supabase - Supabase client
 * @param config - AI configuration
 * @returns Retry results
 */
export async function retrySmsAnalysis(
  smsMessageIds: string[],
  supabase: SupabaseClient,
  config: SmsExtractionContext,
): Promise<SmsRetryResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.id) {
    throw new Error("[SMS] Authentication required for SMS retry");
  }

  const userId = userData.user.id;
  let retried = 0;
  let recovered = 0;
  let remaining = smsMessageIds.length;

  for (const messageId of smsMessageIds) {
    try {
      // Fetch original SMS message
      const { data: msgData, error: msgError } = await supabase
        .from("ledger_sms_messages")
        .select("*")
        .eq("id", messageId)
        .eq("user_id", userId)
        .single();

      if (msgError || !msgData) {
        console.warn("[SMS] Message not found for retry:", { messageId });
        remaining -= 1;
        continue;
      }

      // Convert to normalized format
      const sms: NormalizedSmsMessage = {
        id: msgData.id,
        sender: msgData.phone_number,
        body: msgData.message_body,
        timestamp: msgData.message_timestamp,
        normalizedDate: msgData.message_date,
        status: "pending",
        hash: asString(msgData.payload?.sms_hash || ""),
      };

      // Re-analyze
      const analysis = await analyzeSmsText(sms, config);
      retried += 1;

      if (analysis.status === "success" && analysis.items.length > 0) {
        // Update with success
        await saveSmsMessageAndAnalysis(sms, analysis, supabase, userId);
        recovered += 1;
        console.log("[SMS] Retry succeeded:", { messageId, itemCount: analysis.items.length });
      } else {
        console.warn("[SMS] Retry analysis inconclusive:", { messageId, reason: analysis.reason });
      }

      remaining -= 1;
    } catch (err) {
      console.error("[SMS] Retry processing failed:", { messageId, error: String(err) });
      remaining -= 1;
    }
  }

  return { retried, recovered, remaining };
}
