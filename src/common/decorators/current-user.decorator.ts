import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type CurrentUser = {
  sub: string;
  email: string;
};

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
