import { Test } from '@nestjs/testing';
import { Type } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PatientsController } from '@apps/opd-bc/modules/patient/controllers/patients.controller';
import { VisitsController } from '@apps/opd-bc/modules/visit/controllers/visits.controller';
import { MedicalRecordsController } from '@apps/emr-bc/modules/medical-record/controllers/medical-records.controller';
import { InvoicesController } from '@apps/finance-bc/modules/invoice/controllers/invoices.controller';
import { UsersController } from '@apps/iam-bc/modules/user/controllers/users.controller';
import { AuthController } from '@apps/iam-bc/modules/auth/controllers/auth.controller';
import { PatientsService } from '@apps/opd-bc/modules/patient/services/patients.service';
import { VisitsService } from '@apps/opd-bc/modules/visit/services/visits.service';
import { MedicalRecordsService } from '@apps/emr-bc/modules/medical-record/services/medical-records.service';
import { InvoicesService } from '@apps/finance-bc/modules/invoice/services/invoices.service';
import { UsersService } from '@apps/iam-bc/modules/user/services/users.service';
import { AuthService } from '@apps/iam-bc/modules/auth/services/auth.service';
import { RedisService } from '@app/common';

describe('OpenAPI 3.0 Contract & Schema Conformance (R14)', () => {
  const dummyService = {};
  const mockJwtService = {
    verifyAsync: jest.fn(),
    signAsync: jest.fn(),
  };
  const mockRedisService = {
    isAccessTokenBlacklisted: jest.fn(),
    getSession: jest.fn(),
  };

  const createSwaggerDoc = async (
    controllers: Type<unknown>[],
    providers: Type<unknown>[],
    title: string,
  ) => {
    const module = await Test.createTestingModule({
      controllers,
      providers: [
        Reflector,
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedisService },
        ...providers.map((p) => ({
          provide: p,
          useValue: dummyService,
        })),
      ],
    }).compile();

    const app = module.createNestApplication();
    const config = new DocumentBuilder()
      .setTitle(title)
      .setDescription(`${title} API specification`)
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    await app.close();
    return doc;
  };

  it('generates valid OpenAPI 3.0 specification for OPD Service', async () => {
    const doc = await createSwaggerDoc(
      [PatientsController, VisitsController],
      [PatientsService, VisitsService],
      'OPD Service',
    );
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.components?.securitySchemes).toBeDefined();
    expect(doc.paths['/patients']).toBeDefined();
    expect(doc.paths['/visits']).toBeDefined();
  });

  it('generates valid OpenAPI 3.0 specification for EMR Service', async () => {
    const doc = await createSwaggerDoc(
      [MedicalRecordsController],
      [MedicalRecordsService],
      'EMR Service',
    );
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.components?.securitySchemes).toBeDefined();
    expect(doc.paths['/records']).toBeDefined();
  });

  it('generates valid OpenAPI 3.0 specification for Finance Service', async () => {
    const doc = await createSwaggerDoc(
      [InvoicesController],
      [InvoicesService],
      'Finance Service',
    );
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.components?.securitySchemes).toBeDefined();
    expect(doc.paths['/invoices']).toBeDefined();
  });

  it('generates valid OpenAPI 3.0 specification for IAM Service', async () => {
    const doc = await createSwaggerDoc(
      [AuthController, UsersController],
      [AuthService, UsersService],
      'IAM Service',
    );
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.components?.securitySchemes).toBeDefined();
    expect(doc.paths['/auth/register']).toBeDefined();
    expect(doc.paths['/auth/login']).toBeDefined();
    expect(doc.paths['/users/{id}/role']).toBeDefined();
  });
});
