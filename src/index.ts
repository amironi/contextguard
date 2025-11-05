/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ContextGuard - Security monitoring wrapper for MCP servers
 *
 * @packageDocumentation
 */

// Core types
export * from "./types";

// Security components
export { CgPolicy } from "./cg-policy";
export { SecurityLogger } from "./security-logger";

// Main wrapper
export { CgAgent } from "./cg-agent";

// Premium features
export {
  LicenseManager,
  LicenseTier,
  LicenseInfo,
  DashboardAnalytics,
  TeamCollaboration,
  CustomRulesEngine,
  SSOProvider,
  MLDetectionEngine,
  ComplianceReporter,
  PrioritySupport,
  SLAMonitor,
  MCPTraceabilityManager,
  ContextTracker,
  MCPTraceRecord,
  ContextSnapshot,
  TraceabilityQuery,
  UsageStatistics,
  AnalyticsData,
  ComplianceReport,
  ComplianceFinding,
  CustomRule,
  TeamMember,
} from "./premium-features";

// Traceability integration
export {
  MCPSecurityWrapperWithTraceability,
  integrateWithMCPServer,
  batchProcessingWithTraceability,
  getDashboardData,
  generateComplianceReport,
} from "./mcp-traceability-integration";

// CLI
export { main as runCLI } from "./cli";
