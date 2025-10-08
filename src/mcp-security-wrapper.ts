#!/usr/bin/env node

/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import { createHash } from "crypto";

interface SecurityConfig {
  maxToolCallsPerMinute?: number;
  blockedPatterns?: string[];
  allowedFilePaths?: string[];
  alertThreshold?: number;
  enablePromptInjectionDetection?: boolean;
  enableSensitiveDataDetection?: boolean;
  logPath?: string;
}

interface SecurityEvent {
  timestamp: string;
  eventType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: Record<string, unknown>;
  sessionId: string;
}

interface MCPMessage {
  jsonrpc: string;
  id?: string | number;
  method?: string;
  params?: {
    name?: string;
    arguments?: Record<string, string>;
    path?: string;
    filePath?: string;
    [key: string]: unknown;
  };
  result?: unknown;
  error?: unknown;
}

class SecurityPolicy {
  private config: SecurityConfig;
  private sensitiveDataPatterns: RegExp[];
  private promptInjectionPatterns: RegExp[];

  constructor(config: SecurityConfig) {
    this.config = {
      maxToolCallsPerMinute: 30,
      blockedPatterns: [],
      allowedFilePaths: [],
      alertThreshold: 5,
      enablePromptInjectionDetection: true,
      enableSensitiveDataDetection: true,
      ...config,
    };

    // Sensitive data patterns
    this.sensitiveDataPatterns = [
      /(?:password|secret|api[_-]?key|token)\s*[:=]\s*['"]?[\w\-.]+['"]?/gi,
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /sk-[a-zA-Z0-9]{20,}/g, // OpenAI API keys (20+ chars)
      /ghp_[a-zA-Z0-9]{36}/g, // GitHub tokens
      /AKIA[0-9A-Z]{16}/g, // AWS Access Keys
      /sk_(live|test)_[a-zA-Z0-9]{24,}/g, // Stripe API keys
    ];

    // Prompt injection patterns
    this.promptInjectionPatterns = [
      /ignore\s+(previous|all)\s+(instructions|prompts)/gi,
      /system:\s*you\s+are\s+now/gi,
      /forget\s+(everything|all)/gi,
      /new\s+instructions:/gi,
      /\[INST\].*?\[\/INST\]/gs,
      /<\|im_start\|>/g,
      /disregard\s+previous/gi,
      /override\s+previous/gi,
    ];
  }

  checkPromptInjection(text: string): string[] {
    if (!this.config.enablePromptInjectionDetection) return [];
    const violations: string[] = [];
    for (const pattern of this.promptInjectionPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        violations.push(
          `Potential prompt injection detected: "${matches[0].substring(
            0,
            50
          )}..."`
        );
      }
    }
    return violations;
  }

  checkSensitiveData(text: string): string[] {
    if (!this.config.enableSensitiveDataDetection) return [];
    const violations: string[] = [];
    for (const pattern of this.sensitiveDataPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        violations.push(
          `Sensitive data pattern detected (redacted): ${pattern.source.substring(
            0,
            30
          )}...`
        );
      }
    }
    return violations;
  }

  checkFileAccess(filePath: string): string[] {
    const violations: string[] = [];
    if (filePath.includes("..")) {
      violations.push(`Path traversal attempt detected: ${filePath}`);
    }
    const dangerousPaths = [
      "/etc",
      "/root",
      "/sys",
      "/proc",
      "C:\\Windows\\System32",
    ];
    if (dangerousPaths.some((dangerous) => filePath.startsWith(dangerous))) {
      violations.push(`Access to dangerous path detected: ${filePath}`);
    }
    if (
      this.config.allowedFilePaths &&
      this.config.allowedFilePaths.length > 0
    ) {
      const isAllowed = this.config.allowedFilePaths.some((allowed) =>
        filePath.startsWith(allowed)
      );
      if (!isAllowed) {
        violations.push(`File path not in allowed list: ${filePath}`);
      }
    }
    return violations;
  }

  checkRateLimit(timestamps: number[]): boolean {
    const oneMinuteAgo = Date.now() - 60000;
    const recentCalls = timestamps.filter((t) => t > oneMinuteAgo);
    return recentCalls.length < (this.config.maxToolCallsPerMinute || 30);
  }
}

class SecurityLogger {
  private logFile: string;
  private events: SecurityEvent[] = [];

  constructor(logFile: string = "mcp_security.log") {
    this.logFile = logFile;
  }

  logEvent(
    eventType: string,
    severity: SecurityEvent["severity"],
    details: Record<string, unknown>,
    sessionId: string
  ): void {
    const event: SecurityEvent = {
      timestamp: new Date().toISOString(),
      eventType,
      severity,
      details,
      sessionId,
    };
    this.events.push(event);
    fs.appendFileSync(this.logFile, JSON.stringify(event) + "\n");
    if (severity === "HIGH" || severity === "CRITICAL") {
      console.error(
        `[SECURITY ALERT] ${eventType}: ${JSON.stringify(details)}`
      );
    }
  }

