/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as fs from "fs";
import { SecurityEvent, SecuritySeverity, SecurityStatistics } from "./types";

/**
 * Security event logger
 * Logs security events to file and provides statistics
 */
export class SecurityLogger {
  private logFile: string;
  private events: SecurityEvent[] = [];
  private readonly maxStoredEvents = 1000;

  constructor(logFile: string = "mcp_security.log") {
    this.logFile = logFile;
  }

  /**
   * Log a security event
   * @param eventType - Type of event
   * @param severity - Event severity level
   * @param details - Additional event details
   * @param sessionId - Session identifier
   */
  public logEvent(
    eventType: string,
    severity: SecuritySeverity,
    details: Record<string, unknown>,
    sessionId: string
  ): void {
    const event: SecurityEvent = {
      timestamp: new Date().toISOString(),
      eventType,
      severity,
      details,
      sessionId,
    };

    this.events.push(event);

    // Keep only recent events in memory
    if (this.events.length > this.maxStoredEvents) {
      this.events = this.events.slice(-this.maxStoredEvents);
    }

    // Write to log file
    try {
      fs.appendFileSync(this.logFile, JSON.stringify(event) + "\n");
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }

    // Alert on high/critical severity
    if (severity === "HIGH" || severity === "CRITICAL") {
      console.error(
        `[SECURITY ALERT] ${eventType}: ${JSON.stringify(details)}`
      );
    }
  }

  /**
   * Get security statistics
   * @returns Statistics object with event counts and recent events
   */
  public getStatistics(): SecurityStatistics {
    return {
      totalEvents: this.events.length,
      eventsByType: this.countByField("eventType"),
      eventsBySeverity: this.countByField("severity"),
      recentEvents: this.events.slice(-10),
    };
  }

  /**
   * Count events by a specific field
   * @param field - Field to count by
   * @returns Object with counts per field value
   */
  private countByField(field: keyof SecurityEvent): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const event of this.events) {
      const value = String(event[field]);
      counts[value] = (counts[value] || 0) + 1;
    }
    
    return counts;
  }

  /**
   * Clear all logged events
   */
  public clearEvents(): void {
    this.events = [];
  }

  /**
   * Get all events
   * @returns Array of all security events
   */
  public getAllEvents(): SecurityEvent[] {
    return [...this.events];
  }
}
