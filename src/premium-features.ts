/**
 * Copyright (c) 2025 Amir Mironi
 *
 * Premium/Enterprise Features for ContextGuard
 * These features require a valid license key
 */

import * as fs from "fs";
import * as crypto from "crypto";

export enum LicenseTier {
  FREE = "free",
  PRO = "pro",
  ENTERPRISE = "enterprise",
}

export interface LicenseInfo {
  tier: LicenseTier;
  key: string;
  expiresAt: Date;
  features: string[];
  organizationId?: string;
  maxUsers?: number;
}

export interface AnalyticsData {
  timestamp: Date;
  eventType: string;
  severity: string;
  metadata: Record<string, unknown>;
}

export interface ComplianceReport {
  reportId: string;
  generatedAt: Date;
  standard: "SOC2" | "GDPR" | "HIPAA";
  findings: ComplianceFinding[];
  status: "PASS" | "FAIL" | "WARNING";
}

export interface ComplianceFinding {
  control: string;
  status: "PASS" | "FAIL" | "WARNING";
  details: string;
  remediation?: string;
}

export interface CustomRule {
  id: string;
  name: string;
  description: string;
  pattern: RegExp;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  action: "LOG" | "BLOCK";
  enabled: boolean;
}

export interface TeamMember {
  userId: string;
  email: string;
  role: "ADMIN" | "MEMBER" | "VIEWER";
  permissions: string[];
}

/**
 * License Manager - Validates and manages license keys
 */
export class LicenseManager {
  private licenseInfo: LicenseInfo | null = null;
  private licenseFilePath: string;

  constructor(licenseFilePath: string = ".contextguard-license") {
    this.licenseFilePath = licenseFilePath;
    this.loadLicense();
  }

  private loadLicense(): void {
    try {
      if (fs.existsSync(this.licenseFilePath)) {
        const licenseData = JSON.parse(
          fs.readFileSync(this.licenseFilePath, "utf-8")
        );
        this.licenseInfo = {
          ...licenseData,
          expiresAt: new Date(licenseData.expiresAt),
        };
      } else {
        // Default to free tier
        this.licenseInfo = {
          tier: LicenseTier.FREE,
          key: "free",
          expiresAt: new Date("2099-12-31"),
          features: [],
        };
      }
    } catch (error) {
      console.error("Failed to load license:", error);
      this.licenseInfo = {
        tier: LicenseTier.FREE,
        key: "free",
        expiresAt: new Date("2099-12-31"),
        features: [],
      };
    }
  }

  public validateLicense(): boolean {
    if (!this.licenseInfo) return false;
    if (this.licenseInfo.tier === LicenseTier.FREE) return true;
    return new Date() < this.licenseInfo.expiresAt;
  }

  public getTier(): LicenseTier {
    return this.licenseInfo?.tier || LicenseTier.FREE;
  }

  public hasFeature(feature: string): boolean {
    if (!this.licenseInfo) return false;
    if (this.licenseInfo.tier === LicenseTier.FREE) return false;
    return this.licenseInfo.features.includes(feature);
  }

  public getLicenseInfo(): LicenseInfo | null {
    return this.licenseInfo;
  }
}

/**
 * Web Dashboard Analytics - Collects and aggregates security metrics
 * PRO FEATURE
 */
export class DashboardAnalytics {
  private licenseManager: LicenseManager;
  private analyticsData: AnalyticsData[] = [];
  private readonly maxStoredEvents = 10000;

  constructor(licenseManager: LicenseManager) {
    this.licenseManager = licenseManager;
  }

  public trackEvent(
    eventType: string,
    severity: string,
    metadata: Record<string, unknown>
  ): void {
    if (!this.licenseManager.hasFeature("dashboard")) {
      console.warn(
        "Dashboard analytics requires a Pro license. Upgrade at https://contextguard.dev/pro"
      );
      return;
    }

    const event: AnalyticsData = {
      timestamp: new Date(),
      eventType,
      severity,
      metadata,
    };

    this.analyticsData.push(event);

    // Keep only recent events to prevent memory issues
    if (this.analyticsData.length > this.maxStoredEvents) {
      this.analyticsData = this.analyticsData.slice(-this.maxStoredEvents);
    }
  }

