/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { execSync } from "child_process";

interface MCPRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, string>;
  };
}

interface MCPResponse {
  jsonrpc: string;
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

class TestMCPServer {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });
  }

  start(): void {
    console.error("Test MCP Server started");
    this.rl.on("line", (line) => {
      try {
        const request: MCPRequest = JSON.parse(line);
        this.handleRequest(request);
      } catch (err) {
        console.error("Error parsing request:", err);
      }
    });
    this.rl.on("close", () => {
      console.error("Test MCP Server stopped");
      process.exit(0);
    });
  }

  private handleRequest(request: MCPRequest): void {
    let response: MCPResponse;
    switch (request.method) {
      case "initialize":
        response = this.handleInitialize(request);
        break;
      case "tools/list":
        response = this.handleToolsList(request);
        break;
      case "tools/call":
        response = this.handleToolCall(request);
        break;
      default:
        response = {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`,
          },
        };
    }
    console.log(JSON.stringify(response));
  }

  private handleInitialize(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "test-mcp-server",
          version: "0.1.0",
        },
        capabilities: {
          tools: {},
        },
      },
    };
  }

  private handleToolsList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools: [
          {
            name: "read_file",
            description: "Read contents of a file",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the file to read",
                },
              },
              required: ["path"],
            },
          },
          {
            name: "write_file",
            description: "Write content to a file",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the file to write",
                },
                content: {
                  type: "string",
                  description: "Content to write to the file",
                },
              },
              required: ["path", "content"],
            },
          },
          {
            name: "list_directory",
            description: "List contents of a directory",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the directory to list",
                },
              },
              required: ["path"],
            },
          },
          {
            name: "execute_command",
            description:
              "Execute a shell command (DANGEROUS - for testing only)",
            inputSchema: {
              type: "object",
              properties: {
                command: {
                  type: "string",
                  description: "Command to execute",
                },
              },
              required: ["command"],
            },
          },
        ],
      },
    };
  }

  private handleToolCall(request: MCPRequest): MCPResponse {
    const { name, arguments: args } = request.params || {};
    try {
      let result: unknown;
      switch (name) {
        case "read_file":
          result = this.readFile(args?.path || "");
          break;
        case "write_file":
          result = this.writeFile(args?.path || "", args?.content || "");
          break;
        case "list_directory":
          result = this.listDirectory(args?.path || "");
          break;
        case "execute_command":
          result = this.executeCommand(args?.command || "");
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    } catch (err) {
      const error = err as Error;
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32000,
          message: error.message,
        },
      };
    }
  }

  private readFile(filePath: string): Record<string, unknown> {
    console.error(`Reading file: ${filePath}`);
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const content = fs.readFileSync(resolvedPath, "utf-8");
    return {
      path: resolvedPath,
      size: content.length,
      content: content.substring(0, 1000),
    };
  }

  private writeFile(
    filePath: string,
    content: string
  ): Record<string, unknown> {
    console.error(`Writing file: ${filePath}`);
    const resolvedPath = path.resolve(filePath);
    fs.writeFileSync(resolvedPath, content, "utf-8");
    return {
      path: resolvedPath,
      size: content.length,
      message: "File written successfully",
    };
  }

  private listDirectory(dirPath: string): Record<string, unknown> {
    console.error(`Listing directory: ${dirPath}`);
    const resolvedPath = path.resolve(dirPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }
    const files = fs.readdirSync(resolvedPath);
    const fileList = files.map((file) => {
      const filePath = path.join(resolvedPath, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        type: stats.isDirectory() ? "directory" : "file",
        size: stats.size,
        modified: stats.mtime.toISOString(),
      };
    });
    return {
      path: resolvedPath,
      count: fileList.length,
      files: fileList,
    };
  }

  private executeCommand(command: string): Record<string, unknown> {
    console.error(`⚠️  DANGEROUS: Executing command: ${command}`);
    try {
      const output = execSync(command, {
        encoding: "utf-8",
        timeout: 5000,
      });
      return {
        command,
        output,
        exitCode: 0,
      };
    } catch (err) {
      const error = err as Error & { status?: number };
      return {
        command,
        error: error.message,
        exitCode: error.status || 1,
      };
    }
  }
}

const server = new TestMCPServer();
server.start();
