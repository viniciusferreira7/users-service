import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { EnvService } from '../env/env.service';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DEFAULT_THROTTLE } from './auth-throttles';
import { jwtOptions } from './jwt-options';

@Module({
  imports: [
    UsersModule,
    ThrottlerModule.forRoot([DEFAULT_THROTTLE]),
    JwtModule.registerAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => jwtOptions(env.get('JWT_SECRET')),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
