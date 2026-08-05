import { DataSource } from 'typeorm';
import { ProcessedEvent } from './processed-event.entity';

describe('ProcessedEvent persistence naming', () => {
  it('uses the required table, column, primary key, and unique constraint names', async () => {
    const dataSource = new DataSource({
      type: 'postgres',
      entities: [ProcessedEvent],
    });

    await dataSource.buildMetadatas();
    const metadata = dataSource.getMetadata(ProcessedEvent);

    expect(metadata.tableName).toBe('processed_events');
    expect(metadata.primaryColumns[0].primaryKeyConstraintName).toBe(
      'pk_processed_events',
    );
    expect(metadata.columns.map((column) => column.databaseName)).toEqual(
      expect.arrayContaining(['event_id', 'event_name', 'processed_at']),
    );
    expect(metadata.uniques).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'uq_processed_events_event_id',
          columns: [expect.objectContaining({ propertyName: 'event_id' })],
        }),
      ]),
    );
  });
});
