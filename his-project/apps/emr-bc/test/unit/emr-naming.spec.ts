import { DataSource } from 'typeorm';
import { MedicalRecord } from '@apps/emr-bc/modules/medical-record/entities/medical-record.entity';
import { CompleteTreatmentDTO } from '@apps/emr-bc/modules/medical-record/dto/complete-treatment.dto';
import { CreateMedicalRecordDTO } from '@apps/emr-bc/modules/medical-record/dto/create-medical-record.dto';
import { UpdateMedicalRecordDTO } from '@apps/emr-bc/modules/medical-record/dto/update-medical-record.dto';

describe('EMR persistence naming', () => {
  const dataSource = new DataSource({
    type: 'postgres',
    entities: [MedicalRecord],
  });

  it('uses snake_case columns and explicit medical record constraints', async () => {
    await dataSource.buildMetadatas();
    const metadata = dataSource.getMetadata(MedicalRecord);

    expect(metadata.tableName).toBe('medical_records');
    expect(metadata.primaryColumns[0].primaryKeyConstraintName).toBe(
      'pk_medical_records',
    );
    expect(metadata.columns.map((column) => column.databaseName)).toEqual(
      expect.arrayContaining([
        'visit_id',
        'patient_id',
        'correlation_id',
        'treatment_note',
        'doctor_id',
        'treatment_cost',
        'created_at',
        'updated_at',
      ]),
    );
    expect(metadata.uniques).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'uq_medical_records_visit_id',
        }),
      ]),
    );
  });

  it('uses the uppercase DTO suffix', () => {
    expect([
      CompleteTreatmentDTO.name,
      CreateMedicalRecordDTO.name,
      UpdateMedicalRecordDTO.name,
    ]).toEqual([
      'CompleteTreatmentDTO',
      'CreateMedicalRecordDTO',
      'UpdateMedicalRecordDTO',
    ]);
  });
});
