/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AgentPolicy } from "./types/types";

/**
 * Initialize patterns for detecting sensitive data
 */
const initSensitiveDataPatterns = (): RegExp[] => [
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

/**
 * Initialize patterns for detecting prompt injection
 */
const initPromptInjectionPatterns = (): RegExp[] => [
  /ignore\s+(previous|all)\s+(instructions|prompts)/gi,
  /system:\s*you\s+are\s+now/gi,
  /forget\s+(everything|all)/gi,
  /new\s+instructions:/gi,
  /\[INST\].*?\[\/INST\]/gs,
  /<\|im_start\|>/g,
  /disregard\s+previous/gi,
  /override\s+previous/gi,
];

/**
 * Policy checker interface
 */
export interface PolicyChecker {
  checkPromptInjection: (text: string) => string[];
  checkSensitiveData: (text: string) => string[];
  checkFileAccess: (filePath: string) => string[];
  checkRateLimit: (timestamps: number[]) => boolean;
}

/**
 * Create a policy checker with the given configuration
 * @param config - Policy configuration
 * @returns Policy checker functions
 */
export const createPolicyChecker = (
  config: Required<AgentPolicy>
): PolicyChecker => {
  const sensitiveDataPatterns = initSensitiveDataPatterns();
  const promptInjectionPatterns = initPromptInjectionPatterns();

  return {
    /**
     * Check text for prompt injection attempts
     */
    checkPromptInjection: (text: string): string[] => {
      if (!config.enablePromptInjectionDetection) {
        return [];
      }

      const violations: string[] = [];

      for (const pattern of promptInjectionPatterns) {
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
    },

    /**
     * Check text for sensitive data exposure
     */
    checkSensitiveData: (text: string): string[] => {
      if (!config.enableSensitiveDataDetection) {
        return [];
      }

      const violations: string[] = [];

      for (const pattern of sensitiveDataPatterns) {
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
    },

    /**
     * Check file path for security violations
     */
    checkFileAccess: (filePath: string): string[] => {
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
      if (config.allowedFilePaths.length > 0) {
        const isAllowed = config.allowedFilePaths.some((allowed) =>
          filePath.startsWith(allowed)
        );

        if (!isAllowed) {
          violations.push(`File path not in allowed list: ${filePath}`);
        }
      }

      return violations;
    },

    /**
     * Check if rate limit is exceeded
     */
    checkRateLimit: (timestamps: number[]): boolean => {
      const oneMinuteAgo = Date.now() - 60000;
      const recentCalls = timestamps.filter((t) => t > oneMinuteAgo);
      return recentCalls.length < config.maxToolCallsPerMinute;
    },
  };
};

export const DEFAULT_POLICY: Required<AgentPolicy> = {
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
