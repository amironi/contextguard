/**
 * Copyright (c) 2025 Amir Mironi
 *
 * MCP Traceability Integration
 * Integrates traceability features with the MCP Security Wrapper
 */

import {
  LicenseManager,
  MCPTraceabilityManager,
  ContextTracker,
} from "./premium-features";

/**
 * Enhanced MCP Security Wrapper with Traceability
 */
export class MCPSecurityWrapperWithTraceability {
  private licenseManager: LicenseManager;
  private traceabilityManager: MCPTraceabilityManager;
  private contextTracker: ContextTracker;
  private sessionId: string;
  
  constructor(
    licenseManager: LicenseManager,
    sessionId: string
  ) {
    this.licenseManager = licenseManager;
    this.traceabilityManager = new MCPTraceabilityManager(licenseManager);
    this.contextTracker = new ContextTracker(licenseManager);
    this.sessionId = sessionId;
  }
  
  /**
   * Wrap MCP tool call with traceability
   */
  async executeToolWithTraceability(
    userId: string,
    userEmail: string,
    mcpServerName: string,
    mcpServerId: string,
    toolName: string,
    toolParameters: Record<string, unknown>,
    toolExecutor: () => Promise<unknown>
  ): Promise<{
    result?: unknown;
    error?: Error;
    traceId: string | null;
  }> {
    // Start context tracking
    this.contextTracker.startTracking(this.sessionId);
    
    const startTime = Date.now();
    let result: unknown;
    let error: Error | undefined;
    let status: "success" | "failure" | "blocked" = "success";
    let securityViolations: string[] = [];
    let threatDetected = false;
    
    try {
      // Execute the tool
      result = await toolExecutor();
      
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      status = "failure";
    }
    
    // Get context snapshot
    const contextSnapshot = this.contextTracker.stopTracking(this.sessionId);
    
    // Analyze context for security risks
    if (contextSnapshot) {
      const securityRisks = this.contextTracker.analyzeContextSecurity(contextSnapshot);
      if (securityRisks.length > 0) {
        threatDetected = true;
        securityViolations = securityRisks.map(
          (risk) => `[${risk.severity}] ${risk.risk}: ${risk.details}`
        );
        
        // Block if critical risks detected
        const hasCriticalRisk = securityRisks.some((r) => r.severity === "CRITICAL");
        if (hasCriticalRisk) {
          status = "blocked";
        }
      }
    }
    
    // Record trace
    const traceId = this.traceabilityManager.recordTrace({
      userId,
      userEmail,
      sessionId: this.sessionId,
      mcpServerName,
      mcpServerId,
      toolName,
      toolParameters,
      contextUsed: contextSnapshot || {
        filesAccessed: [],
        envVarsAccessed: [],
        externalApisCalled: [],
      },
      executionTimeMs: Date.now() - startTime,
      status,
      errorMessage: error?.message,
      securityLevel: threatDetected ? "restricted" : "internal",
      complianceTags: ["SOC2"],
      threatDetected,
      securityViolations,
    });
    
    return {
      result: status !== "blocked" ? result : undefined,
      error: status === "blocked" ? new Error("Request blocked due to security violations") : error,
      traceId,
    };
  }
  
  /**
   * Record file access in context
   */
  recordFileAccess(
    path: string,
    operation: "read" | "write" | "delete" | "list",
    size?: number
  ): void {
    this.contextTracker.recordFileAccess(this.sessionId, path, operation, size);
  }
  
  /**
   * Record environment variable access
   */
  recordEnvVarAccess(varName: string): void {
    this.contextTracker.recordEnvVarAccess(this.sessionId, varName);
  }
  
  /**
   * Record external API call
   */
  recordApiCall(url: string, method: string, statusCode?: number): void {
    this.contextTracker.recordApiCall(this.sessionId, url, method, statusCode);
  }
  
  /**
   * Get traceability manager for queries
   */
  getTraceabilityManager(): MCPTraceabilityManager {
    return this.traceabilityManager;
  }
}

