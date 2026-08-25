import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterUserDTO } from '@apps/iam-bc/modules/auth/dto/register-user.dto';
import { UserRole } from '@app/common';

describe('RegisterUserDTO', () => {
  function createDTO(partial: Partial<RegisterUserDTO>): RegisterUserDTO {
    return plainToInstance(RegisterUserDTO, {
      username: 'john_doe',
      email: 'john@example.com',
      password: 'Password123!',
      first_name: 'John',
      last_name: 'Doe',
      role: UserRole.DOCTOR,
      ...partial,
    });
  }

  it('should validate a valid registration payload', async () => {
    const dto = createDTO({});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should allow optional role and default properly', async () => {
    const dto = createDTO({ role: undefined });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject invalid role enum', async () => {
    const dto = createDTO({ role: 'SUPER_HERO' as unknown as UserRole });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it('should reject short username (< 3 characters)', async () => {
    const dto = createDTO({ username: 'ab' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('should reject invalid email format', async () => {
    const dto = createDTO({ email: 'not-an-email' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('should reject weak password (< 8 chars)', async () => {
    const dto = createDTO({ password: 'Pass1' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('should reject password missing uppercase or numbers', async () => {
    const dto = createDTO({ password: 'alllowercaseletters' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('should reject missing first_name or last_name', async () => {
    const dto1 = createDTO({ first_name: '' });
    const errors1 = await validate(dto1);
    expect(errors1.some((e) => e.property === 'first_name')).toBe(true);

    const dto2 = createDTO({ last_name: '' });
    const errors2 = await validate(dto2);
    expect(errors2.some((e) => e.property === 'last_name')).toBe(true);
  });
});
