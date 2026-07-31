import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { FinanceRabbitMqModule } from '../messaging/finance-rabbitmq.module';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice]), FinanceRabbitMqModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