/**
 * Example: Integrate with existing MCP server
 */
export async function integrateWithMCPServer() {
  const licenseManager = new LicenseManager(".contextguard-license");
  const sessionId = `session-${Date.now()}`;
  
  const wrapper = new MCPSecurityWrapperWithTraceability(
    licenseManager,
    sessionId
  );
  
  // Example tool execution
  const { result, error, traceId } = await wrapper.executeToolWithTraceability(
    "user-123",
    "user@example.com",
    "filesystem-mcp",
    "fs-001",
    "read_file",
    { path: "/home/user/config.json" },
    async () => {
      // Record context during execution
      wrapper.recordFileAccess("/home/user/config.json", "read", 1024);
      wrapper.recordEnvVarAccess("HOME");
      
      // Simulate file read
      return { content: "file content here" };
    }
  );
  
  if (error) {
    console.error(`Tool execution failed: ${error.message}`);
  } else {
    console.log(`Tool executed successfully. Trace ID: ${traceId}`);
    console.log(`Result:`, result);
  }
  
  // Query traces
  const traces = wrapper.getTraceabilityManager().queryTraces({
    userId: "user-123",
    limit: 10,
  });
  
  console.log(`\nRecent traces: ${traces.length}`);
}

/**
 * Example: Batch processing with traceability
 */
export async function batchProcessingWithTraceability() {
  const licenseManager = new LicenseManager(".contextguard-license");
  const traceabilityManager = new MCPTraceabilityManager(licenseManager);
  
  const tasks = [
    { userId: "user-1", tool: "read_file", params: { path: "/file1.txt" } },
    { userId: "user-2", tool: "write_file", params: { path: "/file2.txt" } },
    { userId: "user-3", tool: "list_dir", params: { path: "/home" } },
  ];
  
  console.log("Processing batch with traceability...\n");
  
  for (const task of tasks) {
    const sessionId = `session-${Date.now()}-${task.userId}`;
    const contextTracker = new ContextTracker(licenseManager);
    
    contextTracker.startTracking(sessionId);
    
    const startTime = Date.now();
    
    // Simulate task execution
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
    
    const contextSnapshot = contextTracker.stopTracking(sessionId);
    
    traceabilityManager.recordTrace({
      userId: task.userId,
      sessionId,
      mcpServerName: "filesystem-mcp",
      mcpServerId: "fs-001",
      toolName: task.tool,
      toolParameters: task.params,
      contextUsed: contextSnapshot || {
        filesAccessed: [],
        envVarsAccessed: [],
        externalApisCalled: [],
      },
      executionTimeMs: Date.now() - startTime,
      status: "success",
      securityLevel: "internal",
      complianceTags: ["SOC2"],
      threatDetected: false,
      securityViolations: [],
    });
    
    console.log(`✅ Processed: ${task.userId} - ${task.tool}`);
  }
  
  // Get statistics
  const stats = traceabilityManager.getUsageStatistics();
  console.log(`\n📊 Batch Statistics:`);
  console.log(`  Total Traces: ${stats.totalTraces}`);
  console.log(`  Unique Users: ${stats.uniqueUsers}`);
  console.log(`  Unique Tools: ${stats.uniqueTools}`);
}

/**
 * Example: Real-time dashboard data
 */
