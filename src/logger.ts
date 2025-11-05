/**
 * Copyright (c) 2025 Amir Mironi
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as fs from "fs";
import { SecurityEvent, SecuritySeverity, SecurityStatistics } from "./types";
import { SupabaseClient } from "./supabase-client";

const MAX_STORED_EVENTS = 1000;

/**
 * Logger interface
 */
export interface Logger {
  logEvent: (
    eventType: string,
    severity: SecuritySeverity,
    details: Record<string, unknown>,
    sessionId: string
  ) => void;
  getStatistics: () => SecurityStatistics;
  clearEvents: () => void;
  getAllEvents: () => SecurityEvent[];
}

/**
 * Count events by a specific field
 */
const countByField = (
  events: SecurityEvent[],
  field: keyof SecurityEvent
): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const event of events) {
    const value = String(event[field]);
    counts[value] = (counts[value] || 0) + 1;
  }

  return counts;
};

/**
 * Create a security event logger
 * @param logFile - Path to log file
 * @param supabaseClient - Optional Supabase client for remote logging
 * @returns Logger functions
 */
export const createLogger = (
  logFile: string = "mcp_security.log",
  supabaseClient?: SupabaseClient
): Logger => {
  let events: SecurityEvent[] = [];

  return {
    /**
     * Log a security event
     */
    logEvent: (
      eventType: string,
      severity: SecuritySeverity,
      details: Record<string, unknown>,
      sessionId: string
    ): void => {
      const event: SecurityEvent = {
        timestamp: new Date().toISOString(),
        eventType,
        severity,
        details,
        sessionId,
      };

      events.push(event);

      // Keep only recent events in memory
      if (events.length > MAX_STORED_EVENTS) {
        events = events.slice(-MAX_STORED_EVENTS);
      }

      // Write to log file
      try {
        fs.appendFileSync(logFile, JSON.stringify(event) + "\n");
      } catch (error) {
        console.error("Failed to write to log file:", error);
      }

      // Alert on high/critical severity
      if (severity === "HIGH" || severity === "CRITICAL") {
        console.error(
          `[SECURITY ALERT] ${eventType}: ${JSON.stringify(details)}`
        );
      }

      // Report to Supabase if client is provided
      if (supabaseClient) {
        supabaseClient.reportEvent(event).catch((err) => {
          console.error("Failed to report event to Supabase:", err);
        });
      }
    },

    /**
     * Get security statistics
     */
    getStatistics: (): SecurityStatistics => ({
      totalEvents: events.length,
      eventsByType: countByField(events, "eventType"),
      eventsBySeverity: countByField(events, "severity"),
      recentEvents: events.slice(-10),
    }),

    /**
     * Clear all logged events
     */
    clearEvents: (): void => {
      events = [];
    },

    /**
     * Get all events
     */
    getAllEvents: (): SecurityEvent[] => [...events],
  };
};
