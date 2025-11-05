#!/usr/bin/env node

/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as fs from "fs";
import { CgPolicyType } from "./types";
import { createAgent } from "./agent";
import { SupabaseConfig } from "./supabase-client";

/**
 * Display help message
 */
function showHelp(): void {
  console.log(`
MCP Security Wrapper - ContextGuard

Usage:
  contextguard --server "node server.js" [options]

Options:
  --server <command>    Command to start the MCP server (required)
  --config <file>       Path to security config JSON file (optional)
  --help               Show this help message

Example:
  contextguard --server "npx -y @modelcontextprotocol/server-filesystem /"

Configuration File Format (JSON):
  {
    "maxToolCallsPerMinute": 30,
    "enablePromptInjectionDetection": true,
    "enableSensitiveDataDetection": true,
    "logPath": "mcp_security.log",
    "enableProFeatures": true,
    "licenseFilePath": ".contextguard-license"
  }

For more information, visit: https://contextguard.dev
  `);
}

/**
 * Parse command line arguments
 * @returns Parsed arguments
 */
function parseArgs(): { serverCommand: string; configFile: string } {
  const args = process.argv.slice(2);
  let serverCommand = "";
  let configFile = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--server" && args[i + 1]) {
      serverCommand = args[i + 1];
      i++;
    } else if (args[i] === "--config" && args[i + 1]) {
      configFile = args[i + 1];
      i++;
    }
  }

  return { serverCommand, configFile };
}

/**
 * Load configuration from file
 * @param configFile - Path to config file
 * @returns Security configuration
 */
function loadConfig(configFile: string): CgPolicyType {
  if (!configFile) {
    return {};
  }

  if (!fs.existsSync(configFile)) {
    console.error(`Error: Config file not found: ${configFile}`);
    process.exit(1);
  }

  try {
    const config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
    // validateConfig(config);
    return config;
  } catch (error) {
    console.error(`Error: Failed to load config file: ${error}`);
    process.exit(1);
  }
}

/**
 * Main CLI entry point
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Show help if requested or no args
  if (args.length === 0 || args.includes("--help")) {
    showHelp();
    process.exit(0);
  }

  // Parse arguments
  const { serverCommand, configFile } = parseArgs();

  if (!serverCommand) {
    console.error("Error: --server argument is required");
    console.error("Run 'contextguard --help' for usage information");
    process.exit(1);
  }

  // Load configuration
  const config = loadConfig(configFile);

  // Load Supabase configuration from environment
  const supabaseConfig: SupabaseConfig | undefined =
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
      ? {
          url: process.env.SUPABASE_URL,
          serviceKey: process.env.SUPABASE_SERVICE_KEY,
          agentId: process.env.AGENT_ID || "default-agent",
        }
      : undefined;

  if (supabaseConfig) {
    console.log(`✓ Supabase integration enabled (Agent ID: ${supabaseConfig.agentId})`);
  }

  // Create and start agent
  const agent = createAgent(serverCommand.split(" "), config, supabaseConfig);

  await agent.start();
}

// Run CLI if this is the main module
if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