  public getMetrics(timeRange: "1h" | "24h" | "7d" | "30d"): Record<string, unknown> {
    if (!this.licenseManager.hasFeature("dashboard")) {
      return { error: "Dashboard analytics requires a Pro license" };
    }

    const now = Date.now();
    const ranges = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    const cutoff = now - ranges[timeRange];
    const filteredEvents = this.analyticsData.filter(
      (e) => e.timestamp.getTime() > cutoff
    );

    return {
      totalEvents: filteredEvents.length,
      eventsByType: this.groupBy(filteredEvents, "eventType"),
      eventsBySeverity: this.groupBy(filteredEvents, "severity"),
      timeline: this.getTimeline(filteredEvents),
    };
  }

  private groupBy(
    events: AnalyticsData[],
    field: keyof AnalyticsData
  ): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const event of events) {
      const key = String(event[field]);
      grouped[key] = (grouped[key] || 0) + 1;
    }
    return grouped;
  }

  private getTimeline(events: AnalyticsData[]): Array<{ time: string; count: number }> {
    const timeline: Record<string, number> = {};
    for (const event of events) {
      const hour = new Date(event.timestamp).toISOString().slice(0, 13);
      timeline[hour] = (timeline[hour] || 0) + 1;
    }
    return Object.entries(timeline).map(([time, count]) => ({ time, count }));
  }
}

/**
 * Team Collaboration Manager
 * PRO FEATURE
 */
export class TeamCollaboration {
  private licenseManager: LicenseManager;
  private teamMembers: Map<string, TeamMember> = new Map();

  constructor(licenseManager: LicenseManager) {
    this.licenseManager = licenseManager;
  }

  public addMember(member: TeamMember): boolean {
    if (!this.licenseManager.hasFeature("team-collaboration")) {
      console.warn(
        "Team collaboration requires a Pro license. Upgrade at https://contextguard.dev/pro"
      );
      return false;
    }

    const licenseInfo = this.licenseManager.getLicenseInfo();
    if (licenseInfo?.maxUsers && this.teamMembers.size >= licenseInfo.maxUsers) {
      console.warn(`Maximum team size (${licenseInfo.maxUsers}) reached`);
      return false;
    }

    this.teamMembers.set(member.userId, member);
    return true;
  }

  public removeMember(userId: string): boolean {
    if (!this.licenseManager.hasFeature("team-collaboration")) {
      return false;
    }
    return this.teamMembers.delete(userId);
  }

  public getMember(userId: string): TeamMember | undefined {
    return this.teamMembers.get(userId);
  }

  public listMembers(): TeamMember[] {
    if (!this.licenseManager.hasFeature("team-collaboration")) {
      return [];
    }
    return Array.from(this.teamMembers.values());
  }

  public hasPermission(userId: string, permission: string): boolean {
    const member = this.teamMembers.get(userId);
    if (!member) return false;
    return member.permissions.includes(permission) || member.role === "ADMIN";
  }
}

/**
 * Custom Detection Rules Engine
 * PRO FEATURE
 */
export class CustomRulesEngine {
  private licenseManager: LicenseManager;
  private rules: Map<string, CustomRule> = new Map();

  constructor(licenseManager: LicenseManager) {
    this.licenseManager = licenseManager;
  }

  public addRule(rule: CustomRule): boolean {
    if (!this.licenseManager.hasFeature("custom-rules")) {
      console.warn(
        "Custom detection rules require a Pro license. Upgrade at https://contextguard.dev/pro"
      );
      return false;
    }

    this.rules.set(rule.id, rule);
    return true;
  }

  public removeRule(ruleId: string): boolean {
    if (!this.licenseManager.hasFeature("custom-rules")) {
      return false;
    }
    return this.rules.delete(ruleId);
  }

  public evaluateRules(text: string): Array<{ rule: CustomRule; matches: string[] }> {
    if (!this.licenseManager.hasFeature("custom-rules")) {
      return [];
    }

    const results: Array<{ rule: CustomRule; matches: string[] }> = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const matches = text.match(rule.pattern);
      if (matches && matches.length > 0) {
        results.push({ rule, matches: Array.from(matches) });
      }
    }

    return results;
  }

  public listRules(): CustomRule[] {
    if (!this.licenseManager.hasFeature("custom-rules")) {
      return [];
    }
    return Array.from(this.rules.values());
  }
}

/**
 * SSO/SAML Authentication Provider
 * ENTERPRISE FEATURE
 */
