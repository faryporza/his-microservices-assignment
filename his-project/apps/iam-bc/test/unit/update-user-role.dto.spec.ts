import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateUserRoleDTO } from '@apps/iam-bc/modules/user/dto/update-user-role.dto';
import { UserRole } from '@app/common';

describe('UpdateUserRoleDTO', () => {
  function createDTO(partial: Partial<UpdateUserRoleDTO>): UpdateUserRoleDTO {
    return plainToInstance(UpdateUserRoleDTO, {
      role: UserRole.DOCTOR,
      ...partial,
    });
  }

  it('validates valid user roles', async () => {
    for (const role of Object.values(UserRole)) {
      const dto = createDTO({ role });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    }
  });

  it('rejects invalid role strings', async () => {
    const dto = createDTO({ role: 'SUPER_ADMIN' as unknown as UserRole });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it('rejects empty role', async () => {
    const dto = createDTO({ role: undefined });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });
});
