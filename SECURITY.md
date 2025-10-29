# Security Policy

## Our Commitment

ContextGuard is a security tool designed to protect MCP servers from various attack vectors. We take the security of ContextGuard itself very seriously. If you discover a security vulnerability, we appreciate your help in disclosing it to us responsibly.

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## What We Protect Against

ContextGuard currently detects and prevents:

### High Severity Threats

- **Prompt Injection Attacks**: 8+ patterns including instruction hijacking, role manipulation, and context escape attempts
- **Sensitive Data Leakage**: API keys, passwords, private keys, SSH keys, database credentials, social security numbers
- **Path Traversal Attacks**: Unauthorized file system access attempts using relative paths or escape sequences

### Medium Severity Threats

- **Rate Limit Violations**: Prevents abuse through excessive requests
- **Suspicious Input Patterns**: Anomalous request structures that may indicate reconnaissance

### Logging & Monitoring

- **Comprehensive Event Logging**: All security events logged with timestamps and severity levels
- **Forensic Analysis**: Detailed logs for post-incident investigation

## Known Limitations

ContextGuard is a defense-in-depth tool and should not be your only security measure:

### Current Limitations

- **Evasion Techniques**: Sophisticated attackers may use encoding, obfuscation, or novel patterns to bypass detection
- **False Positives**: Some legitimate requests may be flagged as suspicious
- **Performance**: While overhead is <1%, extremely high-throughput scenarios should be tested
- **Transport Support**: Currently only stdio transport is fully supported (SSE/HTTP in development)

### Not Protected Against

- **Zero-day MCP vulnerabilities**: Unknown vulnerabilities in the MCP protocol itself
- **Server-side vulnerabilities**: Bugs in your MCP server implementation
- **Network-level attacks**: DDoS, man-in-the-middle (requires network-level protection)
- **Compromised dependencies**: Supply chain attacks in your MCP server's dependencies

## Reporting a Vulnerability

**Please DO NOT report security vulnerabilities through public GitHub issues.**

### How to Report

1. **Email**: Send details to [info@contextguard.dev](mailto:info@contextguard.dev)
   - Subject: "SECURITY: [Brief Description]"
2. **Include**:

   - Type of vulnerability
   - Full paths of source file(s) related to the vulnerability
   - Location of affected source code (tag/branch/commit or direct URL)
   - Step-by-step instructions to reproduce
   - Proof-of-concept or exploit code (if available)
   - Impact assessment
   - Any potential fixes you've considered

3. **Response Time**:
   - Initial response: Within 48 hours
   - Status update: Within 7 days
   - Fix timeline: Depends on severity

### What to Expect

After you submit a report:

1. **Acknowledgment**: We'll confirm receipt within 48 hours
2. **Assessment**: We'll investigate and determine severity
3. **Communication**: We'll keep you updated on progress
4. **Fix Development**: We'll work on a patch
5. **Disclosure**: We'll coordinate public disclosure with you
6. **Credit**: We'll credit you (unless you prefer anonymity)

### Severity Levels

We use the following severity scale:

| Severity     | Description                                        | Response Time   |
| ------------ | -------------------------------------------------- | --------------- |
| **Critical** | Remote code execution, complete bypass of security | Immediate (24h) |
| **High**     | Unauthorized data access, privilege escalation     | 3-7 days        |
| **Medium**   | Denial of service, partial bypass                  | 7-14 days       |
| **Low**      | Minor information disclosure, edge cases           | 14-30 days      |

## Security Best Practices

When using ContextGuard:

### Deployment Recommendations

1. **Defense in Depth**

   ```bash
   # Use ContextGuard as ONE layer of security
   # Also implement:
   # - Network firewalls
   # - Rate limiting at API gateway
   # - Authentication/authorization
   # - Input validation in your MCP server
   ```

2. **Configuration Security**

   ```json
   {
     "maxToolCallsPerMinute": 30,
     "enablePromptInjectionDetection": true,
     "enableSensitiveDataDetection": true,
     "allowedFilePaths": ["/safe/directory/only"],
     "logLevel": "info"
   }
   ```

3. **Least Privilege**

   - Run ContextGuard with minimal required permissions
   - Restrict file system access to only necessary directories
   - Use environment variables for secrets, never hardcode

4. **Regular Updates**

   ```bash
   # Check for updates regularly
   npm update -g contextguard

   # Subscribe to security advisories
   npm audit
   ```

5. **Monitor Logs**

   ```bash
   # Review security logs regularly
   tail -f mcp_security.log | grep "SECURITY_VIOLATION"

   # Set up alerts for HIGH severity events
   ```

### Testing Security

Before production deployment:

```bash
# 1. Test with known attack patterns
contextguard --server "node test-server.js" --config test-security.json

# 2. Review logs for false positives
cat mcp_security.log | jq 'select(.severity == "HIGH")'

# 3. Performance testing
# Ensure <1% overhead in your specific environment

# 4. Backup and recovery
# Test your incident response plan
```

## Security Audit History

| Date | Auditor | Scope         | Status  |
| ---- | ------- | ------------- | ------- |
| TBD  | TBD     | Full codebase | Planned |

We plan to conduct regular security audits as the project matures.

## Security-Related Configuration

### Example Production Configuration

```json
{
  "maxToolCallsPerMinute": 30,
  "enablePromptInjectionDetection": true,
  "enableSensitiveDataDetection": true,
  "enablePathTraversalPrevention": true,
  "allowedFilePaths": ["/var/app/data", "/home/user/safe-directory"],
  "blockedPatterns": [
    "ignore previous instructions",
    "system prompt",
    "confidential"
  ],
  "logLevel": "info",
  "logFile": "/tmp/mcp_security.log",
  "alertWebhook": "https://your-monitoring-service.com/webhook"
}
```

### Environment Variables

Never store secrets in configuration files:

```bash
# Good
export MCP_API_KEY="your-key-here"
contextguard --server "node server.js"

# Bad
# Don't hardcode secrets in config files or code
```

## Vulnerability Disclosure Policy

### Our Commitment

- We will respond to your report within 48 hours
- We will keep you informed of our progress
- We will not take legal action against security researchers who:
  - Act in good faith
  - Avoid privacy violations and service disruption
  - Give us reasonable time to fix issues before disclosure

### Public Disclosure

- **Coordinated Disclosure**: We prefer to fix vulnerabilities before public disclosure
- **Timeline**: We aim to release fixes within 90 days of initial report
- **Credit**: We will publicly thank reporters (unless they prefer anonymity)
- **CVE Assignment**: Critical vulnerabilities will receive CVE identifiers

## Contact

- **Security Issues**: [info@contextguard.dev](mailto:info@contextguard.dev)
- **General Questions**: [GitHub Issues](https://github.com/amironi/contextguard/issues)
- **PGP Key**: Coming soon

## Attribution

We appreciate the security research community. Past contributors:

- _Your name could be here!_

## Resources

- [OWASP Top 10 for LLMs](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [MCP Security Best Practices](https://modelcontextprotocol.io/docs/security)
- [Prompt Injection Defense](https://simonwillison.net/2023/Apr/14/worst-that-can-happen/)

---

**Last Updated**: October 2025

Thank you for helping keep ContextGuard and its users safe!
