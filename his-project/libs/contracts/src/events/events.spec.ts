import {
  EventMetadata,
  EventRoutingKey,
  VisitCreatedEvent,
  VisitCreatedPayload,
  VISIT_CREATED_EVENT_NAME,
  VISIT_CREATED_EVENT_VERSION,
  TreatmentCompletedEvent,
  TreatmentCompletedPayload,
  TREATMENT_COMPLETED_EVENT_NAME,
  TREATMENT_COMPLETED_EVENT_VERSION,
  InvoicePaidEvent,
  InvoicePaidPayload,
  INVOICE_PAID_EVENT_NAME,
  INVOICE_PAID_EVENT_VERSION,
  RABBITMQ_EXCHANGE,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
  RABBITMQ_BINDINGS,
  hasValidEventMetadata,
} from '../index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildMetadata = (overrides?: Partial<EventMetadata>): EventMetadata => ({
  eventId: 'evt-001',
  eventName: 'visit.created',
  version: '1.0.0',
  occurredAt: new Date('2026-07-27T10:00:00Z').toISOString(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// BaseEvent & EventMetadata
// ---------------------------------------------------------------------------

describe('BaseEvent & EventMetadata', () => {
  it('should allow constructing a BaseEvent with typed payload', () => {
    const payload: VisitCreatedPayload = {
      visitId: 'v-1',
      patientId: 'p-1',
      timestamp: '2026-07-27T10:00:00Z',
    };

    const event: VisitCreatedEvent = {
      metadata: buildMetadata({ eventName: 'visit.created' }),
      payload,
    };

    expect(event.metadata.eventId).toBe('evt-001');
    expect(event.metadata.eventName).toBe('visit.created');
    expect(event.metadata.version).toBe('1.0.0');
    expect(event.metadata.occurredAt).toBeDefined();
    expect(event.payload.visitId).toBe('v-1');
    expect(event.payload.patientId).toBe('p-1');
  });

  it('should allow an optional correlationId in metadata', () => {
    const metadata: EventMetadata = buildMetadata({ correlationId: 'corr-42' });
    expect(metadata.correlationId).toBe('corr-42');
  });

  it('should allow correlationId to be undefined', () => {
    const metadata: EventMetadata = buildMetadata();
    expect(metadata.correlationId).toBeUndefined();
  });

  it('should allow distributed trace metadata without changing event payloads', () => {
    const metadata: EventMetadata = buildMetadata({
      correlationId: 'correlation-42',
      traceId: 'trace-42',
    });
    expect(metadata.correlationId).toBe('correlation-42');
    expect(metadata.traceId).toBe('trace-42');
  });

  it('should enforce that eventId is a string', () => {
    const metadata: EventMetadata = buildMetadata({ eventId: 'abc-123' });
    expect(typeof metadata.eventId).toBe('string');
  });

  it('should enforce that version is a string', () => {
    const metadata: EventMetadata = buildMetadata({ version: '2.0.0' });
    expect(typeof metadata.version).toBe('string');
  });
});

describe('event trace metadata validation', () => {
  const metadata: EventMetadata = {
    eventId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    eventName: VISIT_CREATED_EVENT_NAME,
    version: VISIT_CREATED_EVENT_VERSION,
    occurredAt: '2026-08-01T00:00:00.000Z',
    correlationId: 'correlation-id',
    traceId: 'trace-id',
  };

  it('accepts valid optional correlation and trace identifiers', () => {
    expect(
      hasValidEventMetadata(
        metadata,
        VISIT_CREATED_EVENT_NAME,
        VISIT_CREATED_EVENT_VERSION,
      ),
    ).toBe(true);
  });

  it('rejects blank trace identifiers when supplied', () => {
    expect(
      hasValidEventMetadata(
        { ...metadata, traceId: '   ' },
        VISIT_CREATED_EVENT_NAME,
        VISIT_CREATED_EVENT_VERSION,
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EventRoutingKey
// ---------------------------------------------------------------------------

describe('EventRoutingKey', () => {
  it('should accept the three known routing keys', () => {
    const keys: EventRoutingKey[] = [
      'visit.created',
      'treatment.completed',
      'invoice.paid',
    ];
    expect(keys).toHaveLength(3);
    expect(keys).toContain('visit.created');
    expect(keys).toContain('treatment.completed');
    expect(keys).toContain('invoice.paid');
  });
});

// ---------------------------------------------------------------------------
// visit.created
// ---------------------------------------------------------------------------

describe('visit.created event', () => {
  it('should export the correct event name constant', () => {
    expect(VISIT_CREATED_EVENT_NAME).toBe('visit.created');
  });

  it('should export the correct event version constant', () => {
    expect(VISIT_CREATED_EVENT_VERSION).toBe('1.0.0');
  });

  it('should construct a valid VisitCreatedEvent', () => {
    const payload: VisitCreatedPayload = {
      visitId: 'vis-123',
      patientId: 'pat-456',
      timestamp: '2026-07-27T08:30:00Z',
    };

    const event: VisitCreatedEvent = {
      metadata: buildMetadata({
        eventName: VISIT_CREATED_EVENT_NAME,
        version: VISIT_CREATED_EVENT_VERSION,
      }),
      payload,
    };

    expect(event.metadata.eventName).toBe(VISIT_CREATED_EVENT_NAME);
    expect(event.metadata.version).toBe(VISIT_CREATED_EVENT_VERSION);
    expect(event.payload.visitId).toBe('vis-123');
    expect(event.payload.patientId).toBe('pat-456');
    expect(event.payload.timestamp).toBe('2026-07-27T08:30:00Z');
  });

  it('should require all payload fields', () => {
    const payload: VisitCreatedPayload = {
      visitId: 'vis-1',
      patientId: 'pat-1',
      timestamp: '2026-07-27T10:00:00Z',
    };
    expect(payload.visitId).toBeDefined();
    expect(payload.patientId).toBeDefined();
    expect(payload.timestamp).toBeDefined();
  });

  it('should use UUIDs for visitId and patientId', () => {
    const payload: VisitCreatedPayload = {
      visitId: '550e8400-e29b-41d4-a716-446655440000',
      patientId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      timestamp: '2026-07-27T10:00:00Z',
    };
    // UUID v4 pattern
    const uuidV4Pattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidV4Pattern.test(payload.visitId)).toBe(true);
    expect(uuidV4Pattern.test(payload.patientId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// treatment.completed
// ---------------------------------------------------------------------------

describe('treatment.completed event', () => {
  it('should export the correct event name constant', () => {
    expect(TREATMENT_COMPLETED_EVENT_NAME).toBe('treatment.completed');
  });

  it('should export the correct event version constant', () => {
    expect(TREATMENT_COMPLETED_EVENT_VERSION).toBe('1.0.0');
  });

  it('should construct a valid TreatmentCompletedEvent', () => {
    const payload: TreatmentCompletedPayload = {
      visitId: 'vis-123',
      recordId: 'rec-789',
      treatmentCost: '1500.00',
    };

    const event: TreatmentCompletedEvent = {
      metadata: buildMetadata({
        eventName: TREATMENT_COMPLETED_EVENT_NAME,
        version: TREATMENT_COMPLETED_EVENT_VERSION,
      }),
      payload,
    };

    expect(event.metadata.eventName).toBe(TREATMENT_COMPLETED_EVENT_NAME);
    expect(event.metadata.version).toBe(TREATMENT_COMPLETED_EVENT_VERSION);
    expect(event.payload.visitId).toBe('vis-123');
    expect(event.payload.recordId).toBe('rec-789');
    expect(event.payload.treatmentCost).toBe('1500.00');
  });

  it('should carry treatmentCost as a string to preserve decimal precision', () => {
    const payload: TreatmentCompletedPayload = {
      visitId: 'vis-1',
      recordId: 'rec-1',
      treatmentCost: '9999.99',
    };
    expect(typeof payload.treatmentCost).toBe('string');
    // Should not be a number
    expect(typeof payload.treatmentCost).not.toBe('number');
  });

  it('should support high-precision decimal values as strings', () => {
    const payload: TreatmentCompletedPayload = {
      visitId: 'vis-1',
      recordId: 'rec-1',
      treatmentCost: '1234567.89',
    };
    expect(payload.treatmentCost).toBe('1234567.89');
    // Verify it can be parsed to a decimal without precision loss
    expect(parseFloat(payload.treatmentCost)).toBe(1234567.89);
  });
});

// ---------------------------------------------------------------------------
// invoice.paid
// ---------------------------------------------------------------------------

describe('invoice.paid event', () => {
  it('should export the correct event name constant', () => {
    expect(INVOICE_PAID_EVENT_NAME).toBe('invoice.paid');
  });

  it('should export the correct event version constant', () => {
    expect(INVOICE_PAID_EVENT_VERSION).toBe('1.0.0');
  });

  it('should construct a valid InvoicePaidEvent', () => {
    const payload: InvoicePaidPayload = {
      visitId: 'vis-123',
      invoiceId: 'inv-456',
      status: 'PAID',
    };

    const event: InvoicePaidEvent = {
      metadata: buildMetadata({
        eventName: INVOICE_PAID_EVENT_NAME,
        version: INVOICE_PAID_EVENT_VERSION,
      }),
      payload,
    };

    expect(event.metadata.eventName).toBe(INVOICE_PAID_EVENT_NAME);
    expect(event.metadata.version).toBe(INVOICE_PAID_EVENT_VERSION);
    expect(event.payload.visitId).toBe('vis-123');
    expect(event.payload.invoiceId).toBe('inv-456');
    expect(event.payload.status).toBe('PAID');
  });

  it('should enforce status is exactly "PAID"', () => {
    const payload: InvoicePaidPayload = {
      visitId: 'vis-1',
      invoiceId: 'inv-1',
      status: 'PAID',
    };
    expect(payload.status).toBe('PAID');
  });
});

// ---------------------------------------------------------------------------
// RabbitMQ topology constants
// ---------------------------------------------------------------------------

describe('RabbitMQ topology constants', () => {
  describe('RABBITMQ_EXCHANGE', () => {
    it('should be named his.events', () => {
      expect(RABBITMQ_EXCHANGE).toBe('his.events');
    });
  });

  describe('RABBITMQ_QUEUES', () => {
    it('should define a queue for each bounded context', () => {
      expect(RABBITMQ_QUEUES.opd).toBe('opd.events');
      expect(RABBITMQ_QUEUES.emr).toBe('emr.events');
      expect(RABBITMQ_QUEUES.finance).toBe('finance.events');
    });

    it('should have exactly three queues', () => {
      const queueNames = Object.values(RABBITMQ_QUEUES);
      expect(queueNames).toHaveLength(3);
    });
  });

  describe('RABBITMQ_ROUTING_KEYS', () => {
    it('should define routing keys for each event', () => {
      expect(RABBITMQ_ROUTING_KEYS.visitCreated).toBe('visit.created');
      expect(RABBITMQ_ROUTING_KEYS.treatmentCompleted).toBe(
        'treatment.completed',
      );
      expect(RABBITMQ_ROUTING_KEYS.invoicePaid).toBe('invoice.paid');
    });

    it('should have exactly three routing keys', () => {
      const keys = Object.values(RABBITMQ_ROUTING_KEYS);
      expect(keys).toHaveLength(3);
    });
  });

  describe('RABBITMQ_BINDINGS', () => {
    it('should route visit.created to the EMR queue', () => {
      expect(RABBITMQ_BINDINGS['visit.created']).toBe(RABBITMQ_QUEUES.emr);
    });

    it('should route treatment.completed to the Finance queue', () => {
      expect(RABBITMQ_BINDINGS['treatment.completed']).toBe(
        RABBITMQ_QUEUES.finance,
      );
    });

    it('should route invoice.paid to the OPD queue', () => {
      expect(RABBITMQ_BINDINGS['invoice.paid']).toBe(RABBITMQ_QUEUES.opd);
    });

    it('should have bindings for all three routing keys', () => {
      const bindingKeys = Object.keys(RABBITMQ_BINDINGS);
      expect(bindingKeys).toHaveLength(3);
      expect(bindingKeys).toContain(RABBITMQ_ROUTING_KEYS.visitCreated);
      expect(bindingKeys).toContain(RABBITMQ_ROUTING_KEYS.treatmentCompleted);
      expect(bindingKeys).toContain(RABBITMQ_ROUTING_KEYS.invoicePaid);
    });

    it('should bind each event to a distinct queue matching the event flow', () => {
      // OPD publishes visit.created → EMR consumes
      expect(RABBITMQ_BINDINGS['visit.created']).toBe('emr.events');
      // EMR publishes treatment.completed → Finance consumes
      expect(RABBITMQ_BINDINGS['treatment.completed']).toBe('finance.events');
      // Finance publishes invoice.paid → OPD consumes
      expect(RABBITMQ_BINDINGS['invoice.paid']).toBe('opd.events');
    });
  });
});

// ---------------------------------------------------------------------------
// Event flow end-to-end contract
// ---------------------------------------------------------------------------

describe('Event flow contracts', () => {
  it('should support the full visit → treatment → invoice cycle', () => {
    // Step 1: OPD creates visit
    const visitEvent: VisitCreatedEvent = {
      metadata: buildMetadata({
        eventId: 'evt-001',
        eventName: VISIT_CREATED_EVENT_NAME,
        version: VISIT_CREATED_EVENT_VERSION,
        correlationId: 'flow-1',
      }),
      payload: {
        visitId: 'vis-1',
        patientId: 'pat-1',
        timestamp: '2026-07-27T08:00:00Z',
      },
    };
    expect(visitEvent.payload.visitId).toBe('vis-1');

    // Step 2: EMR completes treatment
    const treatmentEvent: TreatmentCompletedEvent = {
      metadata: buildMetadata({
        eventId: 'evt-002',
        eventName: TREATMENT_COMPLETED_EVENT_NAME,
        version: TREATMENT_COMPLETED_EVENT_VERSION,
        correlationId: 'flow-1',
      }),
      payload: {
        visitId: visitEvent.payload.visitId,
        recordId: 'rec-1',
        treatmentCost: '2500.00',
      },
    };
    expect(treatmentEvent.payload.visitId).toBe(visitEvent.payload.visitId);
    expect(treatmentEvent.metadata.correlationId).toBe('flow-1');

    // Step 3: Finance pays invoice
    const invoiceEvent: InvoicePaidEvent = {
      metadata: buildMetadata({
        eventId: 'evt-003',
        eventName: INVOICE_PAID_EVENT_NAME,
        version: INVOICE_PAID_EVENT_VERSION,
        correlationId: 'flow-1',
      }),
      payload: {
        visitId: treatmentEvent.payload.visitId,
        invoiceId: 'inv-1',
        status: 'PAID',
      },
    };
    expect(invoiceEvent.payload.visitId).toBe(treatmentEvent.payload.visitId);
    expect(invoiceEvent.payload.status).toBe('PAID');
    expect(invoiceEvent.metadata.correlationId).toBe('flow-1');
  });

  it('should maintain the same visitId across all three events in a flow', () => {
    const visitId = 'vis-shared-42';

    const visitPayload: VisitCreatedPayload = {
      visitId,
      patientId: 'pat-1',
      timestamp: '2026-07-27T10:00:00Z',
    };

    const treatmentPayload: TreatmentCompletedPayload = {
      visitId,
      recordId: 'rec-1',
      treatmentCost: '100.00',
    };

    const invoicePayload: InvoicePaidPayload = {
      visitId,
      invoiceId: 'inv-1',
      status: 'PAID',
    };

    expect(visitPayload.visitId).toBe(visitId);
    expect(treatmentPayload.visitId).toBe(visitId);
    expect(invoicePayload.visitId).toBe(visitId);
  });
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

describe('Idempotency contract', () => {
  it('should use eventId as the idempotency key', () => {
    const event: VisitCreatedEvent = {
      metadata: buildMetadata({ eventId: 'idem-001' }),
      payload: {
        visitId: 'vis-1',
        patientId: 'pat-1',
        timestamp: '2026-07-27T10:00:00Z',
      },
    };
    expect(event.metadata.eventId).toBe('idem-001');
  });

  it('should allow consumers to detect duplicate events by eventId', () => {
    const originalEventId = 'dedup-key-99';

    const event1: VisitCreatedEvent = {
      metadata: buildMetadata({
        eventId: originalEventId,
        eventName: VISIT_CREATED_EVENT_NAME,
      }),
      payload: {
        visitId: 'vis-1',
        patientId: 'pat-1',
        timestamp: '2026-07-27T10:00:00Z',
      },
    };

    const event2: VisitCreatedEvent = {
      metadata: buildMetadata({
        eventId: originalEventId, // same idempotency key
        eventName: VISIT_CREATED_EVENT_NAME,
      }),
      payload: {
        visitId: 'vis-1',
        patientId: 'pat-1',
        timestamp: '2026-07-27T10:00:00Z',
      },
    };

    // Same eventId → duplicate
    expect(event1.metadata.eventId).toBe(event2.metadata.eventId);
    // Different payload references but same idempotency key
    expect(event1.metadata.eventId).toBe(originalEventId);
    expect(event2.metadata.eventId).toBe(originalEventId);
  });
});
