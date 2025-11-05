/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Security configuration options for the MCP wrapper
 */
export interface CgPolicyType {
  /** Maximum number of tool calls allowed per minute (default: 30) */
  maxToolCallsPerMinute?: number;

  /** Patterns to block in tool calls */
  blockedPatterns?: string[];

  /** Allowed file paths for file operations (empty = all allowed) */
  allowedFilePaths?: string[];

  /** Number of violations before triggering alerts (default: 5) */
  alertThreshold?: number;

  /** Enable prompt injection detection (default: true) */
  enablePromptInjectionDetection?: boolean;

  /** Enable sensitive data detection (default: true) */
  enableSensitiveDataDetection?: boolean;

  /** Path to security log file */
  logPath?: string;

  /** Enable pro features (requires license) */
  enableProFeatures?: boolean;

  /** License file path for pro features */
  licenseFilePath?: string;
}

/**
 * Security event severity levels
 */
export type SecuritySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Security event logged by the system
 */
export interface SecurityEvent {
  /** ISO timestamp of the event */
  timestamp: string;

  /** Type of security event */
  eventType: string;

  /** Severity level */
  severity: SecuritySeverity;

  /** Additional event details */
  details: Record<string, unknown>;

  /** Session identifier */
  sessionId: string;
}

/**
 * MCP JSON-RPC message structure
 */
export interface MCPMessage {
  /** JSON-RPC version */
  jsonrpc: string;

  /** Request/response ID */
  id?: string | number;

  /** Method name for requests */
  method?: string;

  /** Method parameters */
  params?: {
    name?: string;
    arguments?: Record<string, string>;
    path?: string;
    filePath?: string;
    [key: string]: unknown;
  };

  /** Response result */
  result?: unknown;

  /** Error object */
  error?: unknown;
}

/**
 * Statistics about security events
 */
export interface SecurityStatistics {
  /** Total number of events logged */
  totalEvents: number;

  /** Events grouped by type */
  eventsByType: Record<string, number>;

  /** Events grouped by severity */
  eventsBySeverity: Record<string, number>;

  /** Most recent events */
  recentEvents: SecurityEvent[];
}
