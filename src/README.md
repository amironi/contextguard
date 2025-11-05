# ContextGuard Source Code Structure

This directory contains the refactored, modular source code for ContextGuard with integrated pro features.

## 📁 File Organization

### Core Modules

- **`types.ts`** - TypeScript type definitions and interfaces
  - `SecurityConfig` - Configuration options
  - `SecurityEvent` - Event logging structure
  - `MCPMessage` - MCP protocol message types
  - `SecurityStatistics` - Statistics interfaces

- **`config.ts`** - Configuration management
  - Default configuration values
  - Configuration merging and validation
  - Type-safe config handling

- **`security-policy.ts`** - Security policy enforcement
  - Prompt injection detection
  - Sensitive data detection (API keys, credentials, PII)
  - File access validation
  - Rate limiting checks

- **`security-logger.ts`** - Event logging and statistics
  - File-based event logging
  - In-memory event storage
  - Statistics aggregation
  - Alert handling for high-severity events

- **`wrapper.ts`** - Main MCP security wrapper
  - MCP server process management
  - Message interception and filtering
  - Security policy enforcement
  - Pro features integration (traceability, context tracking)

- **`cli.ts`** - Command-line interface
  - Argument parsing
  - Configuration loading
  - Help documentation
  - Main entry point for CLI usage

- **`index.ts`** - Public API exports
  - Clean export interface for library usage
  - Re-exports all public types and classes

### Pro Features

- **`premium-features.ts`** - Enterprise/Pro features
  - License management
  - Dashboard analytics
  - Team collaboration
  - Custom detection rules
  - SSO/SAML authentication
  - ML-based detection
  - Compliance reporting
  - Priority support
  - SLA monitoring
  - MCP traceability
  - Context tracking

- **`mcp-traceability-integration.ts`** - Traceability integration
  - Enhanced wrapper with traceability
  - Batch processing examples
  - Dashboard data generation
  - Compliance report generation

### Legacy

- **`mcp-security-wrapper.ts`** - Backward compatibility layer
  - Re-exports from new modular structure
  - Maintains CLI compatibility
  - Deprecated - use `index.ts` for new code

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CLI (cli.ts)                        │
│                  Entry Point for Users                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              MCPSecurityWrapper (wrapper.ts)            │
│            Main Orchestration & Process Mgmt            │
└─────┬──────────┬──────────┬──────────┬─────────────────┘
      │          │          │          │
      ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Security │ │ Security │ │  Config  │ │ Pro Features │
│  Policy  │ │  Logger  │ │ Manager  │ │  (Optional)  │
└──────────┘ └──────────┘ └──────────┘ └──────────────┘
```

## 🚀 Usage Examples

### As a CLI Tool

```bash
# Basic usage
contextguard --server "npx -y @modelcontextprotocol/server-filesystem /"

# With configuration file
contextguard --server "node server.js" --config security-config.json
```

### As a Library

```typescript
import { MCPSecurityWrapper } from 'contextguard';

const wrapper = new MCPSecurityWrapper(
  ['node', 'mcp-server.js'],
  {
    maxToolCallsPerMinute: 50,
    enableProFeatures: true,
    licenseFilePath: '.contextguard-license'
  }
);

await wrapper.start();
```

### With Pro Features

```typescript
import { 
  MCPSecurityWrapperWithTraceability,
  LicenseManager 
} from 'contextguard';

const licenseManager = new LicenseManager('.contextguard-license');
const wrapper = new MCPSecurityWrapperWithTraceability(
  licenseManager,
  'session-123'
);

const { result, error, traceId } = await wrapper.executeToolWithTraceability(
  'user-123',
  'user@example.com',
  'filesystem-mcp',
  'fs-001',
  'read_file',
  { path: '/home/user/config.json' },
  async () => {
    // Tool execution logic
    return { content: 'file content' };
  }
);
```

## 🔧 Configuration

### Security Configuration

```json
{
  "maxToolCallsPerMinute": 30,
  "blockedPatterns": [],
  "allowedFilePaths": ["/home/user/workspace"],
  "alertThreshold": 5,
  "enablePromptInjectionDetection": true,
  "enableSensitiveDataDetection": true,
  "logPath": "mcp_security.log",
  "enableProFeatures": true,
  "licenseFilePath": ".contextguard-license"
}
```

## 🎯 Key Features

### Free Tier
- ✅ Prompt injection detection
- ✅ Sensitive data detection (API keys, credentials)
- ✅ File access validation
- ✅ Rate limiting
- ✅ Security event logging
- ✅ Real-time violation alerts

### Pro Tier
- ✅ MCP traceability (track user → MCP → tool → context)
- ✅ Context tracking (files, env vars, API calls)
- ✅ Dashboard analytics
- ✅ Team collaboration
- ✅ Custom detection rules
- ✅ ML-based anomaly detection
- ✅ Compliance reporting (SOC2, GDPR, HIPAA)
- ✅ Priority support

### Enterprise Tier
- ✅ SSO/SAML authentication
- ✅ SLA guarantees
- ✅ Dedicated support
- ✅ Custom integrations

## 🧪 Testing

```bash
# Run tests
npm test

# Run linter
npm run lint

# Build TypeScript
npm run build

# Development mode
npm run dev -- --server "node test-server.js"
```

## 📝 Development Guidelines

1. **Type Safety**: All code uses strict TypeScript types
2. **Documentation**: JSDoc comments for all public APIs
3. **Modularity**: Each file has a single, clear responsibility
4. **Error Handling**: Comprehensive error handling and logging
5. **Backward Compatibility**: Legacy exports maintained in `mcp-security-wrapper.ts`

## 🔄 Migration Guide

### From v0.1.x to v0.2.x

**Old way:**
```typescript
import { MCPSecurityWrapper } from 'contextguard/dist/mcp-security-wrapper';
```

**New way:**
```typescript
import { MCPSecurityWrapper } from 'contextguard';
// or
import { MCPSecurityWrapper } from 'contextguard/wrapper';
```

The old import path still works but is deprecated.

## 📦 Build Output

After running `npm run build`, the `dist/` directory contains:

```
dist/
├── index.js              # Main entry point
├── index.d.ts            # Type definitions
├── cli.js                # CLI executable
├── wrapper.js            # Core wrapper
├── security-policy.js    # Security enforcement
├── security-logger.js    # Event logging
├── config.js             # Configuration
├── types.js              # Type definitions
├── premium-features.js   # Pro features
└── mcp-traceability-integration.js  # Traceability
```

## 🤝 Contributing

When adding new features:

1. Add types to `types.ts`
2. Create focused modules for new functionality
3. Export public APIs through `index.ts`
4. Update this README
5. Add JSDoc comments
6. Write tests

## 📄 License

MIT License - Copyright (c) 2025 Amir Mironi
