import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export interface ApiSuccessResponseOptions {
  status?: number;
  description?: string;
  type?: Type<unknown> | [Type<unknown>];
}

export function ApiSuccessResponse(options?: ApiSuccessResponseOptions) {
  const status = options?.status ?? 200;
  const description = options?.description ?? 'Operation succeeded';

  return applyDecorators(
    ApiResponse({
      status,
      description,
    }),
  );
}