  getStatistics(): Record<string, unknown> {
    return {
      totalEvents: this.events.length,
      eventsByType: this.countByField("eventType"),
      eventsBySeverity: this.countByField("severity"),
      recentEvents: this.events.slice(-10),
    };
  }

  private countByField(field: keyof SecurityEvent): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const event of this.events) {
      const value = String(event[field]);
      counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
  }
}

class MCPSecurityWrapper {
  private serverCommand: string[];
  private policy: SecurityPolicy;
  private logger: SecurityLogger;
  private process: ChildProcess | null = null;
  private toolCallTimestamps: number[] = [];
  private sessionId: string;
  private clientMessageBuffer: string = "";
  private serverMessageBuffer: string = "";

  constructor(
    serverCommand: string[],
    policy: SecurityPolicy,
    logger: SecurityLogger
  ) {
    this.serverCommand = serverCommand;
    this.policy = policy;
    this.logger = logger;
    this.sessionId = createHash("md5")
      .update(Date.now().toString())
      .digest("hex")
      .substring(0, 8);
  }

  async start(): Promise<void> {
    this.process = spawn(this.serverCommand[0], this.serverCommand.slice(1), {
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (!this.process.stdout || !this.process.stdin || !this.process.stderr) {
      throw new Error("Failed to create child process streams");
    }

    this.logger.logEvent(
      "SERVER_START",
      "LOW",
      {
        command: this.serverCommand.join(" "),
        pid: this.process.pid,
      },
      this.sessionId
    );

    this.process.stderr.pipe(process.stderr);

    this.process.stdout.on("data", (data: Buffer) => {
      const output = data.toString();
      this.handleServerOutput(output);
    });

    process.stdin.on("data", (data: Buffer) => {
      const input = data.toString();
      this.handleClientInput(input);
    });

    this.process.on("exit", (code) => {
      this.logger.logEvent(
        "SERVER_EXIT",
        "MEDIUM",
        {
          exitCode: code,
        },
        this.sessionId
      );
      console.error("\n=== MCP Security Statistics ===");
      console.error(JSON.stringify(this.logger.getStatistics(), null, 2));
      // Use setImmediate to allow pending I/O to complete
      setImmediate(() => {
        process.exit(code || 0);
      });
    });

    this.process.on("error", (err) => {
      this.logger.logEvent(
        "SERVER_ERROR",
        "HIGH",
        {
          error: err.message,
        },
        this.sessionId
      );
      console.error("Server process error:", err);
    });
  }

  private handleClientInput(input: string): void {
    this.clientMessageBuffer += input;
    const lines = this.clientMessageBuffer.split("\n");
    this.clientMessageBuffer = lines.pop() || "";
    for (const line of lines) {
      if (line.trim()) {
        this.processClientMessage(line);
      }
    }
  }

  private processClientMessage(line: string): void {
    try {
      const message: MCPMessage = JSON.parse(line);
      this.logger.logEvent(
        "CLIENT_REQUEST",
        "LOW",
        {
          method: message.method,
          id: message.id,
        },
        this.sessionId
      );

      const violations: string[] = [];
      let shouldBlock = false;

      if (message.method === "tools/call") {
        const now = Date.now();
        this.toolCallTimestamps.push(now);

        // Clean up old timestamps to prevent memory leak
        const oneMinuteAgo = now - 60000;
        this.toolCallTimestamps = this.toolCallTimestamps.filter(
          (t) => t > oneMinuteAgo
        );

        if (!this.policy.checkRateLimit(this.toolCallTimestamps)) {
          violations.push("Rate limit exceeded for tool calls");
          shouldBlock = true;
          this.logger.logEvent(
            "RATE_LIMIT_EXCEEDED",
            "HIGH",
            {
              method: message.method,
              toolName: message.params?.name,
            },
            this.sessionId
          );
        }

        const paramsStr = JSON.stringify(message.params);
        const injectionViolations = this.policy.checkPromptInjection(paramsStr);
        violations.push(...injectionViolations);
        const sensitiveViolations = this.policy.checkSensitiveData(paramsStr);
        violations.push(...sensitiveViolations);

        // Check multiple possible file path parameter locations
        const filePathParams = [
          message.params?.arguments?.path,
          message.params?.arguments?.filePath,
          message.params?.arguments?.file,
          message.params?.arguments?.directory,
          message.params?.path,
          message.params?.filePath,
        ].filter((path): path is string => typeof path === "string");

        for (const filePath of filePathParams) {
          const fileViolations = this.policy.checkFileAccess(filePath);
          violations.push(...fileViolations);
        }

        this.logger.logEvent(
          "TOOL_CALL",
          violations.length > 0 ? "HIGH" : "LOW",
          {
            toolName: message.params?.name,
            hasViolations: violations.length > 0,
            violations,
          },
          this.sessionId
        );
      }

      if (violations.length > 0) {
        this.logger.logEvent(
          "SECURITY_VIOLATION",
          "CRITICAL",
          {
            violations,
            message: message,
            blocked: shouldBlock,
          },
          this.sessionId
        );
        console.error(
          `\n⚠️  SECURITY VIOLATIONS DETECTED:\n${violations.join("\n")}\n`
        );

        if (shouldBlock) {
          console.error("🚫 REQUEST BLOCKED\n");
          // Send error response back to client
          if (message.id !== undefined) {
            const errorResponse: MCPMessage = {
              jsonrpc: message.jsonrpc,
              id: message.id,
              error: {
                code: -32000,
                message: "Security violation: Request blocked",
                data: { violations },
              },
            };
            process.stdout.write(JSON.stringify(errorResponse) + "\n");
          }
          return; // Don't forward to server
        }
      }

      if (this.process && this.process.stdin) {
        this.process.stdin.write(line + "\n");
      }
    } catch (err) {
      this.logger.logEvent(
        "PARSE_ERROR",
        "MEDIUM",
        {
          error: err instanceof Error ? err.message : String(err),
          line: line.substring(0, 100),
        },
        this.sessionId
      );
      console.error(`Failed to parse client message: ${err}`);
      // Forward unparseable messages
      if (this.process && this.process.stdin) {
        this.process.stdin.write(line + "\n");
      }
    }
  }

  private handleServerOutput(output: string): void {
    // Buffer and parse for security scanning
    this.serverMessageBuffer += output;
    const lines = this.serverMessageBuffer.split("\n");
    this.serverMessageBuffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        let shouldForward = true;
        try {
          const message: MCPMessage = JSON.parse(line);
          
          // Check for sensitive data in response
          const violations: string[] = [];
          const responseStr = JSON.stringify(message.result || message);
          const sensitiveViolations = this.policy.checkSensitiveData(responseStr);
          violations.push(...sensitiveViolations);

          if (violations.length > 0) {
            this.logger.logEvent(
              "SENSITIVE_DATA_LEAK",
              "CRITICAL",
              {
                violations,
                responseId: message.id,
              },
              this.sessionId
            );
            console.error(
              `\n🚨 SENSITIVE DATA DETECTED IN RESPONSE:\n${violations.join("\n")}\n`
            );
            console.error("🚫 RESPONSE BLOCKED\n");
            
            // Send sanitized error response instead
            if (message.id !== undefined) {
              const errorResponse: MCPMessage = {
                jsonrpc: message.jsonrpc,
                id: message.id,
                error: {
                  code: -32001,
                  message: "Security violation: Response contains sensitive data",
                  data: { violations },
                },
              };
              process.stdout.write(JSON.stringify(errorResponse) + "\n");
            }
            shouldForward = false;
          } else {
            this.logger.logEvent(
              "SERVER_RESPONSE",
              "LOW",
              {
                id: message.id,
                hasError: !!message.error,
              },
              this.sessionId
            );
          }
        } catch (err) {
          // Log parse errors for server output
          this.logger.logEvent(
            "SERVER_PARSE_ERROR",
            "LOW",
            {
              error: err instanceof Error ? err.message : String(err),
              line: line.substring(0, 100),
            },
            this.sessionId
          );
        }
        
        // Forward the line if not blocked
        if (shouldForward) {
          process.stdout.write(line + "\n");
        }
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    console.log(`
MCP Security Wrapper - MVP

Usage:
  contextguard --server "node server.js" --config config.json

Options:
  --server <command>    Command to start the MCP server (required)
  --config <file>       Path to security config JSON file (optional)
  --help               Show this help message

    `);
    process.exit(0);
  }

  let serverCommand: string = "";
  let configFile: string = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--server" && args[i + 1]) {
      serverCommand = args[i + 1];
      i++;
    } else if (args[i] === "--config" && args[i + 1]) {
      configFile = args[i + 1];
      i++;
    }
  }

  if (!serverCommand) {
    console.error("Error: --server argument is required");
    process.exit(1);
  }

  let config: SecurityConfig = {};
  if (configFile && fs.existsSync(configFile)) {
    config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
  }

  const policy = new SecurityPolicy(config);
  const logger = new SecurityLogger(config.logPath);
  const wrapper = new MCPSecurityWrapper(
    serverCommand.split(" "),
    policy,
    logger
  );

  // console.log("ContextGuard is running");

  await wrapper.start();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}

export { MCPSecurityWrapper, SecurityPolicy, SecurityLogger };
