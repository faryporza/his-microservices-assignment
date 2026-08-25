import { DataSource } from 'typeorm';
import { User } from '@apps/iam-bc/modules/user/entities/user.entity';

describe('IAM persistence naming', () => {
  const dataSource = new DataSource({
    type: 'postgres',
    entities: [User],
  });

  it('uses snake_case columns and explicit user constraints', async () => {
    await dataSource.buildMetadatas();
    const metadata = dataSource.getMetadata(User);

    expect(metadata.tableName).toBe('users');
    expect(metadata.primaryColumns[0].databaseName).toBe('id');
    expect(metadata.primaryColumns[0].primaryKeyConstraintName).toBe(
      'pk_users',
    );
    expect(metadata.columns.map((column) => column.databaseName)).toEqual(
      expect.arrayContaining([
        'username',
        'email',
        'password_hash',
        'first_name',
        'last_name',
        'role',
        'is_active',
        'created_at',
        'updated_at',
      ]),
    );
    expect(metadata.uniques).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'uq_users_username' }),
        expect.objectContaining({ name: 'uq_users_email' }),
      ]),
    );
    expect(metadata.indices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'idx_users_role' }),
        expect.objectContaining({ name: 'idx_users_is_active' }),
      ]),
    );
  });
});
