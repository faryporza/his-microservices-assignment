import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import {
  createPostgresOptions,
  CommonModule,
  AuthCommonModule,
  JwtAuthGuard,
  RolesGuard,
} from '@app/common';
import { FinanceHealthChecksController } from './health-checks.controller';
import { FinanceHealthChecksService } from './health-checks.service';
import { InvoiceModule } from '@apps/finance-bc/modules/invoice/invoice.module';

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
        createPostgresOptions(configService, 'FINANCE_DATABASE'),
    }),
    CommonModule,
    AuthCommonModule,
    InvoiceModule,
  ],
  controllers: [FinanceHealthChecksController],
  providers: [
    FinanceHealthChecksService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class FinanceBcModule {}
