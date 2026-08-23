import { BadRequestException } from '@nestjs/common';
import { ApiErrorObject } from '../response/response.types';

export class InvalidParameterException extends BadRequestException {
  public readonly errors: ApiErrorObject[];
  public readonly businessCode: number = 400002;

  constructor(errors: ApiErrorObject[], message = 'Invalid Parameter') {
    super({ message, errors });
    this.errors = errors;
  }
}
