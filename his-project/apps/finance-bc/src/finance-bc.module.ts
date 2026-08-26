import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import {
  createPostgresOptions,
  CommonModule,
  AuthCommonModule,
  AuditModule,
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  ResourceOwnershipGuard,
  RateLimitGuard,
  OutboxEvent,
  ProcessedEvent,
  InitFinance1000000000000,
  AddSchemaComments20260826000000,
} from '@app/common';
import { FinanceHealthChecksController } from './health-checks.controller';
import { FinanceHealthChecksService } from './health-checks.service';
import { InvoiceModule } from '@apps/finance-bc/modules/invoice/invoice.module';
import { Invoice } from '@apps/finance-bc/modules/invoice/entities/invoice.entity';

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
        createPostgresOptions(configService, 'FINANCE_DATABASE', {
          entities: [Invoice, OutboxEvent, ProcessedEvent],
          migrations: [
            InitFinance1000000000000,
            AddSchemaComments20260826000000,
          ],
          synchronize: false,
        }),
    }),
    CommonModule,
    AuthCommonModule,
    AuditModule,
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
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ResourceOwnershipGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class FinanceBcModule {}
