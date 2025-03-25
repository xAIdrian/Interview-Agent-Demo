/**
 * Enhanced logging utility for application logging
 */

class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  info(message: string, ...data: any[]) {
    console.info(`[${this.prefix}] ${message}`, ...data);
  }

  warn(message: string, ...data: any[]) {
    console.warn(`[${this.prefix}] ${message}`, ...data);
  }

  error(message: string, ...data: any[]) {
    console.error(`[${this.prefix}] ${message}`, ...data);
  }

  debug(message: string, ...data: any[]) {
    console.debug(`[${this.prefix}] ${message}`, ...data);
  }
}

// Create logger instances for different parts of the application
export const AuthLogger = new Logger('Auth');
export const ApiLogger = new Logger('API');
export const AppLogger = new Logger('App'); 