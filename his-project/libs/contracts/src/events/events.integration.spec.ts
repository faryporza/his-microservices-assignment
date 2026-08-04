/**
 * Data flow integration tests that simulate the full event-driven flow
 * using mocked repositories and an in-memory event bus. This validates the
 * contracts and business rules without requiring a running PostgreSQL or
 * RabbitMQ instance.
 */

import { ClientProxy, RmqContext } from '@nestjs/microservices';
import { EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { of } from 'rxjs';
import { IdempotencyService } from '@app/common';

// OPD
import { VisitsService as OpdVisitsService } from '@apps/opd-bc/visits/visits.service';
import {
  Visit,
  VisitStatus,
} from '@apps/opd-bc/visits/entities/visit.entity';
import { Patient } from '@apps/opd-bc/patients/entities/patient.entity';
import { VisitsConsumer } from '@apps/opd-bc/visits/visits.consumer';

// EMR
import { MedicalRecordsService } from '@apps/emr-bc/records/medical-records.service';
import {
  MedicalRecord,
  RecordStatus,
} from '@apps/emr-bc/records/entities/medical-record.entity';
import { MedicalRecordsConsumer } from '@apps/emr-bc/records/medical-records.consumer';

// Finance
import { InvoicesService } from '@apps/finance-bc/invoices/invoices.service';
import {
  Invoice,
  InvoiceStatus,
} from '@apps/finance-bc/invoices/entities/invoice.entity';
import { InvoicesConsumer } from '@apps/finance-bc/invoices/invoices.consumer';

// Contracts
import {
  VISIT_CREATED_EVENT_NAME,
  TREATMENT_COMPLETED_EVENT_NAME,
  INVOICE_PAID_EVENT_NAME,
  VisitCreatedEvent,
  TreatmentCompletedEvent,
  InvoicePaidEvent,
} from '../index';

// ---------------------------------------------------------------------------
// Helper: build an in-memory event bus that captures emitted events.
// ---------------------------------------------------------------------------

interface CapturedEvent {
  pattern: string;
  payload: unknown;
}

function createMockClient(): {
  client: jest.Mocked<ClientProxy>;
  events: CapturedEvent[];
} {
  const events: CapturedEvent[] = [];
  const client = {
    emit: jest.fn((pattern: string, payload: unknown) => {
      events.push({ pattern, payload });
      return of(undefined);
    }),
  } as unknown as jest.Mocked<ClientProxy>;
  return { client, events };
}

function createMockIdempotency<T extends { id?: string }>(
  repository: jest.Mocked<Repository<T>>,
): IdempotencyService {
  const processed = new Set<string>();
  return {
    process: jest.fn(async (eventId, _eventName, businessLogic) => {
      if (processed.has(eventId)) {
        return { duplicate: true };
      }

      const manager = {
        getRepository: () => repository,
      } as unknown as EntityManager;
      const value = await businessLogic(manager);
      processed.add(eventId);
      return { duplicate: false, value };
    }),
  } as unknown as IdempotencyService;
}

function createRmqContext(): RmqContext {
  const message = { content: Buffer.from('{}') };
  const channel = { ack: jest.fn(), nack: jest.fn() };
  return {
    getChannelRef: () => channel,
    getMessage: () => message,
  } as unknown as RmqContext;
}

// ---------------------------------------------------------------------------
// Helper: build a mock repository backed by an in-memory Map.
// ---------------------------------------------------------------------------

function createMockRepo<T extends { id?: string }>(
  initial: T[] = [],
): jest.Mocked<Repository<T>> {
  const store = new Map<string, T>(initial.map((e) => [e.id!, e]));

  return {
    findOne: jest.fn((opts: { where: { id: string } }) => {
      const result = store.get(opts.where.id);
      return Promise.resolve(result ?? null);
    }),
    find: jest.fn(() => Promise.resolve([...store.values()])),
    create: jest.fn((data: Partial<T>) => {
      const entity = {
        ...data,
        id: (data as any).id ?? randomUUID(),
        // Set default date fields if they exist on the entity type
        ...(('visitDate' in (data as any) || true) && {
          visitDate: (data as any).visitDate ?? new Date(),
        }),
        createdAt: (data as any).createdAt ?? new Date(),
        updatedAt: (data as any).updatedAt ?? new Date(),
      } as unknown as T;
      return entity;
    }),
    save: jest.fn((entity: T) => {
      const e = entity as any;
      // Ensure date fields are set
      if (e.visitDate === undefined && 'visitDate' in e) {
        e.visitDate = new Date();
      }
      if (!e.createdAt) e.createdAt = new Date();
      if (!e.updatedAt) e.updatedAt = new Date();
      store.set(e.id as string, entity);
      return Promise.resolve(entity);
    }),
  } as unknown as jest.Mocked<Repository<T>>;
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe('Event-driven data flow integration', () => {
  let opdVisitsService: OpdVisitsService;
  let opdVisitRepo: jest.Mocked<Repository<Visit>>;
  let opdPatientRepo: jest.Mocked<Repository<Patient>>;
  let opdEvents: CapturedEvent[];

  let emrRecordsService: MedicalRecordsService;
  let emrRecordRepo: jest.Mocked<Repository<MedicalRecord>>;
  let emrEvents: CapturedEvent[];

  let financeInvoicesService: InvoicesService;
  let financeInvoiceRepo: jest.Mocked<Repository<Invoice>>;
  let financeEvents: CapturedEvent[];

  beforeEach(async () => {
    // OPD setup
    opdVisitRepo = createMockRepo<Visit>();
    opdPatientRepo = createMockRepo<Patient>();
    const opd = createMockClient();
    opdEvents = opd.events;
    opdVisitsService = new OpdVisitsService(
      opdVisitRepo,
      opdPatientRepo,
      opd.client,
      createMockIdempotency(opdVisitRepo),
    );

    // EMR setup
    emrRecordRepo = createMockRepo<MedicalRecord>();
    const emr = createMockClient();
    emrEvents = emr.events;
    emrRecordsService = new MedicalRecordsService(
      emrRecordRepo,
      emr.client,
      createMockIdempotency(emrRecordRepo),
    );

    // Finance setup
    financeInvoiceRepo = createMockRepo<Invoice>();
    const fin = createMockClient();
    financeEvents = fin.events;
    financeInvoicesService = new InvoicesService(
      financeInvoiceRepo,
      fin.client,
      createMockIdempotency(financeInvoiceRepo),
    );
  });

  // -----------------------------------------------------------------------
  // Full end-to-end flow
  // -----------------------------------------------------------------------

  describe('full visit → treatment → invoice cycle', () => {
    it('should complete the full event-driven flow', async () => {
      // Step 1: Register a patient (mock)
      const patientId = randomUUID();
      opdPatientRepo.findOne.mockResolvedValue({
        id: patientId,
        hn: 'HN001',
        firstName: 'John',
        lastName: 'Doe',
        idCard: '1234567890123',
        visits: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Patient);

      // Step 2: OPD creates a visit
      const visit = await opdVisitsService.create({
        patientId,
      } as any);

      expect(visit.status).toBe(VisitStatus.OPEN);
      expect(visit.patientId).toBe(patientId);

      // Verify visit.created event
      const visitEvent = opdEvents.find(
        (e) => e.pattern === VISIT_CREATED_EVENT_NAME,
      );
      expect(visitEvent).toBeDefined();
      const visitPayload = (visitEvent!.payload as VisitCreatedEvent).payload;
      expect(visitPayload.visitId).toBe(visit.id);
      expect(visitPayload.patientId).toBe(patientId);

      // Step 3: EMR consumer receives visit.created → creates a stub record
      emrRecordRepo.create.mockImplementation(
        (data: any) =>
          ({
            id: randomUUID(),
            ...data,
          }) as MedicalRecord,
      );
      let savedRecordId = '';
      emrRecordRepo.save.mockImplementation((record: MedicalRecord) => {
        savedRecordId = record.id;
        return Promise.resolve(record);
      });

      const emrConsumer = new MedicalRecordsConsumer(emrRecordsService);
      await emrConsumer.handleVisitCreated(
        visitEvent!.payload as VisitCreatedEvent,
        createRmqContext(),
      );

      // Verify stub record was created
      expect(emrRecordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          visitId: visit.id,
          patientId,
          status: RecordStatus.WAITING,
        }),
      );

      // Step 4: EMR updates record to COMPLETED → emits treatment.completed
      // Fetch the saved record to simulate the state
      const recordId = randomUUID();
      emrRecordRepo.findOne.mockResolvedValue({
        id: recordId,
        visitId: visit.id,
        patientId,
        diagnosis: 'Flu',
        treatmentCost: 1500.0,
        status: RecordStatus.WAITING,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as MedicalRecord);

      emrRecordRepo.save.mockImplementation((record: MedicalRecord) => {
        return Promise.resolve(record);
      });

      await emrRecordsService.update(recordId, {
        status: RecordStatus.COMPLETED,
        diagnosis: 'Flu',
        treatmentCost: 1500,
      } as any);

      // Verify treatment.completed event
      const treatmentEvent = emrEvents.find(
        (e) => e.pattern === TREATMENT_COMPLETED_EVENT_NAME,
      );
      expect(treatmentEvent).toBeDefined();
      const treatmentPayload = (
        treatmentEvent!.payload as TreatmentCompletedEvent
      ).payload;
      expect(treatmentPayload.visitId).toBe(visit.id);
      expect(treatmentPayload.treatmentCost).toBe('1500');
      expect(typeof treatmentPayload.treatmentCost).toBe('string');

      // Step 5: Finance consumer receives treatment.completed → creates invoice
      let invoiceId = '';
      financeInvoiceRepo.create.mockImplementation(
        (data: any) =>
          ({
            id: randomUUID(),
            ...data,
          }) as Invoice,
      );
      financeInvoiceRepo.save.mockImplementation((inv: Invoice) => {
        invoiceId = inv.id;
        return Promise.resolve(inv);
      });

      const financeConsumer = new InvoicesConsumer(financeInvoicesService);
      await financeConsumer.handleTreatmentCompleted(
        treatmentEvent!.payload as TreatmentCompletedEvent,
        createRmqContext(),
      );

      // Verify invoice was created
      expect(financeInvoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          visitId: visit.id,
          totalAmount: '1500.00',
          status: InvoiceStatus.PENDING,
        }),
      );

      // Step 6: Finance pays invoice → emits invoice.paid
      financeInvoiceRepo.findOne.mockResolvedValue({
        id: invoiceId,
        visitId: visit.id,
        totalAmount: '1500.00',
        status: InvoiceStatus.PENDING,
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Invoice);

      financeInvoiceRepo.save.mockImplementation((inv: Invoice) => {
        return Promise.resolve(inv);
      });

      await financeInvoicesService.pay(invoiceId);

      // Verify invoice.paid event
      const invoiceEvent = financeEvents.find(
        (e) => e.pattern === INVOICE_PAID_EVENT_NAME,
      );
      expect(invoiceEvent).toBeDefined();
      const invoicePayload = (invoiceEvent!.payload as InvoicePaidEvent)
        .payload;
      expect(invoicePayload.visitId).toBe(visit.id);
      expect(invoicePayload.invoiceId).toBe(invoiceId);
      expect(invoicePayload.status).toBe('PAID');

      // Step 7: OPD consumer receives invoice.paid → closes visit
      const savedVisit = {
        id: visit.id,
        patientId,
        status: VisitStatus.OPEN,
        visitDate: new Date(),
      } as Visit;
      opdVisitRepo.findOne.mockResolvedValue(savedVisit);
      opdVisitRepo.save.mockImplementation((v: Visit) => {
        savedVisit.status = v.status;
        return Promise.resolve(v);
      });

      const opdConsumer = new VisitsConsumer(opdVisitsService);
      await opdConsumer.handleInvoicePaid(
        invoiceEvent!.payload as InvoicePaidEvent,
        createRmqContext(),
      );

      expect(savedVisit.status).toBe(VisitStatus.CLOSED);
    });
  });

  // -----------------------------------------------------------------------
  // Idempotency
  // -----------------------------------------------------------------------

  describe('idempotency', () => {
    it('should leave an already-closed visit closed on duplicate invoice.paid', async () => {
      const visitId = randomUUID();
      const closedVisit = {
        id: visitId,
        patientId: randomUUID(),
        status: VisitStatus.CLOSED,
        visitDate: new Date(),
      } as Visit;

      opdVisitRepo.findOne.mockResolvedValue(closedVisit);
      opdVisitRepo.save.mockResolvedValue(closedVisit);

      const opdConsumer = new VisitsConsumer(opdVisitsService);
      await opdConsumer.handleInvoicePaid(
        {
          metadata: {
            eventId: randomUUID(),
            eventName: INVOICE_PAID_EVENT_NAME,
            version: '1.0.0',
            occurredAt: new Date().toISOString(),
          },
          payload: {
            visitId,
            invoiceId: randomUUID(),
            status: 'PAID',
          },
        },
        createRmqContext(),
      );

      // Should not call save since visit is already closed
      expect(opdVisitRepo.save).not.toHaveBeenCalled();
      expect(closedVisit.status).toBe(VisitStatus.CLOSED);
    });

    it('should handle a non-existent visit gracefully', async () => {
      opdVisitRepo.findOne.mockResolvedValue(null);

      const opdConsumer = new VisitsConsumer(opdVisitsService);
      await opdConsumer.handleInvoicePaid(
        {
          metadata: {
            eventId: randomUUID(),
            eventName: INVOICE_PAID_EVENT_NAME,
            version: '1.0.0',
            occurredAt: new Date().toISOString(),
          },
          payload: {
            visitId: 'non-existent',
            invoiceId: randomUUID(),
            status: 'PAID',
          },
        },
        createRmqContext(),
      );

      // Should not throw and should not call save
      expect(opdVisitRepo.save).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Decimal precision
  // -----------------------------------------------------------------------

  describe('decimal precision', () => {
    it('should preserve decimal precision through the treatment.completed event', async () => {
      const recordId = randomUUID();
      const visitId = randomUUID();

      emrRecordRepo.findOne.mockResolvedValue({
        id: recordId,
        visitId,
        diagnosis: 'Surgery',
        treatmentCost: 12345.67,
        status: RecordStatus.WAITING,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as MedicalRecord);

      emrRecordRepo.save.mockImplementation((record: MedicalRecord) => {
        return Promise.resolve({ ...record });
      });

      await emrRecordsService.update(recordId, {
        status: RecordStatus.COMPLETED,
        treatmentCost: 12345.67,
      } as any);

      const treatmentEvent = emrEvents.find(
        (e) => e.pattern === TREATMENT_COMPLETED_EVENT_NAME,
      );
      expect(treatmentEvent).toBeDefined();
      const payload = (treatmentEvent!.payload as TreatmentCompletedEvent)
        .payload;

      // treatmentCost must be a string
      expect(typeof payload.treatmentCost).toBe('string');
      expect(payload.treatmentCost).toBe('12345.67');
      expect(payload.visitId).toBe(visitId);
      expect(payload.recordId).toBe(recordId);
    });

    it('should normalize amount to two decimal places in Finance', async () => {
      const invoice = {
        id: randomUUID(),
        visitId: randomUUID(),
        totalAmount: '1500.00',
        status: InvoiceStatus.PENDING,
      } as Invoice;
      financeInvoiceRepo.create.mockReturnValue(invoice);
      financeInvoiceRepo.save.mockResolvedValue(invoice);

      await financeInvoicesService.createFromTreatment({
        visitId: 'visit-1',
        recordId: 'record-1',
        totalAmount: '1500',
      });

      expect(financeInvoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalAmount: '1500.00',
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Event metadata
  // -----------------------------------------------------------------------

  describe('event metadata', () => {
    it('should include all required metadata fields in visit.created', async () => {
      const patientId = randomUUID();
      opdPatientRepo.findOne.mockResolvedValue({
        id: patientId,
        hn: 'HN001',
        firstName: 'A',
        lastName: 'B',
        idCard: 'C',
        visits: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Patient);

      await opdVisitsService.create({ patientId } as any);

      const event = opdEvents.find(
        (e) => e.pattern === VISIT_CREATED_EVENT_NAME,
      );
      const evt = event!.payload as VisitCreatedEvent;
      expect(evt.metadata.eventId).toBeDefined();
      expect(evt.metadata.eventName).toBe(VISIT_CREATED_EVENT_NAME);
      expect(evt.metadata.version).toBe('1.0.0');
      expect(evt.metadata.occurredAt).toBeDefined();
      expect(new Date(evt.metadata.occurredAt).toISOString()).toBe(
        evt.metadata.occurredAt,
      );
    });

    it('should include all required metadata fields in invoice.paid', async () => {
      financeInvoiceRepo.findOne.mockResolvedValue({
        id: 'inv-1',
        visitId: 'vis-1',
        totalAmount: '100.00',
        status: InvoiceStatus.PENDING,
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Invoice);

      financeInvoiceRepo.save.mockImplementation((inv: Invoice) => {
        return Promise.resolve(inv);
      });

      await financeInvoicesService.pay('inv-1');

      const event = financeEvents.find(
        (e) => e.pattern === INVOICE_PAID_EVENT_NAME,
      );
      const evt = event!.payload as InvoicePaidEvent;
      expect(evt.metadata.eventId).toBeDefined();
      expect(evt.metadata.eventName).toBe(INVOICE_PAID_EVENT_NAME);
      expect(evt.metadata.version).toBe('1.0.0');
      expect(evt.metadata.occurredAt).toBeDefined();
      expect(evt.payload.status).toBe('PAID');
    });
  });
});
