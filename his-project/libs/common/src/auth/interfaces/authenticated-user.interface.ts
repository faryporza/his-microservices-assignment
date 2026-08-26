import { UserRole } from '../constants/user-roles.enum';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: UserRole;
  sessionId?: string;
  jti?: string;
  email?: string;
  patient_id?: string;
}
