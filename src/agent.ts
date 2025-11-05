/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn, ChildProcess } from "child_process";
import { createHash } from "crypto";
import { createPolicyChecker, DEFAULT_POLICY } from "./policy";
import { createLogger, Logger } from "./logger";
import { AgentPolicy, MCPMessage } from "./types/types";
import { createSupabaseClient, SupabaseConfig } from "./lib/supabase-client";

/**
 * Generate a unique session ID
 */
const generateSessionId = (): string =>
  createHash("md5").update(Date.now().toString()).digest("hex").substring(0, 8);

/**
 * Merge policy with defaults
 */
const mergePolicyWithDefaults = (
  policy: AgentPolicy
): Required<AgentPolicy> => ({
  ...DEFAULT_POLICY,
  ...policy,
});

/**
 * Agent interface
 */
export interface Agent {
  start: () => Promise<void>;
  getLogger: () => Logger;
}

/**
 * Agent state
 */
interface AgentState {
  process: ChildProcess | null;
  toolCallTimestamps: number[];
  clientMessageBuffer: string;
  serverMessageBuffer: string;
}

/**
 * Create an MCP security agent
 * @param serverCommand - Command to start MCP server
 * @param policyConfig - Policy configuration
 * @param supabaseConfig - Optional Supabase configuration
 * @returns Agent functions
 */
