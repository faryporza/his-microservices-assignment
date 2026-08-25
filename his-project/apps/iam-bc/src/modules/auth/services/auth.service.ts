import { Injectable } from '@nestjs/common';
import { UsersService } from '../../user/services/users.service';
import { PasswordHashService } from './password-hash.service';
import { RegisterUserDTO } from '../dto/register-user.dto';
import { StructuredLogger, UserRole } from '@app/common';

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new StructuredLogger('auth-service');

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHashService: PasswordHashService,
  ) {}

  async register(dto: RegisterUserDTO): Promise<UserResponse> {
    const passwordHash = await this.passwordHashService.hashPassword(
      dto.password,
    );

    const user = await this.usersService.create({
      username: dto.username,
      email: dto.email,
      password_hash: passwordHash,
      first_name: dto.first_name,
      last_name: dto.last_name,
      role: dto.role ?? UserRole.PATIENT,
    });

    this.logger.log({
      message: 'User registered successfully',
      context: {
        action: 'USER_REGISTERED',
        user_id: user.id,
        username: user.username,
        role: user.role,
      },
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
