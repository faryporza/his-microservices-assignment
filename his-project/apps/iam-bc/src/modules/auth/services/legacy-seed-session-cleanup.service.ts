import { Injectable, OnModuleInit } from '@nestjs/common';
import { RedisService, StructuredLogger } from '@app/common';
import { LEGACY_SEED_USERNAMES } from './legacy-seed-identifiers';

/**
 * Revokes Redis sessions left by the credentials removed from the production
 * migration. Jest/E2E uses an in-memory Redis double and intentionally skips
 * this production cleanup hook.
 */
@Injectable()
export class LegacySeedSessionCleanupService implements OnModuleInit {
  private readonly logger = new StructuredLogger('iam-bc');

  constructor(private readonly redisService: RedisService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;

    const revoked = await this.redisService.revokeSessionsByUsernames(
      LEGACY_SEED_USERNAMES,
    );
    this.logger.log({
      message: 'Legacy test-account sessions revoked',
      context: {
        action: 'REVOKE_LEGACY_TEST_SESSIONS',
        revoked_count: revoked,
      },
    });
  }
}
