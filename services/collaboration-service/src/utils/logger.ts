// Small logger shared across the collaboration service.
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

class Logger {
  private readonly level: LogLevel;

  constructor() {
    const configuredLevel = process.env.LOG_LEVEL?.toUpperCase() || LogLevel.INFO;
    this.level = LogLevel[configuredLevel as keyof typeof LogLevel] || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private write(level: LogLevel, message: string, ...args: unknown[]) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]) {
    this.write(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: unknown[]) {
    this.write(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.write(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.write(LogLevel.ERROR, message, ...args);
  }
}

export const logger = new Logger();
