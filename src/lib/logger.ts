type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    // In development, use console methods for better formatting
    if (this.isDevelopment) {
      const logMethod = level === 'error' ? console.error : 
                      level === 'warn' ? console.warn : 
                      level === 'debug' ? console.debug : console.log;
      
      logMethod(`[${entry.timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
    } else {
      // In production, use structured JSON logging
      console.log(JSON.stringify(entry));
    }
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, error?: any) {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;
    
    this.log('error', message, errorData);
  }

  debug(message: string, data?: any) {
    if (this.isDevelopment || process.env.LOG_LEVEL === 'debug') {
      this.log('debug', message, data);
    }
  }
}

export const logger = new Logger();