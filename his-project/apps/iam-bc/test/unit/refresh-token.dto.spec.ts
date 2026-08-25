import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RefreshTokenDTO } from '@apps/iam-bc/modules/auth/dto/refresh-token.dto';

describe('RefreshTokenDTO', () => {
  function createDTO(partial: Partial<RefreshTokenDTO>): RefreshTokenDTO {
    return plainToInstance(RefreshTokenDTO, {
      refresh_token: 'valid.refresh.token',
      ...partial,
    });
  }

  it('should validate a valid refresh token payload', async () => {
    const dto = createDTO({});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject missing refresh_token', async () => {
    const dto = createDTO({ refresh_token: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'refresh_token')).toBe(true);
  });
});