export class SSOProvider {
  private licenseManager: LicenseManager;
  private samlConfig: Record<string, unknown> | null = null;

  constructor(licenseManager: LicenseManager) {
    this.licenseManager = licenseManager;
  }

  public configureSAML(config: Record<string, unknown>): boolean {
    if (!this.licenseManager.hasFeature("sso-saml")) {
      console.warn(
        "SSO/SAML requires an Enterprise license. Contact sales@contextguard.dev"
      );
      return false;
    }

    this.samlConfig = config;
    return true;
  }

  public validateSAMLToken(token: string): { valid: boolean; userId?: string } {
    if (!this.licenseManager.hasFeature("sso-saml")) {
      return { valid: false };
    }

    // Placeholder implementation
    // In production, this would validate against SAML IdP
    console.log("SAML token validation (placeholder):", token.substring(0, 20));
    return { valid: true, userId: "saml-user-123" };
  }
}

/**
 * Advanced ML-Based Detection
 * PRO FEATURE
 */
export class MLDetectionEngine {
  private licenseManager: LicenseManager;
  private anomalyThreshold: number = 0.75;

  constructor(licenseManager: LicenseManager) {
    this.licenseManager = licenseManager;
  }

  public detectAnomalies(
    text: string,
    _context?: Record<string, unknown>
  ): { isAnomaly: boolean; confidence: number; reason?: string } {
    if (!this.licenseManager.hasFeature("ml-detection")) {
      console.warn(
        "ML-based detection requires a Pro license. Upgrade at https://contextguard.dev/pro"
      );
      return { isAnomaly: false, confidence: 0 };
    }

    // Placeholder implementation
    // In production, this would use a trained ML model
    const suspiciousPatterns = [
      /eval\(/gi,
      /exec\(/gi,
      /system\(/gi,
      /__import__/gi,
    ];

    let suspicionScore = 0;
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(text)) {
        suspicionScore += 0.3;
      }
    }

    const isAnomaly = suspicionScore >= this.anomalyThreshold;
    return {
      isAnomaly,
      confidence: Math.min(suspicionScore, 1.0),
      reason: isAnomaly ? "Suspicious code execution patterns detected" : undefined,
    };
  }
}

/**
 * Compliance Reporting Generator
 * PRO FEATURE
 */
export class ComplianceReporter {
  private licenseManager: LicenseManager;

  constructor(licenseManager: LicenseManager) {
    this.licenseManager = licenseManager;
  }

  public generateReport(
    standard: "SOC2" | "GDPR" | "HIPAA",
    _events?: Array<Record<string, unknown>>
  ): ComplianceReport | null {
    if (!this.licenseManager.hasFeature("compliance-reports")) {
      console.warn(
        "Compliance reports require a Pro license. Upgrade at https://contextguard.dev/pro"
      );
      return null;
    }

    const reportId = crypto.randomBytes(16).toString("hex");
    const findings: ComplianceFinding[] = [];

    // Placeholder compliance checks
    switch (standard) {
      case "SOC2":
        findings.push({
          control: "CC6.1 - Logical Access Controls",
          status: "PASS",
          details: "Access controls are properly implemented",
        });
        findings.push({
          control: "CC7.2 - System Monitoring",
          status: "PASS",
          details: "Security monitoring is active",
        });
        break;
      case "GDPR":
        findings.push({
          control: "Article 32 - Security of Processing",
          status: "PASS",
          details: "Appropriate security measures in place",
        });
        break;
      case "HIPAA":
        findings.push({
          control: "164.312(a)(1) - Access Control",
          status: "PASS",
          details: "Access controls implemented",
        });
        break;
    }

    const hasFailures = findings.some((f) => f.status === "FAIL");
    const hasWarnings = findings.some((f) => f.status === "WARNING");

    return {
      reportId,
      generatedAt: new Date(),
      standard,
      findings,
      status: hasFailures ? "FAIL" : hasWarnings ? "WARNING" : "PASS",
    };
  }

  public exportReport(report: ComplianceReport, format: "JSON" | "PDF"): string {
    if (format === "JSON") {
      return JSON.stringify(report, null, 2);
    }
    // PDF generation would require additional libraries
    return `Compliance Report - ${report.standard} (PDF export requires additional setup)`;
  }
}

/**
 * Priority Support Manager
 * PRO/ENTERPRISE FEATURE
 */
export class PrioritySupport {
  private licenseManager: LicenseManager;

