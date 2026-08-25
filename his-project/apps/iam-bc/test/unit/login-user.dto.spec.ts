import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginUserDTO } from '@apps/iam-bc/modules/auth/dto/login-user.dto';

describe('LoginUserDTO', () => {
  function createDTO(partial: Partial<LoginUserDTO>): LoginUserDTO {
    return plainToInstance(LoginUserDTO, {
      username: 'dr_watson',
      password: 'Password123!',
      ...partial,
    });
  }

  it('should validate a valid login payload', async () => {
    const dto = createDTO({});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject missing username', async () => {
    const dto = createDTO({ username: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('should reject missing password', async () => {
    const dto = createDTO({ password: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
