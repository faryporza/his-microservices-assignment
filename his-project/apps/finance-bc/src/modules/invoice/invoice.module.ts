import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoicesController } from './controllers/invoices.controller';
import { InvoicesService } from './services/invoices.service';
import { InvoiceEventsController } from './controllers/invoice-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice])],
  controllers: [InvoicesController, InvoiceEventsController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoiceModule {}
