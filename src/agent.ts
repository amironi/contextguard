/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn, ChildProcess } from "child_process";
import { createHash } from "crypto";
import { CgPolicy } from "./policy";
import { SecurityLogger } from "./logger";
// import {
//   LicenseManager,
//   MCPTraceabilityManager,
//   ContextTracker,
// } from "../../premium-features";
import { CgPolicyType, MCPMessage } from "./types";

/**
 * MCP Security Wrapper
 * Wraps MCP servers with security monitoring and optional pro features
 */
export class CgAgent {
  private serverCommand: string[];
  private policy: CgPolicy;
  private logger: SecurityLogger;
  private process: ChildProcess | null = null;
  private toolCallTimestamps: number[] = [];
  private sessionId: string;
  private clientMessageBuffer: string = "";
  private serverMessageBuffer: string = "";

  // Pro features (optional)
  // private licenseManager?: LicenseManager;
  // private traceabilityManager?: MCPTraceabilityManager;
  // private contextTracker?: ContextTracker;
  private proFeaturesEnabled: boolean = false;

  constructor(serverCommand: string[], policy: CgPolicyType = {}) {
    // const fullConfig = mergeConfig(config);

    this.serverCommand = serverCommand;
    this.policy = new CgPolicy(policy);
    this.logger = new SecurityLogger(policy.logPath);
    this.sessionId = this.generateSessionId();

    // Initialize pro features if enabled
    if (policy.enableProFeatures) {
      this.initializeProFeatures(policy.licenseFilePath);
    }
  }

  /**
   * Generate a unique session ID
   * @returns 8-character hex session ID
   */
  private generateSessionId(): string {
    return createHash("md5")
      .update(Date.now().toString())
      .digest("hex")
      .substring(0, 8);
  }

  /**
   * Initialize pro features if license is valid
   * @param licenseFilePath - Path to license file
   */
  private initializeProFeatures(licenseFilePath: string): void {
    try {
      this.licenseManager = new LicenseManager(licenseFilePath);

      if (this.licenseManager.validateLicense()) {
        this.proFeaturesEnabled = true;
        this.traceabilityManager = new MCPTraceabilityManager(
          this.licenseManager
        );
        this.contextTracker = new ContextTracker(this.licenseManager);

        console.log(
          `✓ Pro features enabled (${this.licenseManager.getTier()} tier)`
        );
      } else {
        console.warn("⚠ Invalid or expired license. Pro features disabled.");
      }
    } catch (error) {
      console.warn("⚠ Failed to initialize pro features:", error);
    }
  }

