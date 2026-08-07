import { DataSource } from 'typeorm';
import { Patient } from '@apps/opd-bc/patient/entities/patient.entity';
import { Visit } from '@apps/opd-bc/visit/entities/visit.entity';
import { CreatePatientDTO } from '@apps/opd-bc/patient/dto/create-patient.dto';
import { UpdatePatientDTO } from '@apps/opd-bc/patient/dto/update-patient.dto';
import { CreateVisitDTO } from '@apps/opd-bc/visit/dto/create-visit.dto';

describe('OPD persistence naming', () => {
  const dataSource = new DataSource({
    type: 'postgres',
    entities: [Patient, Visit],
  });

  it('uses snake_case columns and explicit patient constraints', async () => {
    await dataSource.buildMetadatas();
    const metadata = dataSource.getMetadata(Patient);

    expect(metadata.tableName).toBe('patients');
    expect(metadata.primaryColumns[0].databaseName).toBe('id');
    expect(metadata.primaryColumns[0].primaryKeyConstraintName).toBe(
      'pk_patients',
    );
    expect(metadata.columns.map((column) => column.databaseName)).toEqual(
      expect.arrayContaining([
        'first_name',
        'last_name',
        'id_card',
        'created_at',
        'updated_at',
      ]),
    );
    expect(metadata.uniques).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'uq_patients_hn' }),
        expect.objectContaining({
          name: 'uq_patients_id_card',
        }),
      ]),
    );
  });

  it('uses snake_case visit columns and the named patient foreign key', () => {
    const metadata = dataSource.getMetadata(Visit);

    expect(metadata.tableName).toBe('visits');
    expect(metadata.primaryColumns[0].primaryKeyConstraintName).toBe(
      'pk_visits',
    );
    expect(metadata.columns.map((column) => column.databaseName)).toEqual(
      expect.arrayContaining(['patient_id', 'visit_date']),
    );
    expect(metadata.foreignKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'fk_visits_patients' }),
      ]),
    );
  });

  it('uses the uppercase DTO suffix', () => {
    expect([
      CreatePatientDTO.name,
      UpdatePatientDTO.name,
      CreateVisitDTO.name,
    ]).toEqual(['CreatePatientDTO', 'UpdatePatientDTO', 'CreateVisitDTO']);
  });
});