  constructor(licenseManager: LicenseManager) {
    this.licenseManager = licenseManager;
  }

  public createTicket(
    subject: string,
    description: string,
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  ): { ticketId: string; sla: string } | null {
    if (!this.licenseManager.hasFeature("priority-support")) {
      console.warn(
        "Priority support requires a Pro license. Upgrade at https://contextguard.dev/pro"
      );
      return null;
    }

    const ticketId = `TICKET-${Date.now()}`;
    const tier = this.licenseManager.getTier();

    const slaHours =
      tier === LicenseTier.ENTERPRISE
        ? priority === "CRITICAL"
          ? "1 hour"
          : "4 hours"
        : "24 hours";

    console.log(`Support ticket created: ${ticketId} (SLA: ${slaHours})`);

    return { ticketId, sla: slaHours };
  }
}

/**
 * SLA Monitor
 * ENTERPRISE FEATURE
 */
export class SLAMonitor {
  private licenseManager: LicenseManager;
  private uptimeStart: Date;
  private downtimeEvents: Array<{ start: Date; end?: Date }> = [];

  constructor(licenseManager: LicenseManager) {
    this.licenseManager = licenseManager;
    this.uptimeStart = new Date();
  }

  public recordDowntime(): void {
    if (!this.licenseManager.hasFeature("sla-guarantees")) {
      return;
    }
    this.downtimeEvents.push({ start: new Date() });
  }

  public recordUptime(): void {
    if (!this.licenseManager.hasFeature("sla-guarantees")) {
      return;
    }
    const lastEvent = this.downtimeEvents[this.downtimeEvents.length - 1];
    if (lastEvent && !lastEvent.end) {
      lastEvent.end = new Date();
    }
  }

  public getUptimePercentage(): number {
    if (!this.licenseManager.hasFeature("sla-guarantees")) {
      return 0;
    }

    const totalTime = Date.now() - this.uptimeStart.getTime();
    let totalDowntime = 0;

    for (const event of this.downtimeEvents) {
      const end = event.end || new Date();
      totalDowntime += end.getTime() - event.start.getTime();
    }

    return ((totalTime - totalDowntime) / totalTime) * 100;
  }
}

/**
 * MCP Traceability - Track which user used which MCP, tool, and context
 * PRO FEATURE
 */
export interface MCPTraceRecord {
  traceId: string;
  timestamp: Date;
  userId: string;
  userEmail?: string;
  sessionId: string;
  
  // MCP Server Information
  mcpServerName: string;
  mcpServerId: string;
  mcpServerVersion?: string;
  
  // Tool Information
  toolName: string;
  toolMethod?: string;
  toolParameters: Record<string, unknown>;
  
  // Context Information
  contextUsed: ContextSnapshot;
  
  // Execution Details
  executionTimeMs: number;
  status: "success" | "failure" | "blocked" | "timeout";
  errorMessage?: string;
  
  // Response Information
  responseSize?: number;
  responseType?: string;
  
  // Security & Compliance
  securityLevel: "public" | "internal" | "confidential" | "restricted";
  dataClassification?: "public" | "pii" | "phi" | "financial";
  complianceTags: string[];
  threatDetected: boolean;
  securityViolations: string[];
  
  // Resource Usage
  tokensUsed?: number;
  apiCallsCount?: number;
  dataTransferredBytes?: number;
  
