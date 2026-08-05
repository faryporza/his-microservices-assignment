import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createPostgresOptions } from '@app/common';
import { FinanceHealthChecksController } from './health-checks.controller';
import { FinanceHealthChecksService } from './health-checks.service';
import { InvoiceModule } from '@apps/finance-bc/invoice/invoice.module';
import { CommonModule } from '@app/common';

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
    InvoiceModule,
  ],
  controllers: [FinanceHealthChecksController],
  providers: [FinanceHealthChecksService],
})
export class FinanceBcModule {}
