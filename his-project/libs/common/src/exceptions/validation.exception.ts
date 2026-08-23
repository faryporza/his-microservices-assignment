import { BadRequestException } from '@nestjs/common';
import { ApiErrorObject } from '../response/response.types';

export class ValidationException extends BadRequestException {
  public readonly errors: ApiErrorObject[];
  public readonly businessCode: number = 400001;

  constructor(errors: ApiErrorObject[], message = 'Validation Failed') {
    super({ message, errors });
    this.errors = errors;
  }
}