  // Metadata
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface ContextSnapshot {
  // Files accessed
  filesAccessed: Array<{
    path: string;
    operation: "read" | "write" | "delete" | "list";
    size?: number;
  }>;
  
  // Environment variables accessed
  envVarsAccessed: string[];
  
  // External APIs called
  externalApisCalled: Array<{
    url: string;
    method: string;
    statusCode?: number;
  }>;
  
  // Database queries
  databaseQueries?: Array<{
    query: string;
    database: string;
    rowsAffected?: number;
  }>;
  
  // Memory/resources used
  memoryUsedMB?: number;
  cpuTimeMs?: number;
  
  // User prompt/input
  userPrompt?: string;
  userPromptHash?: string;
}

export interface TraceabilityQuery {
  userId?: string;
  userIds?: string[];
  mcpServerName?: string;
  toolName?: string;
  sessionId?: string;
  status?: string;
  threatDetected?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface UsageStatistics {
  totalTraces: number;
  uniqueUsers: number;
  uniqueMCPServers: number;
  uniqueTools: number;
  
  // By MCP Server
  byMCPServer: Record<string, {
    count: number;
    successRate: number;
    avgExecutionTimeMs: number;
    totalTokensUsed: number;
  }>;
  
  // By Tool
  byTool: Record<string, {
    count: number;
    successRate: number;
    avgExecutionTimeMs: number;
  }>;
  
  // By User
  byUser: Record<string, {
    count: number;
    mcpServersUsed: string[];
    toolsUsed: string[];
    totalExecutionTimeMs: number;
  }>;
  
  // Security
  securityEvents: {
    totalThreats: number;
    threatsBySeverity: Record<string, number>;
    blockedRequests: number;
  };
  
  // Time series
  timeline: Array<{
    timestamp: Date;
    count: number;
    successCount: number;
    failureCount: number;
  }>;
}

export class MCPTraceabilityManager {
  private licenseManager: LicenseManager;
  private traces: Map<string, MCPTraceRecord> = new Map();
  private readonly maxTraces = 100000; // Keep last 100k traces in memory
  private persistenceEnabled: boolean = true;

  constructor(licenseManager: LicenseManager, persistenceEnabled: boolean = true) {
    this.licenseManager = licenseManager;
    this.persistenceEnabled = persistenceEnabled;
  }

  /**
   * Record a new trace entry
   */
  public recordTrace(trace: Omit<MCPTraceRecord, "traceId" | "timestamp">): string | null {
    if (!this.licenseManager.hasFeature("traceability")) {
      console.warn(
        "Traceability requires a Pro license. Upgrade at https://contextguard.dev/pro"
      );
      return null;
    }

    const traceId = crypto.randomBytes(16).toString("hex");
    const fullTrace: MCPTraceRecord = {
      ...trace,
      traceId,
      timestamp: new Date(),
    };

    this.traces.set(traceId, fullTrace);

    // Cleanup old traces if limit exceeded
    if (this.traces.size > this.maxTraces) {
      const oldestKeys = Array.from(this.traces.keys()).slice(
        0,
        this.traces.size - this.maxTraces
      );
      for (const key of oldestKeys) {
        this.traces.delete(key);
      }
    }

    // Persist to storage if enabled
    if (this.persistenceEnabled) {
      this.persistTrace(fullTrace).catch((err) =>
        console.error("Failed to persist trace:", err)
      );
    }

    return traceId;
  }

  /**
   * Query traces with filters
   */
  public queryTraces(query: TraceabilityQuery): MCPTraceRecord[] {
    if (!this.licenseManager.hasFeature("traceability")) {
      return [];
    }

    let results = Array.from(this.traces.values());

    // Apply filters
    if (query.userId) {
      results = results.filter((t) => t.userId === query.userId);
    }
    if (query.userIds && query.userIds.length > 0) {
      results = results.filter((t) => query.userIds!.includes(t.userId));
    }
    if (query.mcpServerName) {
      results = results.filter((t) => t.mcpServerName === query.mcpServerName);
    }
    if (query.toolName) {
      results = results.filter((t) => t.toolName === query.toolName);
    }
    if (query.sessionId) {
      results = results.filter((t) => t.sessionId === query.sessionId);
    }
    if (query.status) {
      results = results.filter((t) => t.status === query.status);
    }
    if (query.threatDetected !== undefined) {
      results = results.filter((t) => t.threatDetected === query.threatDetected);
    }
    if (query.startDate) {
      results = results.filter((t) => t.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter((t) => t.timestamp <= query.endDate!);
    }

    // Sort
    const sortBy = query.sortBy || "timestamp";
    const sortOrder = query.sortOrder || "desc";
    results.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === "asc" ? comparison : -comparison;
    });

    // Pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get trace by ID
   */
  public getTrace(traceId: string): MCPTraceRecord | null {
    if (!this.licenseManager.hasFeature("traceability")) {
      return null;
    }
    return this.traces.get(traceId) || null;
  }

