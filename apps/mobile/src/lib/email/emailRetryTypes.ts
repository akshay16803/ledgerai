/**
 * Type definitions for Email Retry Service
 * Extracted for better organization and reusability
 */

/**
 * Configuration for AI services
 */
export interface AiConfig {
  endpoint: string;
  secret: string;
  bearerToken?: string;
  model: string;
}

/**
 * Evidence extracted from an email for AI analysis
 */
export interface EmailEvidence {
  subject: string;
  from: string;
  body: string;
  attachmentNames: string[];
  attachmentText: string;
  hasAttachment: boolean;
}

/**
 * Parameters for queueing a cloud email analysis job
 */
export interface QueueCloudEmailJobParams {
  userId: string;
  connectorId: string;
  provider: "google" | "microsoft";
  msgId: string;
  subject: string;
  from: string;
  emailDate: string;
  evidence: EmailEvidence;
  acts: string[];
  cats: Record<string, string[]>;
  accountNames: string[];
  baseCurrency: string;
  aiConfig: AiConfig;
}

/**
 * Parameters for applying cloud email retry jobs
 */
export interface ApplyCloudRetryJobsParams {
  userId: string;
  baseCurrency: string;
  acts: string[];
  cats: Record<string, string[]>;
  accounts: Array<{ id: string; name: string; classType: string }>;
  aiConfig: AiConfig;
}

/**
 * Result from cloud queue operations
 */
export interface CloudQueueResult {
  ok: boolean;
  error?: string;
}

/**
 * Result from applying cloud retry jobs
 */
export interface ApplyCloudRetryResult {
  processed: number;
  recovered: number;
}

/**
 * Result from the retryEmailPending function
 */
export interface RetryEmailPendingResult {
  retried: number;
  recovered: number;
  remaining: number;
}

/**
 * Options for retrying pending emails
 */
export interface RetryEmailPendingOptions {
  connectorId?: string;
  force?: boolean;
}

/**
 * Context required for email sync operations
 */
export interface EmailSyncContext {
  baseCurrency: string;
  acts: string[];
  cats: Record<string, string[]>;
  accounts: Array<{ id: string; name: string; classType: string }>;
  aiConfig: AiConfig;
}

/**
 * Status of an AI analysis result
 */
export type AnalysisStatus = "success" | "no_transaction" | "retry";

/**
 * Result from AI email analysis
 */
export interface EmailAnalysisResult {
  status: AnalysisStatus;
  reason?: string;
  items: Array<{
    type: "expense" | "income" | "transfer";
    businessActivity: string;
    category: string;
    isNewCategory: boolean;
    description: string;
    amount: number;
    currency: string;
    date: string;
    vendor: string;
    paymentMethod: string;
    accountName: string;
    targetAccountName: string;
  }>;
}

/**
 * Pending email row from database
 */
export interface PendingEmailRow {
  client_id: string;
  account_client_id: string;
  msg_id: string;
  provider: string;
  subject: string;
  sender: string;
  cloud_queued: boolean;
  cloud_job_id: string | null;
  last_tried_at: string | null;
  next_retry_at: string | null;
  last_error: string | null;
  attempts: number;
  payload: Record<string, unknown>;
}
