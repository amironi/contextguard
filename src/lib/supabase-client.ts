/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient as SupabaseJsClient } from "@supabase/supabase-js";
import { SecurityEvent } from "../types/types";
import type { Database, AgentPolicy } from "../types/database.types";

/**
 * Supabase configuration
 */
export interface SupabaseConfig {
  url: string;
  serviceKey: string;
  agentId?: string;
}

/**
 * Supabase client for agent-dashboard communication
 */
export interface SupabaseClient {
  reportEvent: (event: SecurityEvent) => Promise<void>;
  fetchPolicy: (agentId: string) => Promise<AgentPolicy | null>;
  updateAgentStatus: (agentId: string, status: string) => Promise<void>;
  getClient: () => SupabaseJsClient<Database>;
}

/**
 * Create a Supabase client
 */
export const createSupabaseClient = (
  config: SupabaseConfig
): SupabaseClient => {
  const { url, serviceKey } = config;

  // Create Supabase client using the official SDK
  const supabase = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return {
    /**
     * Report a security event to Supabase
     */
    reportEvent: async (event: SecurityEvent): Promise<void> => {
      try {
        const eventData = {
          agent_id: config.agentId || "unknown",
          event_type: event.eventType,
          severity: event.severity,
          details: event.details,
          session_id: event.sessionId,
          timestamp: event.timestamp,
        };

        const { error } = await supabase
          .from("security_events")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(eventData as any);

        if (error) {
          console.error("Failed to report event to Supabase:", error);
        }
      } catch (error) {
        console.error("Failed to report event to Supabase:", error);
        // Don't throw - we don't want to break the agent if reporting fails
      }
    },

    /**
     * Fetch policy configuration for an agent
     */
    fetchPolicy: async (agentId: string): Promise<AgentPolicy | null> => {
      try {
        const { data, error } = await supabase
          .from("agent_policies")
          .select("policy")
          .eq("agent_id", agentId)
          .single();

        if (error) {
          console.error("Failed to fetch policy from Supabase:", error);
          return null;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return ((data as any)?.policy as AgentPolicy) || null;
      } catch (error) {
        console.error("Failed to fetch policy from Supabase:", error);
        return null;
      }
    },

    /**
     * Update agent status
     */
    updateAgentStatus: async (
      agentId: string,
      status: string
    ): Promise<void> => {
      try {
        const statusData = {
          agent_id: agentId,
          status: status as "online" | "offline" | "error",
          last_seen: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("agent_status")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .upsert(statusData as any, {
            onConflict: "agent_id",
          });

        if (error) {
          console.error("Failed to update agent status:", error);
        }
      } catch (error) {
        console.error("Failed to update agent status:", error);
      }
    },

    /**
     * Get the underlying Supabase client
     */
    getClient: (): SupabaseJsClient => supabase,
  };
};
