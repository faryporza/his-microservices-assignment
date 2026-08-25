import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AuthController } from '@apps/iam-bc/modules/auth/controllers/auth.controller';
import { AuthService } from '@apps/iam-bc/modules/auth/services/auth.service';
import { UserRole } from '@app/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const sanitizedUser = {
    id: 'user-uuid-1',
    username: 'dr_watson',
    email: 'watson@baker.st',
    first_name: 'John',
    last_name: 'Watson',
    role: UserRole.DOCTOR,
    is_active: true,
    created_at: new Date('2026-08-25T12:00:00Z'),
    updated_at: new Date('2026-08-25T12:00:00Z'),
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn().mockResolvedValue(sanitizedUser),
    } as unknown as jest.Mocked<AuthService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register and return user without password_hash', async () => {
      const dto = {
        username: 'dr_watson',
        email: 'watson@baker.st',
        password: 'Password123!',
        first_name: 'John',
        last_name: 'Watson',
        role: UserRole.DOCTOR,
      };

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(sanitizedUser);
      expect((result as Record<string, unknown>).password_hash).toBeUndefined();
    });

    it('should propagate ConflictException from service', async () => {
      authService.register.mockRejectedValueOnce(
        new ConflictException('Username already registered'),
      );

      const dto = {
        username: 'dr_watson',
        email: 'watson@baker.st',
        password: 'Password123!',
        first_name: 'John',
        last_name: 'Watson',
      };

      await expect(controller.register(dto)).rejects.toThrow(ConflictException);
    });
  });
});
