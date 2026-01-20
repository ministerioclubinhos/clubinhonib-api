import { HttpStatus } from '@nestjs/common';
import { AppException } from './base.exception';
import { ErrorCode } from './error-codes.enum';

export class AppBusinessException extends AppException {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(code, message, HttpStatus.BAD_REQUEST, details);
  }
}
