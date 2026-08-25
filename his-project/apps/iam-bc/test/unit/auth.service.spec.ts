import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AuthService } from '@apps/iam-bc/modules/auth/services/auth.service';
import { UsersService } from '@apps/iam-bc/modules/user/services/users.service';
import { PasswordHashService } from '@apps/iam-bc/modules/auth/services/password-hash.service';
import { UserRole } from '@app/common';
import { User } from '@apps/iam-bc/modules/user/entities/user.entity';

describe('AuthService - Register', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let passwordHashService: jest.Mocked<PasswordHashService>;

  const mockUser: User = {
    id: 'user-uuid-1',
    username: 'dr_watson',
    email: 'watson@baker.st',
    password_hash: 'hashed_secret',
    first_name: 'John',
    last_name: 'Watson',
    role: UserRole.DOCTOR,
    is_active: true,
    created_at: new Date('2026-08-25T12:00:00Z'),
    updated_at: new Date('2026-08-25T12:00:00Z'),
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn().mockResolvedValue(mockUser),
      findByUsernameOrEmail: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    passwordHashService = {
      hashPassword: jest.fn().mockResolvedValue('hashed_secret'),
      verifyPassword: jest.fn(),
    } as unknown as jest.Mocked<PasswordHashService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PasswordHashService, useValue: passwordHashService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should hash password and create user, returning user without password_hash', async () => {
    const result = await service.register({
      username: 'dr_watson',
      email: 'watson@baker.st',
      password: 'Password123!',
      first_name: 'John',
      last_name: 'Watson',
      role: UserRole.DOCTOR,
    });

    expect(passwordHashService.hashPassword).toHaveBeenCalledWith(
      'Password123!',
    );
    expect(usersService.create).toHaveBeenCalledWith({
      username: 'dr_watson',
      email: 'watson@baker.st',
      password_hash: 'hashed_secret',
      first_name: 'John',
      last_name: 'Watson',
      role: UserRole.DOCTOR,
    });

    expect((result as Record<string, unknown>).password_hash).toBeUndefined();
    expect(result.id).toBe('user-uuid-1');
    expect(result.username).toBe('dr_watson');
    expect(result.email).toBe('watson@baker.st');
  });

  it('should propagate ConflictException when username/email is already taken', async () => {
    usersService.create.mockRejectedValueOnce(
      new ConflictException('Username already registered'),
    );

    await expect(
      service.register({
        username: 'dr_watson',
        email: 'watson@baker.st',
        password: 'Password123!',
        first_name: 'John',
        last_name: 'Watson',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
