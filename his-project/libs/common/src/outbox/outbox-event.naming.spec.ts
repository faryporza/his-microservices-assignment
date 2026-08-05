import { DataSource } from 'typeorm';
import { OutboxEvent } from './outbox-event.entity';

describe('OutboxEvent persistence naming', () => {
  it('uses explicit snake_case database names', async () => {
    const dataSource = new DataSource({
      type: 'postgres',
      entities: [OutboxEvent],
    });

    await dataSource.buildMetadatas();
    const metadata = dataSource.getMetadata(OutboxEvent);

    expect(metadata.tableName).toBe('outbox_events');
    expect(metadata.primaryColumns[0].primaryKeyConstraintName).toBe(
      'pk_outbox_events',
    );
    expect(metadata.columns.map((column) => column.databaseName)).toEqual(
      expect.arrayContaining([
        'event_id',
        'event_name',
        'event_data',
        'occurred_at',
        'published_at',
        'created_at',
      ]),
    );
    expect(metadata.uniques).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'uq_outbox_events_event_id' }),
      ]),
    );
    expect(metadata.indices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'idx_outbox_events_published_at' }),
      ]),
    );
  });
});
