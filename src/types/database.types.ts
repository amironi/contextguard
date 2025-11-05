/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Database types for Supabase schema
 * Generated from supabase-schema.sql
 */

/**
 * Agent policy configuration
 */
export interface AgentPolicy {
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

export interface Database {
  public: {
    Tables: {
      agent_policies: {
        Row: {
          id: string;
          agent_id: string;
          policy: AgentPolicy;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          policy: AgentPolicy;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          policy?: AgentPolicy;
          created_at?: string;
          updated_at?: string;
        };
      };
      security_events: {
        Row: {
          id: string;
          agent_id: string;
          session_id: string;
          event_type: string;
          severity: SecuritySeverity;
          details: Record<string, unknown>;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          session_id: string;
          event_type: string;
          severity: SecuritySeverity;
          details: Record<string, unknown>;
          timestamp: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          session_id?: string;
          event_type?: string;
          severity?: SecuritySeverity;
          details?: Record<string, unknown>;
          timestamp?: string;
          created_at?: string;
        };
      };
      agent_status: {
        Row: {
          id: string;
          agent_id: string;
          status: AgentStatus;
          last_seen: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          status: AgentStatus;
          last_seen: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          status?: AgentStatus;
          last_seen?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      event_statistics: {
        Row: {
          agent_id: string;
          event_type: string;
          severity: SecuritySeverity;
          count: number;
          hour: string;
        };
      };
    };
    Functions: {
      cleanup_old_events: {
        Args: {
          days_to_keep?: number;
        };
        Returns: number;
      };
    };
  };
}

/**
 * Security severity levels
 */
export type SecuritySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Agent status types
 */
export type AgentStatus = "online" | "offline" | "error";

/**
 * Security event from database
 */
export type SecurityEventRow = Database["public"]["Tables"]["security_events"]["Row"];

/**
 * Agent policy from database
 */
export type AgentPolicyRow = Database["public"]["Tables"]["agent_policies"]["Row"];

/**
 * Agent status from database
 */
export type AgentStatusRow = Database["public"]["Tables"]["agent_status"]["Row"];

/**
 * Event statistics from view
 */
export type EventStatisticsRow = Database["public"]["Views"]["event_statistics"]["Row"];

/**
 * Insert types for convenience
 */
export type SecurityEventInsert = Database["public"]["Tables"]["security_events"]["Insert"];
export type AgentPolicyInsert = Database["public"]["Tables"]["agent_policies"]["Insert"];
export type AgentStatusInsert = Database["public"]["Tables"]["agent_status"]["Insert"];

/**
 * Update types for convenience
 */
export type SecurityEventUpdate = Database["public"]["Tables"]["security_events"]["Update"];
export type AgentPolicyUpdate = Database["public"]["Tables"]["agent_policies"]["Update"];
export type AgentStatusUpdate = Database["public"]["Tables"]["agent_status"]["Update"];
