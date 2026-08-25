import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

export function getCurrentUserFromContext(
  data: keyof AuthenticatedUser | undefined,
  ctx: ExecutionContext,
): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] | undefined {
  const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
  const user = request.user;

  if (!user) {
    return undefined;
  }

  return data ? user[data] : user;
}

/**
 * Parameter decorator to extract the authenticated user object or a specific user property.
 *
 * @example
 * handler(@CurrentUser() user: AuthenticatedUser)
 * handler(@CurrentUser('id') userId: string)
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ):
    | AuthenticatedUser
    | AuthenticatedUser[keyof AuthenticatedUser]
    | undefined => {
    return getCurrentUserFromContext(data, ctx);
  },
);
