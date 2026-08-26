import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { SessionMetadata } from './redis.types';
import { StructuredLogger } from '../logging/structured.logger';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new StructuredLogger('redis-service');

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly client: Redis,
  ) {}

  getClient(): Redis {
    return this.client;
  }

  async createSession(
    userId: string,
    sessionId: string,
    meta: SessionMetadata,
    ttlSeconds: number,
  ): Promise<void> {
    const sessionKey = this.getSessionKey(userId, sessionId);
    const userSessionsKey = this.getUserSessionsKey(userId);

    await this.client.set(sessionKey, JSON.stringify(meta), 'EX', ttlSeconds);
    await this.client.sadd(userSessionsKey, sessionId);
    await this.client.expire(userSessionsKey, ttlSeconds);
  }

  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<SessionMetadata | null> {
    const sessionKey = this.getSessionKey(userId, sessionId);
    const raw = await this.client.get(sessionKey);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as SessionMetadata;
    } catch {
      return null;
    }
  }

  async updateSessionRefreshToken(
    userId: string,
    sessionId: string,
    newRefreshTokenJti: string,
  ): Promise<void> {
    const sessionKey = this.getSessionKey(userId, sessionId);
    const existing = await this.getSession(userId, sessionId);

    if (!existing) {
      throw new Error(`Session ${sessionKey} not found`);
    }

    const remainingTtl = await this.client.ttl(sessionKey);
    const updated: SessionMetadata = {
      ...existing,
      refreshTokenJti: newRefreshTokenJti,
    };

    if (remainingTtl > 0) {
      await this.client.set(
        sessionKey,
        JSON.stringify(updated),
        'EX',
        remainingTtl,
      );
    } else {
      await this.client.set(sessionKey, JSON.stringify(updated));
    }
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const sessionKey = this.getSessionKey(userId, sessionId);
    const userSessionsKey = this.getUserSessionsKey(userId);

    await this.client.del(sessionKey);
    await this.client.srem(userSessionsKey, sessionId);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    const sessionIds = await this.client.smembers(userSessionsKey);

    if (sessionIds.length > 0) {
      const keysToDelete = sessionIds.map((sid) =>
        this.getSessionKey(userId, sid),
      );
      for (const key of keysToDelete) {
        await this.client.del(key);
      }
    }

    await this.client.del(userSessionsKey);
  }

  /**
   * Removes sessions whose stored identity matches a retired/legacy username.
   * This is intentionally scan-based because the username is metadata and is
   * not part of the Redis key. It is used by one-time security cleanup, not by
   * request-path authentication.
   */
  async revokeSessionsByUsernames(
    usernames: ReadonlySet<string>,
  ): Promise<number> {
    let cursor = '0';
    let revoked = 0;

    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        'auth:session:*',
        'COUNT',
        '100',
      );
      cursor = nextCursor;

      for (const key of keys) {
        const match = /^auth:session:([^:]+):(.+)$/.exec(key);
        if (!match) continue;

        const raw = await this.client.get(key);
        if (!raw) continue;

        let metadata: SessionMetadata;
        try {
          metadata = JSON.parse(raw) as SessionMetadata;
        } catch {
          continue;
        }

        if (!usernames.has(metadata.username)) continue;

        await this.revokeSession(metadata.userId, match[2]);
        revoked += 1;
      }
    } while (cursor !== '0');

    return revoked;
  }

  async blacklistAccessToken(jti: string, ttlSeconds: number): Promise<void> {
    const blacklistKey = this.getBlacklistKey(jti);
    const ttl = Math.max(1, Math.floor(ttlSeconds));
    await this.client.set(blacklistKey, 'revoked', 'EX', ttl);
  }

  async isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    const blacklistKey = this.getBlacklistKey(jti);
    const exists = await this.client.exists(blacklistKey);
    return exists === 1;
  }

  async incrementRateLimitCounter(
    key: string,
    ttlSeconds: number,
  ): Promise<number> {
    const rateLimitKey = `auth:ratelimit:${key}`;
    const count = await this.client.incr(rateLimitKey);

    if (count === 1) {
      await this.client.expire(rateLimitKey, ttlSeconds);
    }

    return count;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.client && typeof this.client.quit === 'function') {
        await this.client.quit();
      }
    } catch {
      // ignore on shutdown
    }
  }

  private getSessionKey(userId: string, sessionId: string): string {
    return `auth:session:${userId}:${sessionId}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `auth:user_sessions:${userId}`;
  }

  private getBlacklistKey(jti: string): string {
    return `auth:blacklist:${jti}`;
  }
}