  /**
   * Get usage statistics
   */
  public getUsageStatistics(query?: TraceabilityQuery): UsageStatistics {
    if (!this.licenseManager.hasFeature("traceability")) {
      return this.getEmptyStatistics();
    }

    const traces = query ? this.queryTraces(query) : Array.from(this.traces.values());

    const uniqueUsers = new Set(traces.map((t) => t.userId));
    const uniqueMCPServers = new Set(traces.map((t) => t.mcpServerName));
    const uniqueTools = new Set(traces.map((t) => t.toolName));

    // By MCP Server
    const byMCPServer: UsageStatistics["byMCPServer"] = {};
    for (const trace of traces) {
      if (!byMCPServer[trace.mcpServerName]) {
        byMCPServer[trace.mcpServerName] = {
          count: 0,
          successRate: 0,
          avgExecutionTimeMs: 0,
          totalTokensUsed: 0,
        };
      }
      const stats = byMCPServer[trace.mcpServerName];
      stats.count++;
      stats.avgExecutionTimeMs += trace.executionTimeMs;
      stats.totalTokensUsed += trace.tokensUsed || 0;
      if (trace.status === "success") {
        stats.successRate++;
      }
    }

    // Calculate averages and percentages
    for (const serverName in byMCPServer) {
      const stats = byMCPServer[serverName];
      stats.avgExecutionTimeMs /= stats.count;
      stats.successRate = (stats.successRate / stats.count) * 100;
    }

    // By Tool
    const byTool: UsageStatistics["byTool"] = {};
    for (const trace of traces) {
      if (!byTool[trace.toolName]) {
        byTool[trace.toolName] = {
          count: 0,
          successRate: 0,
          avgExecutionTimeMs: 0,
        };
      }
      const stats = byTool[trace.toolName];
      stats.count++;
      stats.avgExecutionTimeMs += trace.executionTimeMs;
      if (trace.status === "success") {
        stats.successRate++;
      }
    }

    for (const toolName in byTool) {
      const stats = byTool[toolName];
      stats.avgExecutionTimeMs /= stats.count;
      stats.successRate = (stats.successRate / stats.count) * 100;
    }

    // By User
    const byUser: UsageStatistics["byUser"] = {};
    for (const trace of traces) {
      if (!byUser[trace.userId]) {
        byUser[trace.userId] = {
          count: 0,
          mcpServersUsed: [],
          toolsUsed: [],
          totalExecutionTimeMs: 0,
        };
      }
      const stats = byUser[trace.userId];
      stats.count++;
      stats.totalExecutionTimeMs += trace.executionTimeMs;
      if (!stats.mcpServersUsed.includes(trace.mcpServerName)) {
        stats.mcpServersUsed.push(trace.mcpServerName);
      }
      if (!stats.toolsUsed.includes(trace.toolName)) {
        stats.toolsUsed.push(trace.toolName);
      }
    }

    // Security events
    const securityEvents = {
      totalThreats: traces.filter((t) => t.threatDetected).length,
      threatsBySeverity: {} as Record<string, number>,
      blockedRequests: traces.filter((t) => t.status === "blocked").length,
    };

    // Timeline (hourly buckets)
    const timeline: UsageStatistics["timeline"] = [];
    const timelineBuckets: Record<string, { count: number; success: number; failure: number }> = {};
    
    for (const trace of traces) {
      const hour = new Date(trace.timestamp).toISOString().slice(0, 13);
      if (!timelineBuckets[hour]) {
        timelineBuckets[hour] = { count: 0, success: 0, failure: 0 };
      }
      timelineBuckets[hour].count++;
      if (trace.status === "success") {
        timelineBuckets[hour].success++;
      } else {
        timelineBuckets[hour].failure++;
      }
    }

    for (const [hour, data] of Object.entries(timelineBuckets)) {
      timeline.push({
        timestamp: new Date(hour),
        count: data.count,
        successCount: data.success,
        failureCount: data.failure,
      });
    }

    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      totalTraces: traces.length,
      uniqueUsers: uniqueUsers.size,
      uniqueMCPServers: uniqueMCPServers.size,
      uniqueTools: uniqueTools.size,
      byMCPServer,
      byTool,
      byUser,
      securityEvents,
      timeline,
    };
  }

