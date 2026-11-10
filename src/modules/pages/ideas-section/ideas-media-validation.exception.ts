import { HttpStatus } from '@nestjs/common';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
/** Malformed multipart media declarations use the documented 400 contract. */
export class IdeasMediaValidationException extends AppValidationException {
  constructor(code: ErrorCode, message: string) {
    super(code, message, undefined, HttpStatus.BAD_REQUEST);
  }
}