export const createAgent = (
  serverCommand: string[],
  policyConfig: AgentPolicy = {},
  supabaseConfig?: SupabaseConfig
): Agent => {
  const config = mergePolicyWithDefaults(policyConfig);
  const policy = createPolicyChecker(config);

  // Create Supabase client if config provided
  const supabaseClient = supabaseConfig
    ? createSupabaseClient(supabaseConfig)
    : undefined;

  const logger = createLogger(config.logPath, supabaseClient);
  const sessionId = generateSessionId();

  const state: AgentState = {
    process: null,
    toolCallTimestamps: [],
    clientMessageBuffer: "",
    serverMessageBuffer: "",
  };

  /**
   * Extract file paths from message parameters
   */
  const extractFilePaths = (message: MCPMessage): string[] =>
    [
      message.params?.arguments?.path,
      message.params?.arguments?.filePath,
      message.params?.arguments?.file,
      message.params?.arguments?.directory,
      message.params?.path,
      message.params?.filePath,
    ].filter((path): path is string => typeof path === "string");

  /**
   * Handle tool call with security checks
   */
  const handleToolCall = (
    message: MCPMessage
  ): { violations: string[]; shouldBlock: boolean } => {
    const violations: string[] = [];
    let shouldBlock = false;

    // Rate limiting
    const now = Date.now();
    state.toolCallTimestamps.push(now);

    // Clean up old timestamps
    const oneMinuteAgo = now - 60000;
    state.toolCallTimestamps = state.toolCallTimestamps.filter(
      (t) => t > oneMinuteAgo
    );

    if (!policy.checkRateLimit(state.toolCallTimestamps)) {
      violations.push("Rate limit exceeded for tool calls");
      shouldBlock = true;

      logger.logEvent(
        "RATE_LIMIT_EXCEEDED",
        "HIGH",
        {
          method: message.method,
          toolName: message.params?.name,
        },
        sessionId
      );
    }

    // Check parameters for security issues
    const paramsStr = JSON.stringify(message.params);
    violations.push(...policy.checkPromptInjection(paramsStr));
    violations.push(...policy.checkSensitiveData(paramsStr));

    // Check file paths
    const filePathParams = extractFilePaths(message);
    for (const filePath of filePathParams) {
      violations.push(...policy.checkFileAccess(filePath));
    }

    // Log tool call
    logger.logEvent(
      "TOOL_CALL",
      violations.length > 0 ? "HIGH" : "LOW",
      {
        toolName: message.params?.name,
        hasViolations: violations.length > 0,
        violations,
      },
      sessionId
    );

    return { violations, shouldBlock };
  };

  /**
   * Handle security violations
   */
  const handleViolations = (
    message: MCPMessage,
    violations: string[],
    shouldBlock: boolean
  ): void => {
    logger.logEvent(
      "SECURITY_VIOLATION",
      "CRITICAL",
      {
        violations,
        message,
        blocked: shouldBlock,
      },
      sessionId
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
  };

  /**
   * Handle parse errors
   */
  const handleParseError = (err: unknown, line: string): void => {
    logger.logEvent(
      "PARSE_ERROR",
      "MEDIUM",
      {
        error: err instanceof Error ? err.message : String(err),
        line: line.substring(0, 100),
      },
      sessionId
    );
    console.error(`Failed to parse client message: ${err}`);
  };

  /**
   * Handle sensitive data leak in server response
   */
  const handleSensitiveDataLeak = (
    message: MCPMessage,
    violations: string[]
  ): void => {
    logger.logEvent(
      "SENSITIVE_DATA_LEAK",
      "CRITICAL",
      {
        violations,
        responseId: message.id,
      },
      sessionId
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
  };

  /**
   * Process a single client message
   */
  const processClientMessage = (line: string): void => {
    try {
      const message: MCPMessage = JSON.parse(line);

      logger.logEvent(
        "CLIENT_REQUEST",
        "LOW",
        {
          method: message.method,
          id: message.id,
        },
        sessionId
      );

      const violations: string[] = [];
      let shouldBlock = false;

      // Handle tool calls with security checks
      if (message.method === "tools/call") {
        const result = handleToolCall(message);
        violations.push(...result.violations);
        shouldBlock = result.shouldBlock;
      }

      // Handle violations
      if (violations.length > 0) {
        handleViolations(message, violations, shouldBlock);
        if (shouldBlock) {
          return; // Don't forward blocked requests
        }
      }

      // Forward to server
      if (state.process?.stdin) {
        state.process.stdin.write(line + "\n");
      }
    } catch (err) {
      handleParseError(err, line);

      // Forward unparseable messages
      if (state.process?.stdin) {
        state.process.stdin.write(line + "\n");
      }
    }
  };

  /**
   * Handle client input (buffered line-by-line)
   */
  const handleClientInput = (input: string): void => {
    state.clientMessageBuffer += input;
    const lines = state.clientMessageBuffer.split("\n");
    state.clientMessageBuffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        processClientMessage(line);
      }
    }
  };

  /**
   * Process a single server message
   */
  const processServerMessage = (line: string): void => {
    let shouldForward = true;

    try {
      const message: MCPMessage = JSON.parse(line);

      // Check for sensitive data in response
      const violations: string[] = [];
      const responseStr = JSON.stringify(message.result || message);
      violations.push(...policy.checkSensitiveData(responseStr));

      if (violations.length > 0) {
        handleSensitiveDataLeak(message, violations);
        shouldForward = false;
      } else {
        logger.logEvent(
          "SERVER_RESPONSE",
          "LOW",
          {
            id: message.id,
            hasError: !!message.error,
          },
          sessionId
        );
      }
    } catch (err) {
      // Log parse errors for server output
      logger.logEvent(
        "SERVER_PARSE_ERROR",
        "LOW",
        {
          error: err instanceof Error ? err.message : String(err),
          line: line.substring(0, 100),
        },
        sessionId
      );
    }

    // Forward the line if not blocked
    if (shouldForward) {
      process.stdout.write(line + "\n");
    }
  };

  /**
   * Handle server output (buffered line-by-line)
   */
  const handleServerOutput = (output: string): void => {
    state.serverMessageBuffer += output;
    const lines = state.serverMessageBuffer.split("\n");
    state.serverMessageBuffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        processServerMessage(line);
      }
    }
  };

  /**
   * Handle process exit
   */
  const handleProcessExit = (code: number | null): void => {
    logger.logEvent("SERVER_EXIT", "MEDIUM", { exitCode: code }, sessionId);

    console.error("\n=== MCP Security Statistics ===");
    console.error(JSON.stringify(logger.getStatistics(), null, 2));

    // Use setImmediate to allow pending I/O to complete
    setImmediate(() => {
      process.exit(code || 0);
    });
  };

  return {
    /**
     * Start the MCP server wrapper
     */
    start: async (): Promise<void> => {
      // Fetch policy from Supabase if configured
      if (supabaseClient && supabaseConfig?.agentId) {
        try {
          const remotePolicy = await supabaseClient.fetchPolicy(
            supabaseConfig.agentId
          );
          if (remotePolicy) {
            console.log("✓ Loaded policy from Supabase");
            // Merge remote policy with local config
            Object.assign(config, remotePolicy);
          }
        } catch (error) {
          console.warn("⚠ Failed to fetch policy from Supabase:", error);
        }

        // Update agent status to online
        await supabaseClient.updateAgentStatus(
          supabaseConfig.agentId,
          "online"
        );
      }

      state.process = spawn(serverCommand[0], serverCommand.slice(1), {
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (
        !state.process.stdout ||
        !state.process.stdin ||
        !state.process.stderr
      ) {
        throw new Error("Failed to create child process streams");
      }

      logger.logEvent(
        "SERVER_START",
        "LOW",
        {
          command: serverCommand.join(" "),
          pid: state.process.pid,
        },
        sessionId
      );

      // Pipe stderr to parent process
      state.process.stderr.pipe(process.stderr);

      // Handle server output
      state.process.stdout.on("data", (data: Buffer) => {
        handleServerOutput(data.toString());
      });

      // Handle client input
      process.stdin.on("data", (data: Buffer) => {
        handleClientInput(data.toString());
      });

      // Handle process exit
      state.process.on("exit", (code) => {
        handleProcessExit(code);
      });

      // Handle process errors
      state.process.on("error", (err) => {
        logger.logEvent(
          "SERVER_ERROR",
          "HIGH",
          { error: err.message },
          sessionId
        );
        console.error("Server process error:", err);
      });
    },

    /**
     * Get the security logger instance
     */
    getLogger: (): Logger => logger,
  };
};