export function getDashboardData(
  traceabilityManager: MCPTraceabilityManager
): {
  overview: {
    totalTraces: number;
    activeUsers: number;
    activeMCPServers: number;
    threatCount: number;
  };
  recentActivity: Array<{
    timestamp: Date;
    user: string;
    server: string;
    tool: string;
    status: string;
  }>;
  topUsers: Array<{ userId: string; count: number }>;
  topTools: Array<{ toolName: string; count: number }>;
  securityAlerts: Array<{
    timestamp: Date;
    user: string;
    threat: string;
    severity: string;
  }>;
} {
  const stats = traceabilityManager.getUsageStatistics();
  
  // Recent activity
  const recentTraces = traceabilityManager.queryTraces({
    limit: 20,
    sortBy: "timestamp",
    sortOrder: "desc",
  });
  
  const recentActivity = recentTraces.map((trace) => ({
    timestamp: trace.timestamp,
    user: trace.userId,
    server: trace.mcpServerName,
    tool: trace.toolName,
    status: trace.status,
  }));
  
  // Top users
  const topUsers = Object.entries(stats.byUser)
    .map(([userId, data]) => ({ userId, count: data.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Top tools
  const topTools = Object.entries(stats.byTool)
    .map(([toolName, data]) => ({ toolName, count: data.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Security alerts
  const threatTraces = traceabilityManager.queryTraces({
    threatDetected: true,
    limit: 50,
  });
  
  const securityAlerts = threatTraces.map((trace) => ({
    timestamp: trace.timestamp,
    user: trace.userId,
    threat: trace.securityViolations.join(", "),
    severity: "HIGH",
  }));
  
  return {
    overview: {
      totalTraces: stats.totalTraces,
      activeUsers: stats.uniqueUsers,
      activeMCPServers: stats.uniqueMCPServers,
      threatCount: stats.securityEvents.totalThreats,
    },
    recentActivity,
    topUsers,
    topTools,
    securityAlerts,
  };
}

/**
 * Example: Compliance report generation
 */
export function generateComplianceReport(
  traceabilityManager: MCPTraceabilityManager,
  startDate: Date,
  endDate: Date
): {
  reportId: string;
  period: { start: Date; end: Date };
  summary: {
    totalOperations: number;
    uniqueUsers: number;
    securityIncidents: number;
    complianceScore: number;
  };
  userActivity: Array<{
    userId: string;
    operations: number;
    mcpServers: string[];
    securityIncidents: number;
  }>;
  securityIncidents: Array<{
    timestamp: Date;
    userId: string;
    description: string;
    severity: string;
  }>;
  recommendations: string[];
} {
  const traces = traceabilityManager.queryTraces({
    startDate,
    endDate,
    limit: 10000,
  });
  
  const stats = traceabilityManager.getUsageStatistics({ startDate, endDate });
  
  // Calculate compliance score (0-100)
  const totalOperations = traces.length;
  const securityIncidentCount = traces.filter((t) => t.threatDetected).length;
  const complianceScore = Math.max(
    0,
    100 - (securityIncidentCount / totalOperations) * 100
  );
  
  // User activity
  const userActivity = Object.entries(stats.byUser).map(([userId, data]) => ({
    userId,
    operations: data.count,
    mcpServers: data.mcpServersUsed,
    securityIncidents: traces.filter(
      (t) => t.userId === userId && t.threatDetected
    ).length,
  }));
  
  // Security incidents
  const securityIncidentsList = traces
    .filter((t) => t.threatDetected)
    .map((t) => ({
      timestamp: t.timestamp,
      userId: t.userId,
      description: t.securityViolations.join(", "),
      severity: "HIGH",
    }));
  
  // Recommendations
  const recommendations: string[] = [];
  if (securityIncidentsList.length > 0) {
    recommendations.push(
      `Review and address ${securityIncidentsList.length} security incidents`
    );
  }
  if (complianceScore < 95) {
    recommendations.push("Improve security controls to achieve 95%+ compliance score");
  }
  
  return {
    reportId: `report-${Date.now()}`,
    period: { start: startDate, end: endDate },
    summary: {
      totalOperations,
      uniqueUsers: stats.uniqueUsers,
      securityIncidents: securityIncidentCount,
      complianceScore,
    },
    userActivity,
    securityIncidents: securityIncidentsList,
    recommendations,
  };
}

// Export all functions
export default {
  MCPSecurityWrapperWithTraceability,
  integrateWithMCPServer,
  batchProcessingWithTraceability,
  getDashboardData,
  generateComplianceReport,
};
