# Contributing to ContextGuard

Thank you for your interest in contributing to ContextGuard! 🎉

We welcome contributions of all kinds: bug reports, feature requests, documentation improvements, and code contributions.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Submitting Changes](#submitting-changes)
- [Adding Detection Rules](#adding-detection-rules)

---

## 📜 Code of Conduct

This project follows a Code of Conduct that all contributors are expected to adhere to. Please be respectful and constructive.

**In short:**

- Be respectful and inclusive
- Focus on what's best for the community
- Show empathy towards other contributors
- Accept constructive criticism gracefully

---

## 🤝 How Can I Contribute?

### Reporting Bugs

**Before submitting a bug report:**

- Check existing issues to avoid duplicates
- Collect relevant information (OS, Node version, MCP server type)

**When submitting:**

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Run command '...'
2. Use MCP tool '...'
3. See error

**Expected behavior**
What you expected to happen.

**Logs**
```

Paste relevant logs from mcp_security.log

```

**Environment:**
- OS: [e.g., macOS 14.0]
- Node version: [e.g., 18.17.0]
- ContextGuard version: [e.g., 0.1.0]
- MCP server: [e.g., filesystem, database]
```

### Suggesting Features

We love new ideas! Before suggesting a feature:

- Check if it's already been suggested
- Explain **why** this feature would be useful
- Provide examples of how it would work

**Template:**

```markdown
**Feature Description**
Clear description of the feature.

**Use Case**
Who would use this and why?

**Proposed Implementation**
Technical approach (if you have ideas).

**Alternatives Considered**
Other solutions you've thought about.
```

### Improving Documentation

Documentation improvements are always welcome:

- Fix typos or unclear explanations
- Add examples
- Improve API documentation
- Create tutorials

---

## 💻 Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- TypeScript knowledge

### Setup Steps

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/amironi/contextguard.git
cd ContextGuard

# 3. Add upstream remote
git remote add upstream https://github.com/amironi/contextguard.git

# 4. Install dependencies
npm install

# 5. Build the project
npm run build

# 6. Run tests
npm test
```

### Running Locally

```bash
# Run in development mode
npm run dev -- --server "npx ts-node src/test-server.ts"

# Test with your own MCP server
npm run dev -- --server "node /path/to/your-server.js" --config security.json
```

### Project Structure

```
ContextGuard/
├── src/
│   ├── mcp-security-wrapper.ts  # Main security wrapper
│   ├── test-server.ts           # Test MCP server
│   └── types/                   # TypeScript types
├── dist/                        # Compiled JavaScript
├── examples/                    # Example configurations
├── docs/                        # Documentation
├── tests/                       # Test files
└── package.json
```

---

## 📝 Coding Standards

### TypeScript Style

We follow standard TypeScript conventions:

```typescript
// Good: Use descriptive variable names
const detectionPatterns = [/pattern1/, /pattern2/];

// Bad: Single letter variables (except loops)
const p = [/pattern1/, /pattern2/];

// Good: Use interfaces for complex types
interface SecurityEvent {
  timestamp: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: Record<string, any>;
}

// Good: Add JSDoc comments for public functions
/**
 * Checks if the text contains prompt injection patterns
 * @param text - The text to analyze
 * @returns Array of detected violations
 */
function checkPromptInjection(text: string): string[] {
  // implementation
}
```

### Code Quality

- **Write tests** for new features
- **Keep functions small** (< 50 lines ideally)
- **Use meaningful names** for variables and functions
- **Comment complex logic** but avoid obvious comments
- **Handle errors gracefully** with try-catch
- **Log important events** for debugging

### Linting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

---

## 🔄 Submitting Changes

### Branch Naming

```bash
# Features
git checkout -b feature/add-ml-detection

# Bug fixes
git checkout -b fix/path-traversal-false-positive

# Documentation
git checkout -b docs/improve-readme
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Features
feat: add ML-based anomaly detection

# Bug fixes
fix: resolve false positive in prompt injection detection

# Documentation
docs: update installation instructions

# Performance
perf: optimize regex matching for large payloads

# Tests
test: add tests for rate limiting

# Refactoring
refactor: simplify SecurityPolicy class
```

### Pull Request Process

1. **Update your fork**

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Create a pull request**

   - Write a clear title and description
   - Reference related issues (e.g., "Fixes #123")
   - Include screenshots for UI changes
   - Add tests for new features

3. **PR Description Template**

   ```markdown
   ## Description

   Brief description of changes.

   ## Related Issues

   Fixes #123

   ## Type of Change

   - [ ] Bug fix
   - [ ] New feature
   - [ ] Documentation update
   - [ ] Performance improvement

   ## Testing

   How has this been tested?

   ## Checklist

   - [ ] Tests added/updated
   - [ ] Documentation updated
   - [ ] No breaking changes
   - [ ] Lint passes
   ```

4. **Code Review**

   - Address reviewer feedback
   - Be open to suggestions
   - Keep discussions professional

5. **Merge**
   - Maintainers will merge after approval
   - Delete your branch after merge

---

## 🔍 Adding Detection Rules

### Creating a New Detection Pattern

Want to help catch more threats? Here's how to add new detection rules:

#### 1. Identify the Pattern

Example: Detecting SQL injection attempts in tool parameters

```typescript
// Bad SQL injection patterns
"'; DROP TABLE users; --";
"1' OR '1'='1";
"admin'--";
```

#### 2. Create the Regex

```typescript
const sqlInjectionPatterns = [
  /('|(\\'))(;|(\s+)|(\\s+))(drop|delete|insert|update)/gi,
  /(\d+|\w+)('\s+)(or|and)(\s+)('\d+|\w+')(\s*)=(\s*)('\d+|\w+')/gi,
  /(--|#|\/\*|\*\/)/g,
];
```

#### 3. Add to Detection Engine

Edit `src/mcp-security-wrapper.ts`:

```typescript
class SecurityPolicy {
  private sqlInjectionPatterns: RegExp[];

  constructor(config: SecurityConfig) {
    // ... existing code ...

    this.sqlInjectionPatterns = [
      /('|(\\'))(;|(\s+)|(\\s+))(drop|delete|insert|update)/gi,
      /(\d+|\w+)('\s+)(or|and)(\s+)('\d+|\w+')(\s*)=(\s*)('\d+|\w+')/gi,
    ];
  }

  checkSqlInjection(text: string): string[] {
    const violations: string[] = [];

    for (const pattern of this.sqlInjectionPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        violations.push(
          `SQL injection attempt detected: ${matches[0].substring(0, 50)}...`
        );
      }
    }

    return violations;
  }
}
```

#### 4. Add Tests

Create `tests/sql-injection.test.ts`:

```typescript
import { SecurityPolicy } from "../src/mcp-security-wrapper";

describe("SQL Injection Detection", () => {
  let policy: SecurityPolicy;

  beforeEach(() => {
    policy = new SecurityPolicy({});
  });

  it("should detect DROP TABLE injection", () => {
    const malicious = "'; DROP TABLE users; --";
    const violations = policy.checkSqlInjection(malicious);
    expect(violations.length).toBeGreaterThan(0);
  });

  it("should detect OR 1=1 injection", () => {
    const malicious = "admin' OR '1'='1";
    const violations = policy.checkSqlInjection(malicious);
    expect(violations.length).toBeGreaterThan(0);
  });

  it("should not flag legitimate SQL-like text", () => {
    const legitimate = "Please drop me an email";
    const violations = policy.checkSqlInjection(legitimate);
    expect(violations.length).toBe(0);
  });
});
```

#### 5. Document the Pattern

Add to README.md:

````markdown
### SQL Injection Detection

ContextGuard detects SQL injection attempts in tool parameters:

```typescript
// Detected patterns include:
"'; DROP TABLE users; --";
"admin' OR '1'='1";
"1' UNION SELECT * FROM passwords";
```
````

````

#### 6. Submit PR

Title: `feat: add SQL injection detection`

Description:
```markdown
## Description
Adds detection for SQL injection attempts in MCP tool parameters.

## Patterns Detected
- DROP/DELETE/INSERT/UPDATE with quotes
- OR/AND boolean injections
- SQL comments (--, #, /* */)

## Testing
- Added 10 test cases
- Tested against known SQL injection payloads
- False positive rate: < 1%

## Related Issues
Fixes #45
````

---

## 🎨 Best Practices for Detection Rules

### 1. Minimize False Positives

```typescript
// Bad: Too broad, catches legitimate use
/password/gi

// Good: More specific pattern
/password\s*[:=]\s*['"]?[\w\-\.]+['"]?/gi
```

### 2. Performance Matters

```typescript
// Bad: Expensive regex
/(a+)+b/

// Good: Efficient pattern
/a+b/
```

### 3. Document Your Patterns

```typescript
/**
 * Detects AWS access keys in format AKIA[0-9A-Z]{16}
 *
 * Example matches:
 * - AKIAIOSFODNN7EXAMPLE
 *
 * False positives:
 * - Very rare, AWS format is specific
 */
const awsKeyPattern = /AKIA[0-9A-Z]{16}/g;
```

### 4. Test Edge Cases

```typescript
describe("Edge cases", () => {
  it("should handle empty string", () => {
    expect(detect("")).toEqual([]);
  });

  it("should handle very long strings", () => {
    const longString = "a".repeat(1000000);
    expect(() => detect(longString)).not.toThrow();
  });

  it("should handle special characters", () => {
    expect(detect("!@#$%^&*()")).toEqual([]);
  });
});
```

---

## 🏆 Recognition

Contributors who make significant improvements will be:

- Listed in README.md contributors section
- Mentioned in release notes
- Given credit in documentation

---

## 📞 Getting Help

- **Questions?** Open a GitHub Discussion
- **Stuck?** Ask in Discord (coming soon)
- **Security concern?** Email am5050@gmail.com

---

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to ContextGuard! Together we're making MCP safer for everyone.** 🛡️
