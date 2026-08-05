import {
  EventMetadata,
  EventRoutingKey,
  VisitCreatedEvent,
  VisitCreatedPayload,
  visitCreatedEventName,
  visitCreatedEventVersion,
  TreatmentCompletedEvent,
  TreatmentCompletedPayload,
  treatmentCompletedEventName,
  treatmentCompletedEventVersion,
  InvoicePaidEvent,
  InvoicePaidPayload,
  invoicePaidEventName,
  invoicePaidEventVersion,
  rabbitMqExchange,
  rabbitMqQueues,
  rabbitMqRoutingKeys,
  rabbitMqBindings,
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
    eventName: visitCreatedEventName,
    version: visitCreatedEventVersion,
    occurredAt: '2026-08-01T00:00:00.000Z',
    correlationId: 'correlation-id',
    traceId: 'trace-id',
  };

  it('accepts valid optional correlation and trace identifiers', () => {
    expect(
      hasValidEventMetadata(
        metadata,
        visitCreatedEventName,
        visitCreatedEventVersion,
      ),
    ).toBe(true);
  });

  it('rejects blank trace identifiers when supplied', () => {
    expect(
      hasValidEventMetadata(
        { ...metadata, traceId: '   ' },
        visitCreatedEventName,
        visitCreatedEventVersion,
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
    expect(visitCreatedEventName).toBe('visit.created');
  });

  it('should export the correct event version constant', () => {
    expect(visitCreatedEventVersion).toBe('1.0.0');
  });

  it('should construct a valid VisitCreatedEvent', () => {
    const payload: VisitCreatedPayload = {
      visitId: 'vis-123',
      patientId: 'pat-456',
      timestamp: '2026-07-27T08:30:00Z',
    };

    const event: VisitCreatedEvent = {
      metadata: buildMetadata({
        eventName: visitCreatedEventName,
        version: visitCreatedEventVersion,
      }),
      payload,
    };

    expect(event.metadata.eventName).toBe(visitCreatedEventName);
    expect(event.metadata.version).toBe(visitCreatedEventVersion);
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
    expect(treatmentCompletedEventName).toBe('treatment.completed');
  });

  it('should export the correct event version constant', () => {
    expect(treatmentCompletedEventVersion).toBe('1.0.0');
  });

  it('should construct a valid TreatmentCompletedEvent', () => {
    const payload: TreatmentCompletedPayload = {
      visitId: 'vis-123',
      recordId: 'rec-789',
      treatmentCost: '1500.00',
    };

    const event: TreatmentCompletedEvent = {
      metadata: buildMetadata({
        eventName: treatmentCompletedEventName,
        version: treatmentCompletedEventVersion,
      }),
      payload,
    };

    expect(event.metadata.eventName).toBe(treatmentCompletedEventName);
    expect(event.metadata.version).toBe(treatmentCompletedEventVersion);
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
    expect(invoicePaidEventName).toBe('invoice.paid');
  });

  it('should export the correct event version constant', () => {
    expect(invoicePaidEventVersion).toBe('1.0.0');
  });

  it('should construct a valid InvoicePaidEvent', () => {
    const payload: InvoicePaidPayload = {
      visitId: 'vis-123',
      invoiceId: 'inv-456',
      status: 'PAID',
    };

    const event: InvoicePaidEvent = {
      metadata: buildMetadata({
        eventName: invoicePaidEventName,
        version: invoicePaidEventVersion,
      }),
      payload,
    };

    expect(event.metadata.eventName).toBe(invoicePaidEventName);
    expect(event.metadata.version).toBe(invoicePaidEventVersion);
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
  describe('rabbitMqExchange', () => {
    it('should be named his.events', () => {
      expect(rabbitMqExchange).toBe('his.events');
    });
  });

  describe('rabbitMqQueues', () => {
    it('should define a queue for each bounded context', () => {
      expect(rabbitMqQueues.opd).toBe('opd.events');
      expect(rabbitMqQueues.emr).toBe('emr.events');
      expect(rabbitMqQueues.finance).toBe('finance.events');
    });

    it('should have exactly three queues', () => {
      const queueNames = Object.values(rabbitMqQueues);
      expect(queueNames).toHaveLength(3);
    });
  });

  describe('rabbitMqRoutingKeys', () => {
    it('should define routing keys for each event', () => {
      expect(rabbitMqRoutingKeys.visitCreated).toBe('visit.created');
      expect(rabbitMqRoutingKeys.treatmentCompleted).toBe(
        'treatment.completed',
      );
      expect(rabbitMqRoutingKeys.invoicePaid).toBe('invoice.paid');
    });

    it('should have exactly three routing keys', () => {
      const keys = Object.values(rabbitMqRoutingKeys);
      expect(keys).toHaveLength(3);
    });
  });

  describe('rabbitMqBindings', () => {
    it('should route visit.created to the EMR queue', () => {
      expect(rabbitMqBindings['visit.created']).toBe(rabbitMqQueues.emr);
    });

    it('should route treatment.completed to the Finance queue', () => {
      expect(rabbitMqBindings['treatment.completed']).toBe(
        rabbitMqQueues.finance,
      );
    });

    it('should route invoice.paid to the OPD queue', () => {
      expect(rabbitMqBindings['invoice.paid']).toBe(rabbitMqQueues.opd);
    });

    it('should have bindings for all three routing keys', () => {
      const bindingKeys = Object.keys(rabbitMqBindings);
      expect(bindingKeys).toHaveLength(3);
      expect(bindingKeys).toContain(rabbitMqRoutingKeys.visitCreated);
      expect(bindingKeys).toContain(rabbitMqRoutingKeys.treatmentCompleted);
      expect(bindingKeys).toContain(rabbitMqRoutingKeys.invoicePaid);
    });

    it('should bind each event to a distinct queue matching the event flow', () => {
      // OPD publishes visit.created → EMR consumes
      expect(rabbitMqBindings['visit.created']).toBe('emr.events');
      // EMR publishes treatment.completed → Finance consumes
      expect(rabbitMqBindings['treatment.completed']).toBe('finance.events');
      // Finance publishes invoice.paid → OPD consumes
      expect(rabbitMqBindings['invoice.paid']).toBe('opd.events');
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
        eventName: visitCreatedEventName,
        version: visitCreatedEventVersion,
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
        eventName: treatmentCompletedEventName,
        version: treatmentCompletedEventVersion,
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
        eventName: invoicePaidEventName,
        version: invoicePaidEventVersion,
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
        eventName: visitCreatedEventName,
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
        eventName: visitCreatedEventName,
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
