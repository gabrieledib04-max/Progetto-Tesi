import mongoose, { Schema, Document } from 'mongoose';
import { config } from '../config.js';
import { TTL_SECONDS } from '@eventspot/shared';

// Interface definitions
export interface IAuthAttempt extends Document {
  state: string;
  codeVerifier: string;
  createdAt: Date;
}

export interface ISession extends Document {
  sessionIdHash: string;
  spotifyUserHash: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  tokenExpiresAt: Date;
  lastActiveAt: Date;
}

// Schemas with native TTL indexes as required by EventSpot_TRD.md Section 4.1
const AuthAttemptSchema = new Schema<IAuthAttempt>({
  state: { type: String, required: true, unique: true },
  codeVerifier: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: TTL_SECONDS.AUTH_ATTEMPT }, // 600s = 10m
});

const SessionSchema = new Schema<ISession>({
  sessionIdHash: { type: String, required: true, unique: true },
  spotifyUserHash: { type: String, required: true },
  encryptedAccessToken: { type: String, required: true },
  encryptedRefreshToken: { type: String, required: true },
  tokenExpiresAt: { type: Date, required: true },
  lastActiveAt: { type: Date, default: Date.now, expires: TTL_SECONDS.SESSION }, // 86400s = 24h
});

export const AuthAttemptModel =
  mongoose.models.AuthAttempt || mongoose.model<IAuthAttempt>('AuthAttempt', AuthAttemptSchema, 'auth_attempts');

export const SessionModel =
  mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema, 'sessions');

let isConnected = false;
let isInMemoryFallback = false;

// In-memory store fallback for zero-friction standalone tests if Mongo is unreachable
export const inMemoryGatewayStore = {
  authAttempts: new Map<string, { state: string; codeVerifier: string; createdAt: Date }>(),
  sessions: new Map<
    string,
    {
      sessionIdHash: string;
      spotifyUserHash: string;
      encryptedAccessToken: string;
      encryptedRefreshToken: string;
      tokenExpiresAt: Date;
      lastActiveAt: Date;
    }
  >(),
};

export async function connectGatewayDatabase(): Promise<boolean> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 2000,
    });
    isConnected = true;
    isInMemoryFallback = false;
    console.log(`[api-gateway] Connected to MongoDB at ${config.mongodbUri}`);
    return true;
  } catch (err: any) {
    console.warn(`[api-gateway] MongoDB connection failed (${err.message}). Using In-Memory Gateway Store.`);
    isConnected = false;
    isInMemoryFallback = true;
    return false;
  }
}

export function isGatewayDbInMemory(): boolean {
  return isInMemoryFallback;
}
