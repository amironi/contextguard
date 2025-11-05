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
 * Agent policy configuration
 */
export interface AgentPolicy {
  maxToolCallsPerMinute?: number;
  enablePromptInjectionDetection?: boolean;
  enableSensitiveDataDetection?: boolean;
  allowedFilePaths?: string[];
  blockedPatterns?: string[];
  alertThreshold?: number;
  logPath?: string;
  enableProFeatures?: boolean;
  licenseFilePath?: string;
}

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
