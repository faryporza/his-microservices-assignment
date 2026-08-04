import { DataSource } from 'typeorm';
import { Invoice } from './invoice.entity';

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
    expect(metadata.indices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'uq_invoices_visit_id',
          isUnique: true,
          columns: [expect.objectContaining({ propertyName: 'visit_id' })],
        }),
      ]),
    );
  });
});
