import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { RequestUser } from "../jwt.types";

// Достаёт request.user, проставленный JwtAuthGuard.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as RequestUser;
  },
);
