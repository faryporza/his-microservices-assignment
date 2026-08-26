/**
 * Standard Enterprise Blueprint timestamp interface.
 * Implemented by domain entities to enforce consistent audit timestamp columns.
 */
export interface ITimestamp {
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}