  /**
   * Start the MCP server wrapper
   */
  public async start(): Promise<void> {
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
        proFeaturesEnabled: this.proFeaturesEnabled,
      },
      this.sessionId
    );

    // Pipe stderr to parent process
    this.process.stderr.pipe(process.stderr);

    // Handle server output
    this.process.stdout.on("data", (data: Buffer) => {
      const output = data.toString();
      this.handleServerOutput(output);
    });

    // Handle client input
    process.stdin.on("data", (data: Buffer) => {
      const input = data.toString();
      this.handleClientInput(input);
    });

    // Handle process exit
    this.process.on("exit", (code) => {
      this.handleProcessExit(code);
    });

    // Handle process errors
    this.process.on("error", (err) => {
      this.logger.logEvent(
        "SERVER_ERROR",
        "HIGH",
        { error: err.message },
        this.sessionId
      );
      console.error("Server process error:", err);
    });
  }

  /**
   * Handle client input (buffered line-by-line)
   * @param input - Raw input from client
   */
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

  /**
   * Process a single client message
   * @param line - JSON-RPC message line
   */
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

      // Handle tool calls with security checks
      if (message.method === "tools/call") {
        const result = this.handleToolCall(message);
        violations.push(...result.violations);
        shouldBlock = result.shouldBlock;
      }

      // Handle violations
      if (violations.length > 0) {
        this.handleViolations(message, violations, shouldBlock);
        if (shouldBlock) {
          return; // Don't forward blocked requests
        }
      }

      // Forward to server
      if (this.process && this.process.stdin) {
        this.process.stdin.write(line + "\n");
      }
    } catch (err) {
      this.handleParseError(err, line);

      // Forward unparseable messages
      if (this.process && this.process.stdin) {
        this.process.stdin.write(line + "\n");
      }
    }
  }

  /**
   * Handle tool call with security checks and traceability
   * @param message - MCP message
   * @returns Violations and block status
   */
  private handleToolCall(message: MCPMessage): {
    violations: string[];
    shouldBlock: boolean;
  } {
    const violations: string[] = [];
    let shouldBlock = false;

    // Rate limiting
    const now = Date.now();
    this.toolCallTimestamps.push(now);

    // Clean up old timestamps
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

    // Check parameters for security issues
    const paramsStr = JSON.stringify(message.params);
    violations.push(...this.policy.checkPromptInjection(paramsStr));
    violations.push(...this.policy.checkSensitiveData(paramsStr));

    // Check file paths
    const filePathParams = this.extractFilePaths(message);
    for (const filePath of filePathParams) {
      violations.push(...this.policy.checkFileAccess(filePath));

      // Track file access in pro features
      if (this.contextTracker) {
        this.contextTracker.recordFileAccess(this.sessionId, filePath, "read");
      }
    }

    // Log tool call
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

    return { violations, shouldBlock };
  }

  /**
   * Extract file paths from message parameters
   * @param message - MCP message
   * @returns Array of file paths
   */
  private extractFilePaths(message: MCPMessage): string[] {
    return [
      message.params?.arguments?.path,
      message.params?.arguments?.filePath,
      message.params?.arguments?.file,
      message.params?.arguments?.directory,
      message.params?.path,
      message.params?.filePath,
    ].filter((path): path is string => typeof path === "string");
  }

  /**
   * Handle security violations
   * @param message - Original message
   * @param violations - List of violations
   * @param shouldBlock - Whether to block the request
   */
  private handleViolations(
    message: MCPMessage,
    violations: string[],
    shouldBlock: boolean
  ): void {
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

      // Send error response
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
    }
  }

  /**
   * Handle parse errors
   * @param err - Error object
   * @param line - Original line that failed to parse
   */
  private handleParseError(err: unknown, line: string): void {
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
  }

  /**
   * Handle server output (buffered line-by-line)
   * @param output - Raw output from server
   */
  private handleServerOutput(output: string): void {
    this.serverMessageBuffer += output;
    const lines = this.serverMessageBuffer.split("\n");
    this.serverMessageBuffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        this.processServerMessage(line);
      }
    }
  }

  /**
   * Process a single server message
   * @param line - JSON-RPC message line
   */
  private processServerMessage(line: string): void {
    let shouldForward = true;

    try {
      const message: MCPMessage = JSON.parse(line);

      // Check for sensitive data in response
      const violations: string[] = [];
      const responseStr = JSON.stringify(message.result || message);
      violations.push(...this.policy.checkSensitiveData(responseStr));

      if (violations.length > 0) {
        this.handleSensitiveDataLeak(message, violations);
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

  /**
   * Handle sensitive data leak in server response
   * @param message - Server message
   * @param violations - List of violations
   */
  private handleSensitiveDataLeak(
    message: MCPMessage,
    violations: string[]
  ): void {
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

    // Send sanitized error response
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
  }

  /**
   * Handle process exit
   * @param code - Exit code
   */
  private handleProcessExit(code: number | null): void {
    this.logger.logEvent(
      "SERVER_EXIT",
      "MEDIUM",
      { exitCode: code },
      this.sessionId
    );

    console.error("\n=== MCP Security Statistics ===");
    console.error(JSON.stringify(this.logger.getStatistics(), null, 2));

    // Use setImmediate to allow pending I/O to complete
    setImmediate(() => {
      process.exit(code || 0);
    });
  }

  /**
   * Get the security logger instance
   * @returns SecurityLogger instance
   */
  public getLogger(): SecurityLogger {
    return this.logger;
  }
}
