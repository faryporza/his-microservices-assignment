import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export interface ApiStandardErrorResponseOptions {
  status: number;
  description: string;
}

export function ApiStandardErrorResponse(
  options: ApiStandardErrorResponseOptions,
) {
  return applyDecorators(
    ApiResponse({
      status: options.status,
      description: options.description,
    }),
  );
}
