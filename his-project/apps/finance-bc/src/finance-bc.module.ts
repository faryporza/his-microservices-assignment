import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createPostgresOptions } from '@app/common';
import { FinanceBcController } from './finance-bc.controller';
import { FinanceBcService } from './finance-bc.service';
import { InvoicesModule } from './invoices/invoices.module';
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
    InvoicesModule,
  ],
  controllers: [FinanceBcController],
  providers: [FinanceBcService],
})
export class FinanceBcModule {}
