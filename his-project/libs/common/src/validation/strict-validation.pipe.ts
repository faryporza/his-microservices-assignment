import { ValidationError, ValidationPipe } from '@nestjs/common';
import { ValidationException } from '../exceptions/validation.exception';
import { ApiErrorObject } from '../response/response.types';

export function createStrictValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (validationErrors: ValidationError[] = []) => {
      const apiErrors: ApiErrorObject[] = [];

      function flattenErrors(errors: ValidationError[], parentPath = ''): void {
        for (const error of errors) {
          const currentPath = parentPath
            ? `${parentPath}.${error.property}`
            : error.property;

          if (error.constraints) {
            for (const message of Object.values(error.constraints)) {
              apiErrors.push({
                code: '400001',
                title: 'Validation Error',
                detail: message,
                source: {
                  pointer: `/data/attributes/${currentPath}`,
                },
              });
            }
          }

          if (error.children && error.children.length > 0) {
            flattenErrors(error.children, currentPath);
          }
        }
      }

      flattenErrors(validationErrors);
      return new ValidationException(apiErrors, 'Validation Failed');
    },
  });
}
