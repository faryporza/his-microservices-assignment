import { SetMetadata } from '@nestjs/common';

export const RESOURCE_OWNERSHIP_KEY = 'resource_ownership';

export type OwnershipResourceType =
  'patient' | 'visit' | 'medical_record' | 'invoice';

export interface ResourceOwnershipOptions {
  paramKey?: string;
  resourceType: OwnershipResourceType;
}

export const CheckResourceOwnership = (
  resourceType: OwnershipResourceType,
  paramKey = 'id',
) => SetMetadata(RESOURCE_OWNERSHIP_KEY, { resourceType, paramKey });
