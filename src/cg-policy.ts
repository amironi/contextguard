/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CgPolicyType } from "./types";

/**
 * Security policy enforcement engine
 * Handles detection of security violations including:
 * - Prompt injection attempts
 * - Sensitive data exposure
 * - Unsafe file access patterns
 * - Rate limiting
 */
export class CgPolicy {
  private config: Required<CgPolicyType>;
  private sensitiveDataPatterns: RegExp[];
  private promptInjectionPatterns: RegExp[];

  constructor(config: Required<CgPolicyType>) {
    this.config = config;
    this.sensitiveDataPatterns = this.initSensitiveDataPatterns();
    this.promptInjectionPatterns = this.initPromptInjectionPatterns();
  }

  /**
   * Initialize patterns for detecting sensitive data
   * @returns Array of regex patterns
   */
  private initSensitiveDataPatterns(): RegExp[] {
    return [
      // Generic secrets
      /(?:password|secret|api[_-]?key|token)\s*[:=]\s*['"]?[\w\-.]+['"]?/gi,

      // Email addresses
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

      // Social Security Numbers
      /\b\d{3}-\d{2}-\d{4}\b/g,

      // OpenAI API keys
      /sk-[a-zA-Z0-9]{20,}/g,

      // GitHub tokens
      /ghp_[a-zA-Z0-9]{36}/g,

      // AWS Access Keys
      /AKIA[0-9A-Z]{16}/g,

      // Stripe API keys
      /sk_(live|test)_[a-zA-Z0-9]{24,}/g,
    ];
  }

  /**
   * Initialize patterns for detecting prompt injection
   * @returns Array of regex patterns
   */
  private initPromptInjectionPatterns(): RegExp[] {
    return [
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

  /**
   * Check text for prompt injection attempts
   * @param text - Text to analyze
   * @returns Array of violation descriptions
   */
  public checkPromptInjection(text: string): string[] {
    if (!this.config.enablePromptInjectionDetection) {
      return [];
    }

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

  /**
   * Check text for sensitive data exposure
   * @param text - Text to analyze
   * @returns Array of violation descriptions
   */
  public checkSensitiveData(text: string): string[] {
    if (!this.config.enableSensitiveDataDetection) {
      return [];
    }

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

  /**
   * Check file path for security violations
   * @param filePath - File path to check
   * @returns Array of violation descriptions
   */
  public checkFileAccess(filePath: string): string[] {
    const violations: string[] = [];

    // Check for path traversal
    if (filePath.includes("..")) {
      violations.push(`Path traversal attempt detected: ${filePath}`);
    }

    // Check for dangerous system paths
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

    // Check against allowed paths whitelist
    if (this.config.allowedFilePaths.length > 0) {
      const isAllowed = this.config.allowedFilePaths.some((allowed) =>
        filePath.startsWith(allowed)
      );

      if (!isAllowed) {
        violations.push(`File path not in allowed list: ${filePath}`);
      }
    }

    return violations;
  }

  /**
   * Check if rate limit is exceeded
   * @param timestamps - Array of recent call timestamps
   * @returns True if within rate limit, false if exceeded
   */
  public checkRateLimit(timestamps: number[]): boolean {
    const oneMinuteAgo = Date.now() - 60000;
    const recentCalls = timestamps.filter((t) => t > oneMinuteAgo);
    return recentCalls.length < this.config.maxToolCallsPerMinute;
  }
}

export const DEFAULT_POLICY: Required<CgPolicyType> = {
  maxToolCallsPerMinute: 30,
  blockedPatterns: [],
  allowedFilePaths: [],
  alertThreshold: 5,
  enablePromptInjectionDetection: true,
  enableSensitiveDataDetection: true,
  logPath: "mcp_security.log",
  enableProFeatures: false,
  licenseFilePath: ".contextguard-license",
};
