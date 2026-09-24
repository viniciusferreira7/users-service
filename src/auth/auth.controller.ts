import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserResponseDto } from '../users/dtos/user-response.dto';
import { AuthService } from './auth.service';
import { LOGIN_THROTTLE, REGISTER_THROTTLE } from './auth-throttles';
import { LoginDto } from './dtos/login.dto';
import { LoginResponseDto } from './dtos/login-response.dto';
import { RegisterDto } from './dtos/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: REGISTER_THROTTLE })
  @ApiOperation({
    summary: 'Register a seller or buyer account',
    description:
      'Creates an active account. The email is trimmed and lowercased; the password is stored as a bcrypt hash and never returned.',
  })
  @ApiCreatedResponse({ type: UserResponseDto, description: 'Account created' })
  @ApiBadRequestResponse({ description: 'The body failed validation' })
  @ApiConflictResponse({ description: 'Email is already registered' })
  @ApiTooManyRequestsResponse({
    description: 'Registration rate limit exceeded',
  })
  register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: LOGIN_THROTTLE })
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Returns the public user and an HS256 JWT valid for 24 hours. An unknown email and a wrong password get the same answer.',
  })
  @ApiOkResponse({ type: LoginResponseDto, description: 'Logged in' })
  @ApiBadRequestResponse({ description: 'The body failed validation' })
  @ApiUnauthorizedResponse({
    description:
      '"Credenciais inválidas", or "Conta inativa" for an inactive account with the right password',
  })
  @ApiTooManyRequestsResponse({ description: 'Login rate limit exceeded' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }
}