  /**
   * Export traces for compliance/audit
   */
  public exportTraces(
    query: TraceabilityQuery,
    format: "JSON" | "CSV"
  ): string {
    if (!this.licenseManager.hasFeature("traceability")) {
      return "";
    }

    const traces = this.queryTraces(query);

    if (format === "JSON") {
      return JSON.stringify(traces, null, 2);
    } else {
      // CSV format
      const headers = [
        "traceId",
        "timestamp",
        "userId",
        "mcpServerName",
        "toolName",
        "status",
        "executionTimeMs",
        "threatDetected",
      ];
      const rows = traces.map((t) => [
        t.traceId,
        t.timestamp.toISOString(),
        t.userId,
        t.mcpServerName,
        t.toolName,
        t.status,
        t.executionTimeMs.toString(),
        t.threatDetected.toString(),
      ]);
      return [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");
    }
  }

  /**
   * Get user activity timeline
   */
  public getUserActivityTimeline(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Array<MCPTraceRecord> {
    return this.queryTraces({
      userId,
      startDate,
      endDate,
      sortBy: "timestamp",
      sortOrder: "asc",
    });
  }

  /**
   * Detect anomalous usage patterns
   */
  public detectAnomalies(userId?: string): Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    description: string;
    traces: MCPTraceRecord[];
  }> {
    if (!this.licenseManager.hasFeature("traceability")) {
      return [];
    }

    const anomalies: Array<{
      type: string;
      severity: "LOW" | "MEDIUM" | "HIGH";
      description: string;
      traces: MCPTraceRecord[];
    }> = [];

    const traces = userId
      ? this.queryTraces({ userId })
      : Array.from(this.traces.values());

    // Detect high failure rate
    const failureRate =
      traces.filter((t) => t.status === "failure").length / traces.length;
    if (failureRate > 0.3) {
      anomalies.push({
        type: "high_failure_rate",
        severity: "HIGH",
        description: `High failure rate detected: ${(failureRate * 100).toFixed(1)}%`,
        traces: traces.filter((t) => t.status === "failure"),
      });
    }

    // Detect unusual tool usage
    const toolCounts: Record<string, number> = {};
    for (const trace of traces) {
      toolCounts[trace.toolName] = (toolCounts[trace.toolName] || 0) + 1;
    }
    const avgToolUsage =
      Object.values(toolCounts).reduce((a, b) => a + b, 0) /
      Object.keys(toolCounts).length;
    for (const [tool, count] of Object.entries(toolCounts)) {
      if (count > avgToolUsage * 5) {
        anomalies.push({
          type: "unusual_tool_usage",
          severity: "MEDIUM",
          description: `Tool "${tool}" used ${count} times (${(count / avgToolUsage).toFixed(1)}x average)`,
          traces: traces.filter((t) => t.toolName === tool),
        });
      }
    }

    // Detect security threats
    const threatsDetected = traces.filter((t) => t.threatDetected);
    if (threatsDetected.length > 0) {
      anomalies.push({
        type: "security_threats",
        severity: "HIGH",
        description: `${threatsDetected.length} security threats detected`,
        traces: threatsDetected,
      });
    }

    return anomalies;
  }

  private async persistTrace(trace: MCPTraceRecord): Promise<void> {
    // In production, this would write to a database
    // For now, we'll append to a log file
    const logEntry = JSON.stringify(trace) + "\n";
    fs.appendFileSync("mcp_traces.log", logEntry);
  }

  private getEmptyStatistics(): UsageStatistics {
    return {
      totalTraces: 0,
      uniqueUsers: 0,
      uniqueMCPServers: 0,
      uniqueTools: 0,
      byMCPServer: {},
      byTool: {},
      byUser: {},
      securityEvents: {
        totalThreats: 0,
        threatsBySeverity: {},
        blockedRequests: 0,
      },
      timeline: [],
    };
  }
}

/**
 * Context Tracker - Track context usage and data flow
 * PRO FEATURE
 */
export class ContextTracker {
  private licenseManager: LicenseManager;
  private activeContexts: Map<string, ContextSnapshot> = new Map();

  constructor(licenseManager: LicenseManager) {
    this.licenseManager = licenseManager;
  }

  /**
   * Start tracking context for a session
   */
  public startTracking(sessionId: string): void {
    if (!this.licenseManager.hasFeature("traceability")) {
      return;
    }

    this.activeContexts.set(sessionId, {
      filesAccessed: [],
      envVarsAccessed: [],
      externalApisCalled: [],
      databaseQueries: [],
    });
  }

