/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Core types
export * from "./types/types";

// Policy
export { createPolicyChecker, PolicyChecker, DEFAULT_POLICY } from "./policy";

// Logger
export { createLogger, Logger } from "./logger";

// Agent
export { createAgent, Agent } from "./agent";

// Supabase Integration
export {
  createSupabaseClient,
  SupabaseClient,
  SupabaseConfig,
} from "./lib/supabase-client";

// Database Types
export type {
  Database,
  AgentPolicy,
  SecuritySeverity,
  AgentStatus,
  SecurityEventRow,
  AgentPolicyRow,
  AgentStatusRow,
  EventStatisticsRow,
  SecurityEventInsert,
  AgentPolicyInsert,
  AgentStatusInsert,
  SecurityEventUpdate,
  AgentPolicyUpdate,
  AgentStatusUpdate,
} from "./types/database.types";

// CLI
export { main } from "./cli";
