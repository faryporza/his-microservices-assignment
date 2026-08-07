import { DataSource } from 'typeorm';
import { Invoice } from '@apps/finance-bc/modules/invoice/entities/invoice.entity';
import { CreateInvoiceDTO } from '@apps/finance-bc/modules/invoice/dto/create-invoice.dto';
import { PayInvoiceDTO } from '@apps/finance-bc/modules/invoice/dto/pay-invoice.dto';

describe('Invoice persistence naming', () => {
  it('uses the required table, column, primary key, and unique constraint names', async () => {
    const dataSource = new DataSource({
      type: 'postgres',
      entities: [Invoice],
    });

    await dataSource.buildMetadatas();
    const metadata = dataSource.getMetadata(Invoice);

    expect(metadata.tableName).toBe('invoices');
    expect(metadata.primaryColumns[0].primaryKeyConstraintName).toBe(
      'pk_invoices',
    );
    expect(metadata.columns.map((column) => column.databaseName)).toEqual(
      expect.arrayContaining([
        'visit_id',
        'record_id',
        'correlation_id',
        'total_amount',
        'paid_at',
        'created_at',
        'updated_at',
      ]),
    );
    expect(metadata.uniques).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'uq_invoices_visit_id',
          columns: [expect.objectContaining({ propertyName: 'visit_id' })],
        }),
      ]),
    );
  });

  it('uses the uppercase DTO suffix', () => {
    expect([CreateInvoiceDTO.name, PayInvoiceDTO.name]).toEqual([
      'CreateInvoiceDTO',
      'PayInvoiceDTO',
    ]);
  });
});
