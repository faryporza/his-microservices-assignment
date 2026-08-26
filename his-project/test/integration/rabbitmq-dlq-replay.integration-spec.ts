import { RabbitMqReplayService } from '@app/common';
import { ConfigService } from '@nestjs/config';

describe('RabbitMQ DLQ Topology & Replay CLI (R9)', () => {
  let service: RabbitMqReplayService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      getOrThrow: jest
        .fn()
        .mockReturnValue('amqp://guest:guest@localhost:5672'),
      get: jest.fn().mockReturnValue('his.events'),
    } as unknown as jest.Mocked<ConfigService>;

    service = new RabbitMqReplayService(mockConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('handles empty DLQ gracefully without errors', async () => {
    // If RabbitMQ is not connected in unit mode, replay should catch error safely
    const result = await service.replayDlqMessages('opd.events.dlq');
    expect(result).toBeDefined();
    expect(typeof result.replayedCount).toBe('number');
  });
});
