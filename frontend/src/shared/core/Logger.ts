type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  constructor(private readonly scope: string) {}

  debug(message: string, context?: Record<string, unknown>) {
    this.write('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.write('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.write('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.write('error', message, context);
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const payload = { scope: this.scope, message, ...(context ?? {}) };
    const method = console[level] ?? console.log;
    method.call(console, payload);
  }
}