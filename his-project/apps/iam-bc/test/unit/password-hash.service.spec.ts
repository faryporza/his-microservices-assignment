import { PasswordHashService } from '@apps/iam-bc/modules/auth/services/password-hash.service';

describe('PasswordHashService', () => {
  let service: PasswordHashService;

  beforeEach(() => {
    service = new PasswordHashService();
  });

  it('should hash a password and verify successfully', async () => {
    const rawPassword = 'StrongP@ssw0rd!';
    const hash = await service.hashPassword(rawPassword);

    expect(hash).toBeDefined();
    expect(hash).not.toEqual(rawPassword);

    const isMatch = await service.verifyPassword(rawPassword, hash);
    expect(isMatch).toBe(true);
  });

  it('should return false when verifying an incorrect password', async () => {
    const rawPassword = 'StrongP@ssw0rd!';
    const hash = await service.hashPassword(rawPassword);

    const isMatch = await service.verifyPassword('WrongPassword123!', hash);
    expect(isMatch).toBe(false);
  });
});