  /**
   * Record file access
   */
  public recordFileAccess(
    sessionId: string,
    path: string,
    operation: "read" | "write" | "delete" | "list",
    size?: number
  ): void {
    if (!this.licenseManager.hasFeature("traceability")) {
      return;
    }

    const context = this.activeContexts.get(sessionId);
    if (context) {
      context.filesAccessed.push({ path, operation, size });
    }
  }

  /**
   * Record environment variable access
   */
  public recordEnvVarAccess(sessionId: string, varName: string): void {
    if (!this.licenseManager.hasFeature("traceability")) {
      return;
    }

    const context = this.activeContexts.get(sessionId);
    if (context && !context.envVarsAccessed.includes(varName)) {
      context.envVarsAccessed.push(varName);
    }
  }

  /**
   * Record external API call
   */
  public recordApiCall(
    sessionId: string,
    url: string,
    method: string,
    statusCode?: number
  ): void {
    if (!this.licenseManager.hasFeature("traceability")) {
      return;
    }

    const context = this.activeContexts.get(sessionId);
    if (context) {
      context.externalApisCalled.push({ url, method, statusCode });
    }
  }

  /**
   * Record database query
   */
  public recordDatabaseQuery(
    sessionId: string,
    query: string,
    database: string,
    rowsAffected?: number
  ): void {
    if (!this.licenseManager.hasFeature("traceability")) {
      return;
    }

    const context = this.activeContexts.get(sessionId);
    if (context) {
      if (!context.databaseQueries) {
        context.databaseQueries = [];
      }
      context.databaseQueries.push({ query, database, rowsAffected });
    }
  }

  /**
   * Get context snapshot
   */
  public getContextSnapshot(sessionId: string): ContextSnapshot | null {
    if (!this.licenseManager.hasFeature("traceability")) {
      return null;
    }

    return this.activeContexts.get(sessionId) || null;
  }

  /**
   * Stop tracking and return final snapshot
   */
  public stopTracking(sessionId: string): ContextSnapshot | null {
    if (!this.licenseManager.hasFeature("traceability")) {
      return null;
    }

    const context = this.activeContexts.get(sessionId);
    this.activeContexts.delete(sessionId);
    return context || null;
  }

  /**
   * Analyze context for security risks
   */
  public analyzeContextSecurity(context: ContextSnapshot): Array<{
    risk: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    details: string;
  }> {
    if (!this.licenseManager.hasFeature("traceability")) {
      return [];
    }

    const risks: Array<{
      risk: string;
      severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      details: string;
    }> = [];

    // Check for sensitive file access
    const sensitiveFiles = context.filesAccessed.filter(
      (f) =>
        f.path.includes(".env") ||
        f.path.includes("secret") ||
        f.path.includes("password") ||
        f.path.includes(".ssh") ||
        f.path.includes("credentials")
    );
    if (sensitiveFiles.length > 0) {
      risks.push({
        risk: "sensitive_file_access",
        severity: "HIGH",
        details: `Accessed ${sensitiveFiles.length} sensitive files`,
      });
    }

    // Check for excessive file writes
    const writeOperations = context.filesAccessed.filter(
      (f) => f.operation === "write" || f.operation === "delete"
    );
    if (writeOperations.length > 50) {
      risks.push({
        risk: "excessive_file_writes",
        severity: "MEDIUM",
        details: `Performed ${writeOperations.length} write/delete operations`,
      });
    }

    // Check for external API calls to unknown domains
    const externalCalls = context.externalApisCalled.filter(
      (api) => !api.url.includes("localhost") && !api.url.includes("127.0.0.1")
    );
    if (externalCalls.length > 0) {
      risks.push({
        risk: "external_api_calls",
        severity: "MEDIUM",
        details: `Made ${externalCalls.length} external API calls`,
      });
    }

    // Check for sensitive environment variables
    const sensitiveEnvVars = context.envVarsAccessed.filter(
      (v) =>
        v.includes("KEY") ||
        v.includes("SECRET") ||
        v.includes("TOKEN") ||
        v.includes("PASSWORD")
    );
    if (sensitiveEnvVars.length > 0) {
      risks.push({
        risk: "sensitive_env_access",
        severity: "HIGH",
        details: `Accessed ${sensitiveEnvVars.length} sensitive environment variables`,
      });
    }

    return risks;
  }
}
