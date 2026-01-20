import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes.enum';

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    httpStatus: HttpStatus,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, httpStatus);
  }

  getCode(): ErrorCode {
    return this.code;
  }

  getDetails(): unknown {
    return this.details;
  }
}
