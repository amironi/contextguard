/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SecurityConfig } from "./types";

/**
 * Default security configuration values
 */
export const DEFAULT_CONFIG: Required<SecurityConfig> = {
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

/**
 * Merges user configuration with defaults
 * @param userConfig - User-provided configuration
 * @returns Merged configuration with defaults
 */
export function mergeConfig(userConfig: SecurityConfig = {}): Required<SecurityConfig> {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };
}

/**
 * Validates configuration values
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: SecurityConfig): void {
  if (config.maxToolCallsPerMinute !== undefined && config.maxToolCallsPerMinute < 1) {
    throw new Error("maxToolCallsPerMinute must be at least 1");
  }
  
  if (config.alertThreshold !== undefined && config.alertThreshold < 1) {
    throw new Error("alertThreshold must be at least 1");
  }
}
