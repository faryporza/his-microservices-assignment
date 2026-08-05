import { getMetadataArgsStorage } from 'typeorm';
import { ProcessedEvent } from './processed-event.entity';

describe('ProcessedEvent entity naming', () => {
  const metadata = getMetadataArgsStorage();

  it('uses the required table, column, constraint, and primary-key names', () => {
    const table = metadata.tables.find(
      (item) => item.target === ProcessedEvent,
    );
    const columns = metadata.columns.filter(
      (item) => item.target === ProcessedEvent,
    );
    const uniqueConstraint = metadata.uniques.find(
      (item) => item.target === ProcessedEvent,
    );

    expect(table?.name).toBe('processed_events');
    expect(columns.map((column) => column.propertyName)).toEqual([
      'id',
      'event_id',
      'event_name',
      'processed_at',
    ]);
    expect(
      columns.find((column) => column.propertyName === 'id')?.options,
    ).toMatchObject({ primaryKeyConstraintName: 'pk_processed_events' });
    expect(uniqueConstraint).toMatchObject({
      name: 'uq_processed_events_event_id',
      columns: ['event_id'],
    });
  });
});
