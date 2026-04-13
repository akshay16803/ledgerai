/**
 * Email Retry Service
 * 
 * This module provides a clean interface for email retry operations.
 * It serves as a facade over the internal implementation in createLedgerRepository.
 * 
 * Usage:
 *   import { EmailRetryService } from '@lib/email/emailRetryService';
 *   
 *   const service = new EmailRetryService(repository);
 *   const result = await service.retryPending({ force: true });
 */

import type {
  RetryEmailPendingOptions,
  RetryEmailPendingResult,
  ApplyCloudRetryResult,
  EmailSyncContext,
  AiConfig,
} from "./emailRetryTypes";
import { emailRetryLogger } from "@lib/utils/logger";

/**
 * Repository interface - the minimal contract needed from the ledger repository
 */
export interface ILedgerRepository {
  retryEmailPending(opts?: RetryEmailPendingOptions): Promise<RetryEmailPendingResult>;
  getEmailSyncStatus(connectorId?: string): Promise<{
    total: number;
    synced: number;
    failed: number;
    pendingAi: number;
  }>;
}

/**
 * Email Retry Service class
 * Provides a clean, testable interface for email retry operations
 */
export class EmailRetryService {
  private repository: ILedgerRepository;

  constructor(repository: ILedgerRepository) {
    this.repository = repository;
  }

  /**
   * Retry all pending email extractions
   * @param options - Optional configuration
   * @param options.connectorId - Specific connector to retry (optional)
   * @param options.force - Force retry even if not due (default: false)
   */
  async retryPending(options: RetryEmailPendingOptions = {}): Promise<RetryEmailPendingResult> {
    emailRetryLogger.info("EmailRetryService.retryPending called", {
      connectorId: options.connectorId,
      force: options.force,
    });

    try {
      const result = await this.repository.retryEmailPending(options);
      
      emailRetryLogger.info("EmailRetryService.retryPending completed", {
        retried: result.retried,
        recovered: result.recovered,
        remaining: result.remaining,
      });

      return result;
    } catch (error) {
      emailRetryLogger.error("EmailRetryService.retryPending failed", {
        error: (error as Error)?.message,
      });
      throw error;
    }
  }

  /**
   * Get the current status of email sync/retry
   * @param connectorId - Optional connector ID to filter by
   */
  async getStatus(connectorId?: string): Promise<{
    total: number;
    synced: number;
    failed: number;
    pendingAi: number;
    healthStatus: "healthy" | "warning" | "critical";
  }> {
    const status = await this.repository.getEmailSyncStatus(connectorId);
    
    // Calculate health status based on pending/failed ratio
    let healthStatus: "healthy" | "warning" | "critical" = "healthy";
    if (status.pendingAi > 10 || status.failed > 5) {
      healthStatus = "warning";
    }
    if (status.pendingAi > 50 || status.failed > 20) {
      healthStatus = "critical";
    }

    return {
      ...status,
      healthStatus,
    };
  }

  /**
   * Check if there are pending items that need retry
   */
  async hasPendingItems(connectorId?: string): Promise<boolean> {
    const status = await this.getStatus(connectorId);
    return status.pendingAi > 0;
  }
}

/**
 * Factory function to create EmailRetryService
 * Use this instead of direct instantiation for easier testing
 */
export function createEmailRetryService(repository: ILedgerRepository): EmailRetryService {
  return new EmailRetryService(repository);
}

/**
 * Helper to validate AI config before retry operations
 */
export function validateAiConfig(config: Partial<AiConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.endpoint) {
    errors.push("AI backend endpoint is missing");
  }

  if (!config.bearerToken && !config.secret) {
    errors.push("AI authentication is not configured (need bearerToken or secret)");
  }

  if (!config.model) {
    errors.push("AI model is not specified");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Constants for email retry configuration
 */
export const EMAIL_RETRY_CONFIG = {
  /** Time in ms after which a cloud-queued item is considered stale */
  STALE_THRESHOLD_MS: 30 * 60 * 1000, // 30 minutes
  
  /** Maximum items to process in a single retry batch */
  MAX_BATCH_SIZE: 60,
  
  /** Timeout for cloud queue pull operation */
  PULL_TIMEOUT_MS: 120_000, // 2 minutes
  
  /** Default AI model to use */
  DEFAULT_MODEL: "gpt-4o-mini",
} as const;
