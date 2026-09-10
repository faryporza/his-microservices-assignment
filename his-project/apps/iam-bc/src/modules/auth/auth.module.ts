import { Module } from '@nestjs/common';
import { UserModule } from '@apps/iam-bc/modules/user/user.module';
import { PasswordHashService } from './services/password-hash.service';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { LegacySeedSessionCleanupService } from './services/legacy-seed-session-cleanup.service';

@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHashService,
    LegacySeedSessionCleanupService,
  ],
  exports: [AuthService, PasswordHashService],
})
export class AuthModule {}
