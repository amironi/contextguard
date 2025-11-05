#!/usr/bin/env node

/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @deprecated This file is maintained for backward compatibility.
 * Please use the new modular structure from './index' instead.
 *
 * The code has been refactored into separate modules for better maintainability:
 * - types.ts: Type definitions
 * - config.ts: Configuration management
 * - security-policy.ts: Security policy enforcement
 * - security-logger.ts: Event logging
 * - wrapper.ts: Main MCP wrapper with pro features integration
 * - cli.ts: Command-line interface
 * - index.ts: Public API exports
 */

// Re-export everything from the new modular structure
export { CgPolicy } from "./cg-policy";
export { SecurityLogger } from "./security-logger";
export { MCPSecurityWrapper } from "./wrapper";
export * from "./types";

// Import CLI for backward compatibility
import { main } from "./cli";

// Run CLI if this is the main module
if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
