import { Test } from '@nestjs/testing';
import { createTestApp, createTestingModule } from './testing.helpers';

describe('testing helpers', () => {
  it('creates a testing module and an app with strict validation', async () => {
    const module = await createTestingModule([], []).compile();
    const app = createTestApp(module);

    expect(app).toBeDefined();
    await app.close();
  });

  it('remains compatible with Nest testing modules', async () => {
    const module = await Test.createTestingModule({}).compile();
    expect(module).toBeDefined();
    await module.close();
  });
});
