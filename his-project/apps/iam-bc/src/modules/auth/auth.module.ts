import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { PasswordHashService } from './services/password-hash.service';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';

@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordHashService],
  exports: [AuthService, PasswordHashService],
})
export class AuthModule {}
