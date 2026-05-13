import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, _host: ArgumentsHost): void {
    const err = exception instanceof Error ? exception : new Error(String(exception));
    // Log full stack trace — never log user field values
    this.logger.error(`Unhandled exception: ${err.message}`, err.stack);
  }
}
