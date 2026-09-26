import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { PublicUserResponseDto } from './dtos/public-user-response.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import { UsersService } from './users.service';

/**
 * The static routes are declared before `:id` on purpose: Express matches in
 * declaration order, so `:id` would otherwise swallow `profile` and `sellers`.
 */
@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get the logged-in account',
    description:
      'Read fresh from the database by the id in the token, so it reflects changes made after login.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  async getProfile(
    @Req() request: { user: AuthenticatedUser }
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findById(request.user.id);

    // A valid token for an account that is gone authenticates no one.
    if (!user) {
      throw new UnauthorizedException();
    }

    return UserResponseDto.from(user);
  }

  @Get('sellers')
  @ApiOperation({
    summary: 'List active sellers',
    description: 'Sorted by name. Emails are not exposed.',
  })
  @ApiOkResponse({ type: PublicUserResponseDto, isArray: true })
  async listSellers(): Promise<PublicUserResponseDto[]> {
    const sellers = await this.usersService.findActiveSellers();

    return sellers.map((seller) => PublicUserResponseDto.from(seller));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a user by id',
    description: 'Emails are not exposed; use /users/profile for your own.',
  })
  @ApiOkResponse({ type: PublicUserResponseDto })
  @ApiBadRequestResponse({ description: 'The id is not a UUID' })
  @ApiNotFoundResponse({ description: 'No user has this id' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<PublicUserResponseDto> {
    const user = await this.usersService.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return PublicUserResponseDto.from(user);
  }
}
