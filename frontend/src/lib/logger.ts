/**
 * Structured logging utility for frontend
 * Provides consistent, structured console output in development
 * Silent in production except for errors
 */

const isDev = import.meta.env.DEV;

interface LogData {
  [key: string]: unknown;
}

export const logger = {
  /**
   * Log an info-level event
   */
  info(event: string, data?: LogData): void {
    if (isDev) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] INFO: ${event}`, data || '');
    }
  },

  /**
   * Log a warning-level event
   */
  warn(event: string, data?: LogData): void {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] WARN: ${event}`, data || '');
  },

  /**
   * Log an error-level event with optional error object
   */
  error(event: string, error?: unknown, data?: LogData): void {
    const timestamp = new Date().toISOString();
    if (error instanceof Error) {
      console.error(`[${timestamp}] ERROR: ${event}`, {
        message: error.message,
        stack: error.stack,
        ...data,
      });
    } else if (error) {
      console.error(`[${timestamp}] ERROR: ${event}`, error, data || '');
    } else {
      console.error(`[${timestamp}] ERROR: ${event}`, data || '');
    }
  },

  /**
   * Log a debug-level event (dev only)
   */
  debug(event: string, data?: LogData): void {
    if (isDev) {
      const timestamp = new Date().toISOString();
      console.debug(`[${timestamp}] DEBUG: ${event}`, data || '');
    }
  },
};
