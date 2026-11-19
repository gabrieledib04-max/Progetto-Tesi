import crypto from 'crypto';
import {
  AuthAttemptModel,
  SessionModel,
  inMemoryGatewayStore,
  isGatewayDbInMemory,
} from '../db/mongodb.js';
import { cryptoService } from './crypto.service.js';
import { spotifyPkceService } from './spotify-pkce.service.js';
import { config } from '../config.js';

export interface ValidatedSession {
  sessionIdHash: string;
  spotifyUserHash: string;
  accessToken: string;
  tokenExpiresAt: Date;
}

export class SessionService {
  // In-memory mutex for serialized token refresh per session (NFR-R1)
  private readonly refreshLocks = new Map<string, Promise<string>>();

  /**
   * Saves an OAuth 2.0 PKCE auth attempt (TTL: 10 minutes)
   */
  async createAuthAttempt(state: string, codeVerifier: string): Promise<void> {
    if (isGatewayDbInMemory()) {
      inMemoryGatewayStore.authAttempts.set(state, {
        state,
        codeVerifier,
        createdAt: new Date(),
      });
      return;
    }

    await AuthAttemptModel.create({
      state,
      codeVerifier,
      createdAt: new Date(),
    });
  }

  /**
   * Atomically consumes (validates and deletes) an auth attempt
   */
  async consumeAuthAttempt(state: string): Promise<string | null> {
    if (isGatewayDbInMemory()) {
      const attempt = inMemoryGatewayStore.authAttempts.get(state);
      if (!attempt) return null;
      inMemoryGatewayStore.authAttempts.delete(state);
      return attempt.codeVerifier;
    }

    const doc = await AuthAttemptModel.findOneAndDelete({ state });
    return doc ? doc.codeVerifier : null;
  }

  /**
   * Creates a new encrypted session in MongoDB
   */
  async createSession(params: {
    rawSessionId: string;
    spotifyUserId: string;
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
  }): Promise<{ sessionIdHash: string; spotifyUserHash: string }> {
    const sessionIdHash = cryptoService.hashSha256(params.rawSessionId);
    const spotifyUserHash = cryptoService.pseudonymizeSpotifyUser(params.spotifyUserId);
    const encryptedAccessToken = cryptoService.encrypt(params.accessToken);
    const encryptedRefreshToken = cryptoService.encrypt(params.refreshToken);
    const tokenExpiresAt = new Date(Date.now() + params.expiresInSeconds * 1000);
    const lastActiveAt = new Date();

    if (isGatewayDbInMemory()) {
      inMemoryGatewayStore.sessions.set(sessionIdHash, {
        sessionIdHash,
        spotifyUserHash,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        lastActiveAt,
      });
      return { sessionIdHash, spotifyUserHash };
    }

    await SessionModel.findOneAndUpdate(
      { sessionIdHash },
      {
        $set: {
          spotifyUserHash,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          lastActiveAt,
        },
      },
      { upsert: true, new: true }
    );

    return { sessionIdHash, spotifyUserHash };
  }

  /**
   * Resolves and verifies a session from raw cookie.
   * If access token is expired, performs serialized refresh (NFR-R1).
   */
  async resolveValidSession(rawSessionId: string): Promise<ValidatedSession | null> {
    const sessionIdHash = cryptoService.hashSha256(rawSessionId);

    let sessionData: {
      sessionIdHash: string;
      spotifyUserHash: string;
      encryptedAccessToken: string;
      encryptedRefreshToken: string;
      tokenExpiresAt: Date;
      lastActiveAt: Date;
    } | null = null;

    if (isGatewayDbInMemory()) {
      const s = inMemoryGatewayStore.sessions.get(sessionIdHash);
      if (s) {
        s.lastActiveAt = new Date(); // update sliding window
        sessionData = s;
      }
    } else {
      const doc = await SessionModel.findOneAndUpdate(
        { sessionIdHash },
        { $set: { lastActiveAt: new Date() } },
        { new: true }
      ).lean();
      if (doc) {
        sessionData = doc as any;
      }
    }

    if (!sessionData) {
      return null;
    }

    // Check if token is expired or about to expire in next 60 seconds
    const now = Date.now();
    const isExpired = new Date(sessionData.tokenExpiresAt).getTime() - now < 60000;

    if (!isExpired) {
      const decryptedToken = cryptoService.decrypt(sessionData.encryptedAccessToken);
      return {
        sessionIdHash: sessionData.sessionIdHash,
        spotifyUserHash: sessionData.spotifyUserHash,
        accessToken: decryptedToken,
        tokenExpiresAt: sessionData.tokenExpiresAt,
      };
    }

    // Token needs refresh: apply serialized refresh lock (NFR-R1)
    const refreshedToken = await this.serializedTokenRefresh(sessionIdHash, sessionData);
    return {
      sessionIdHash: sessionData.sessionIdHash,
      spotifyUserHash: sessionData.spotifyUserHash,
      accessToken: refreshedToken,
      tokenExpiresAt: sessionData.tokenExpiresAt,
    };
  }

  /**
   * Serialized token refresh per session ID (prevents thundering herd on concurrent requests)
   */
  private async serializedTokenRefresh(sessionIdHash: string, sessionData: any): Promise<string> {
    const existingLock = this.refreshLocks.get(sessionIdHash);
    if (existingLock) {
      return existingLock;
    }

    const refreshPromise = (async () => {
      try {
        const rawRefreshToken = cryptoService.decrypt(sessionData.encryptedRefreshToken);
        const { accessToken, expiresIn } = await spotifyPkceService.refreshAccessToken(rawRefreshToken);

        const newEncryptedAccess = cryptoService.encrypt(accessToken);
        const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

        if (isGatewayDbInMemory()) {
          const s = inMemoryGatewayStore.sessions.get(sessionIdHash);
          if (s) {
            s.encryptedAccessToken = newEncryptedAccess;
            s.tokenExpiresAt = newExpiresAt;
          }
        } else {
          await SessionModel.updateOne(
            { sessionIdHash },
            {
              $set: {
                encryptedAccessToken: newEncryptedAccess,
                tokenExpiresAt: newExpiresAt,
              },
            }
          );
        }

        sessionData.tokenExpiresAt = newExpiresAt;
        return accessToken;
      } catch (err: any) {
        // NFR-R2: If refresh fails, invalidate session
        await this.destroySession(sessionIdHash);
        throw err;
      } finally {
        this.refreshLocks.delete(sessionIdHash);
      }
    })();

    this.refreshLocks.set(sessionIdHash, refreshPromise);
    return refreshPromise;
  }

  /**
   * Destroys a session (Logout)
   */
  async destroySession(sessionIdHash: string): Promise<void> {
    if (isGatewayDbInMemory()) {
      inMemoryGatewayStore.sessions.delete(sessionIdHash);
      return;
    }
    await SessionModel.deleteOne({ sessionIdHash });
  }

  /**
   * Purges all user data across services (GDPR Right to Erasure / FR-02 / US-09)
   */
  async deleteUserAccount(sessionIdHash: string): Promise<void> {
    await this.destroySession(sessionIdHash);

    // Notify ingestion service to purge context cache
    try {
      await fetch(`${config.ingestionServiceUrl}/internal/context/cache/${sessionIdHash}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      console.warn(`[api-gateway] Could not notify ingestion service of cache purge: ${err.message}`);
    }
  }
}

export const sessionService = new SessionService();
