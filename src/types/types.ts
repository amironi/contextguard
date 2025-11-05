/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Re-export AgentPolicy from database types
 */
export type { AgentPolicy } from "./database.types";

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
