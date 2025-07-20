/**
 * Production Logging System
 * Centralized logging with different levels and structured output
 */

import { config, monitoringConfig } from './config';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private logLevel: LogLevel;
  private service: string;

  constructor(service: string = 'evidence-management-system') {
    this.service = service;
    this.logLevel = this.getLogLevel(monitoringConfig.logLevel);
  }

  private getLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private formatLog(entry: LogEntry): string {
    if (config.NODE_ENV === 'production') {
      // JSON format for production (easier for log aggregation)
      return JSON.stringify(entry);
    } else {
      // Human-readable format for development
      const timestamp = new Date(entry.timestamp).toISOString();
      const level = entry.level.toUpperCase().padEnd(5);
      const service = entry.service.padEnd(20);
      const message = entry.message;
      const metadata = entry.metadata ? ` | ${JSON.stringify(entry.metadata)}` : '';
      const error = entry.error ? ` | ERROR: ${entry.error.message}` : '';
      
      return `${timestamp} [${level}] ${service} | ${message}${metadata}${error}`;
    }
  }

  private createLogEntry(
    level: string,
    message: string,
    metadata?: Record<string, any>,
    error?: Error,
    userId?: string,
    requestId?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      userId,
      requestId,
      metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: config.NODE_ENV !== 'production' ? error.stack : undefined,
      } : undefined,
    };
  }

  private writeLog(entry: LogEntry): void {
    const formattedLog = this.formatLog(entry);
    
    if (entry.level === 'ERROR') {
      console.error(formattedLog);
    } else if (entry.level === 'WARN') {
      console.warn(formattedLog);
    } else {
      console.log(formattedLog);
    }

    // Send to external logging service in production
    if (config.NODE_ENV === 'production' && monitoringConfig.sentryDsn) {
      this.sendToExternalService(entry);
    }
  }

  private async sendToExternalService(entry: LogEntry): Promise<void> {
    try {
      // This would integrate with services like Sentry, DataDog, etc.
      // For now, we'll just implement a basic structure
      if (entry.level === 'ERROR' && entry.error) {
        // Send error to Sentry or similar service
        // await Sentry.captureException(entry.error, {
        //   user: { id: entry.userId },
        //   tags: { service: entry.service, requestId: entry.requestId },
        //   extra: entry.metadata,
        // });
      }
    } catch (error) {
      // Fallback to console if external service fails
      console.error('Failed to send log to external service:', error);
    }
  }

  error(message: string, error?: Error, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const entry = this.createLogEntry('ERROR', message, metadata, error, userId, requestId);
    this.writeLog(entry);
  }

  warn(message: string, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry = this.createLogEntry('WARN', message, metadata, undefined, userId, requestId);
    this.writeLog(entry);
  }

  info(message: string, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry = this.createLogEntry('INFO', message, metadata, undefined, userId, requestId);
    this.writeLog(entry);
  }

  debug(message: string, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry = this.createLogEntry('DEBUG', message, metadata, undefined, userId, requestId);
    this.writeLog(entry);
  }

  // Specialized logging methods for common use cases
  security(message: string, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    this.warn(`[SECURITY] ${message}`, { ...metadata, category: 'security' }, userId, requestId);
  }

  performance(message: string, duration: number, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    this.info(`[PERFORMANCE] ${message}`, { 
      ...metadata, 
      category: 'performance', 
      duration_ms: duration 
    }, userId, requestId);
  }

  audit(action: string, resource: string, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    this.info(`[AUDIT] ${action} on ${resource}`, { 
      ...metadata, 
      category: 'audit',
      action,
      resource 
    }, userId, requestId);
  }

  database(query: string, duration: number, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    if (duration > 1000) { // Log slow queries
      this.warn(`[DATABASE] Slow query detected`, { 
        ...metadata, 
        category: 'database',
        query: query.substring(0, 200), // Truncate long queries
        duration_ms: duration 
      }, userId, requestId);
    } else if (this.shouldLog(LogLevel.DEBUG)) {
      this.debug(`[DATABASE] Query executed`, { 
        ...metadata, 
        category: 'database',
        query: query.substring(0, 200),
        duration_ms: duration 
      }, userId, requestId);
    }
  }

  api(method: string, path: string, statusCode: number, duration: number, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    const level = statusCode >= 400 ? 'ERROR' : statusCode >= 300 ? 'WARN' : 'INFO';
    const message = `[API] ${method} ${path} - ${statusCode}`;
    
    const logMetadata = {
      ...metadata,
      category: 'api',
      method,
      path,
      statusCode,
      duration_ms: duration,
    };

    if (level === 'ERROR') {
      this.error(message, undefined, logMetadata, userId, requestId);
    } else if (level === 'WARN') {
      this.warn(message, logMetadata, userId, requestId);
    } else {
      this.info(message, logMetadata, userId, requestId);
    }
  }

  upload(filename: string, fileSize: number, duration: number, success: boolean, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    const message = `[UPLOAD] ${filename} (${fileSize} bytes) - ${success ? 'SUCCESS' : 'FAILED'}`;
    const logMetadata = {
      ...metadata,
      category: 'upload',
      filename,
      fileSize,
      duration_ms: duration,
      success,
    };

    if (success) {
      this.info(message, logMetadata, userId, requestId);
    } else {
      this.error(message, undefined, logMetadata, userId, requestId);
    }
  }
}

// Create singleton logger instance
export const logger = new Logger();

// Export specialized loggers for different modules
export const apiLogger = new Logger('api');
export const dbLogger = new Logger('database');
export const authLogger = new Logger('auth');
export const uploadLogger = new Logger('upload');
export const securityLogger = new Logger('security');

// Request ID middleware helper
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Log rotation helper (for file-based logging)
export class LogRotator {
  private maxFileSize: number;
  private maxFiles: number;
  private logDir: string;

  constructor(logDir: string = './logs', maxFileSize: number = 100 * 1024 * 1024, maxFiles: number = 10) {
    this.logDir = logDir;
    this.maxFileSize = maxFileSize; // 100MB default
    this.maxFiles = maxFiles;
  }

  // This would implement log file rotation in a production environment
  // For now, we're using console logging with external service integration
  async rotateIfNeeded(): Promise<void> {
    // Implementation would check file sizes and rotate as needed
    // This is typically handled by external log management systems in production
  }
}

export default logger;