import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserRole } from '@app/common';

export interface CreateUserData {
  username: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role?: UserRole;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(data: CreateUserData): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: [{ username: data.username }, { email: data.email }],
    });

    if (existing) {
      if (existing.username === data.username) {
        throw new ConflictException('Username already registered');
      }
      throw new ConflictException('Email already registered');
    }

    const user = this.userRepository.create({
      username: data.username,
      email: data.email,
      password_hash: data.password_hash,
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.role ?? UserRole.PATIENT,
      is_active: true,
    });

    return this.userRepository.save(user);
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByUsernameOrEmail(identifier: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: [{ username: identifier }, { email: identifier }],
    });
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    const user = await this.findById(id);
    user.role = role;
    return this.userRepository.save(user);
  }

  async updatePatientId(id: string, patientId: string): Promise<User> {
    const user = await this.findById(id);
    if (user.role !== UserRole.PATIENT) {
      throw new BadRequestException(
        'Only a PATIENT account can be linked to a patient identity',
      );
    }
    user.patient_id = patientId;
    try {
      return await this.userRepository.save(user);
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Patient is already linked to a user');
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === '23505'
    );
  }
}
