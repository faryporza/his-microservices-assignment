import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createPostgresOptions, CommonModule } from '@app/common';
import { IamHealthChecksController } from './health-checks.controller';
import { IamHealthChecksService } from './health-checks.service';
import { UserModule } from './modules/user/user.module';
import { PasswordHashService } from './modules/auth/services/password-hash.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createPostgresOptions(
          configService,
          configService.get('IAM_DATABASE')
            ? 'IAM_DATABASE'
            : 'IAM_DATABASE_NAME',
        ),
    }),
    CommonModule,
    UserModule,
  ],
  controllers: [IamHealthChecksController],
  providers: [IamHealthChecksService, PasswordHashService],
  exports: [UserModule, PasswordHashService],
})
export class IamBcModule {}
