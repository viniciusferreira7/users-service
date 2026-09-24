import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { REGISTER_THROTTLE } from './register-throttle';

@Module({
  imports: [UsersModule, ThrottlerModule.forRoot([REGISTER_THROTTLE])],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
