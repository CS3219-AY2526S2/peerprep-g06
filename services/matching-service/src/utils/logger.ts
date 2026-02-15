enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
  }
  
  class Logger {
    private logLevel: LogLevel;
  
    constructor() {
      const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
      this.logLevel = LogLevel[level as keyof typeof LogLevel] || LogLevel.INFO;
    }
  
    private shouldLog(level: LogLevel): boolean {
      const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
      return levels.indexOf(level) >= levels.indexOf(this.logLevel);
    }
  
    private log(level: LogLevel, message: string, ...args: any[]) {
      if (!this.shouldLog(level)) return;
      
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level}]`, message, ...args);
    }
  
    debug(message: string, ...args: any[]) {
      this.log(LogLevel.DEBUG, message, ...args);
    }
  
    info(message: string, ...args: any[]) {
      this.log(LogLevel.INFO, message, ...args);
    }
  
    warn(message: string, ...args: any[]) {
      this.log(LogLevel.WARN, message, ...args);
    }
  
    error(message: string, ...args: any[]) {
      this.log(LogLevel.ERROR, message, ...args);
    }
  }
  
  export const logger = new Logger();