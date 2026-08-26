import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '@apps/iam-bc/modules/user/controllers/users.controller';
import { UsersService } from '@apps/iam-bc/modules/user/services/users.service';
import { JwtAuthGuard, RolesGuard, UserRole } from '@app/common';
import { User } from '@apps/iam-bc/modules/user/entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const sampleUser: User = {
    id: 'user-uuid-1',
    username: 'dr_watson',
    email: 'watson@baker.st',
    password_hash: 'hashed_password_123',
    first_name: 'John',
    last_name: 'Watson',
    role: UserRole.DOCTOR,
    is_active: true,
    created_at: new Date('2026-08-25T12:00:00Z'),
    updated_at: new Date('2026-08-25T12:00:00Z'),
  };

  beforeEach(async () => {
    usersService = {
      updateRole: jest.fn().mockResolvedValue(sampleUser),
    } as unknown as jest.Mocked<UsersService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('updates a user role and returns formatted JSON:API resource', async () => {
    const result = await controller.updateRole('user-uuid-1', {
      role: UserRole.DOCTOR,
    });

    expect(usersService.updateRole).toHaveBeenCalledWith(
      'user-uuid-1',
      UserRole.DOCTOR,
    );
    expect(result).toEqual({
      data: {
        id: 'user-uuid-1',
        type: 'users',
        attributes: {
          username: 'dr_watson',
          email: 'watson@baker.st',
          first_name: 'John',
          last_name: 'Watson',
          role: UserRole.DOCTOR,
          is_active: true,
          created_at: sampleUser.created_at,
          updated_at: sampleUser.updated_at,
        },
      },
    });
  });
});
