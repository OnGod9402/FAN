import { AllExceptionsFilter } from './all-exceptions.filter';
import { ArgumentsHost, Logger } from '@nestjs/common';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('logs at ERROR level with stack trace for Error instances', () => {
    const err = new Error('test error');
    filter.catch(err, {} as ArgumentsHost);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('test error'),
      err.stack,
    );
  });

  it('logs at ERROR level for non-Error exceptions', () => {
    filter.catch('string exception', {} as ArgumentsHost);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('string exception'),
      expect.anything(),
    );
  });

  it('does not throw when called', () => {
    expect(() => filter.catch(new Error('boom'), {} as ArgumentsHost)).not.toThrow();
  });
});
