import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UsePipes,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Throttle } from '@nestjs/throttler';
import {
  registerParentSchema,
  registerStudentSchema,
  loginSchema,
  type RegisterParentInput,
  type RegisterStudentInput,
  type LoginInput,
} from '@kpm/types';
import { AuthService, type TokenPair } from './auth.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser, Public, Roles, type AuthUser } from '../common/rbac.js';

const REFRESH_COOKIE = 'refresh_token';
const ACCESS_COOKIE = 'access_token';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register-parent')
  @UsePipes(new ZodValidationPipe(registerParentSchema))
  async registerParent(@Body() body: RegisterParentInput, @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.auth.registerParent(body);
    this.setCookies(res, result);
    return { userId: result.userId };
  }

  @Roles('PARENT', 'ADMIN')
  @Post('register-student')
  @UsePipes(new ZodValidationPipe(registerStudentSchema))
  async registerStudent(@CurrentUser() user: AuthUser, @Body() body: RegisterStudentInput) {
    return this.auth.registerStudent(user, body);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() body: LoginInput, @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.auth.login(body);
    this.setCookies(res, result);
    return { userId: result.userId, role: result.role };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    const tokens = await this.auth.refresh(raw ?? '');
    this.setCookies(res, tokens);
    return { ok: true };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.sub);
  }

  private setCookies(res: FastifyReply, tokens: TokenPair): void {
    const secure = process.env.NODE_ENV === 'production';
    const domain = process.env.SESSION_COOKIE_DOMAIN;
    res.setCookie(ACCESS_COOKIE, tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      domain,
      path: '/',
      maxAge: 15 * 60,
    });
    res.setCookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      domain,
      path: '/',
      maxAge: 30 * 86_400,
    });
  }
}
