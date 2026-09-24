import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UserResponseDto } from '../users/dtos/user-response.dto';
import { AuthService } from './auth.service';
import { RegisterDto } from './dtos/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
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
}
