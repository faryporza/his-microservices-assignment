import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from '@apps/iam-bc/modules/user/services/users.service';
import { User } from '@apps/iam-bc/modules/user/entities/user.entity';
import { UserRole } from '@app/common';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };

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
    mockUserRepository = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue(sampleUser),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new user when username and email are unique', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.create({
        username: 'dr_watson',
        email: 'watson@baker.st',
        password_hash: 'hashed_password_123',
        first_name: 'John',
        last_name: 'Watson',
        role: UserRole.DOCTOR,
      });

      expect(mockUserRepository.findOne).toHaveBeenCalled();
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        username: 'dr_watson',
        email: 'watson@baker.st',
        password_hash: 'hashed_password_123',
        first_name: 'John',
        last_name: 'Watson',
        role: UserRole.DOCTOR,
        is_active: true,
      });
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toEqual(sampleUser);
    });

    it('should throw ConflictException when username already exists', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({
        username: 'dr_watson',
        email: 'other@baker.st',
      });

      await expect(
        service.create({
          username: 'dr_watson',
          email: 'watson@baker.st',
          password_hash: 'pass',
          first_name: 'John',
          last_name: 'Watson',
        }),
      ).rejects.toThrow(new ConflictException('Username already registered'));
    });

    it('should throw ConflictException when email already exists', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({
        username: 'other_user',
        email: 'watson@baker.st',
      });

      await expect(
        service.create({
          username: 'dr_watson',
          email: 'watson@baker.st',
          password_hash: 'pass',
          first_name: 'John',
          last_name: 'Watson',
        }),
      ).rejects.toThrow(new ConflictException('Email already registered'));
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(sampleUser);

      const result = await service.findById('user-uuid-1');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
      expect(result).toEqual(sampleUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByUsernameOrEmail', () => {
    it('should query by username and email and return user', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(sampleUser);

      const result = await service.findByUsernameOrEmail('dr_watson');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: [{ username: 'dr_watson' }, { email: 'dr_watson' }],
      });
      expect(result).toEqual(sampleUser);
    });
  });
});
