import mongoose, { Schema, Document } from 'mongoose';
import { config } from '../config.js';
import { TTL_SECONDS, NormalizedEvent, SessionTag } from '@eventspot/shared';

// 1. Session Context Cache (TTL: 15 minutes)
export interface ISessionContextDoc extends Document {
  sessionIdHash: string;
  tags: SessionTag[];
  artistNames: string[];
  trackCount: number;
  fetchedAt: Date;
}

const SessionContextSchema = new Schema<ISessionContextDoc>({
  sessionIdHash: { type: String, required: true, unique: true },
  tags: [{ name: { type: String, required: true }, weight: { type: Number, required: true } }],
  artistNames: [{ type: String }],
  trackCount: { type: Number, default: 0 },
  fetchedAt: { type: Date, default: Date.now, expires: TTL_SECONDS.SESSION_CONTEXT_CACHE }, // 900s
});

export const SessionContextModel =
  mongoose.models.SessionContext ||
  mongoose.model<ISessionContextDoc>('SessionContext', SessionContextSchema, 'session_context_cache');

// 2. Events Cache (fresh 6h, stale-if-error 24h, TTL: 24h)
export interface IEventsCacheDoc extends Document {
  cacheKey: string;
  events: NormalizedEvent[];
  freshUntil: Date;
  staleUntil: Date;
}

const EventsCacheSchema = new Schema<IEventsCacheDoc>({
  cacheKey: { type: String, required: true, unique: true },
  events: { type: Schema.Types.Mixed, required: true },
  freshUntil: { type: Date, required: true },
  staleUntil: { type: Date, required: true, expires: TTL_SECONDS.EVENTS_STALE_MAX }, // 86400s
});

export const EventsCacheModel =
  mongoose.models.EventsCache ||
  mongoose.model<IEventsCacheDoc>('EventsCache', EventsCacheSchema, 'events_cache');

// 3. Weather Cache (TTL: 1 hour on geohash4)
export interface IWeatherCacheDoc extends Document {
  geohash4: string;
  current: {
    wmoCode: number;
    precipMm: number;
    tempC: number;
    isAdverse: boolean;
  };
  fetchedAt: Date;
}

const WeatherCacheSchema = new Schema<IWeatherCacheDoc>({
  geohash4: { type: String, required: true, unique: true },
  current: {
    wmoCode: { type: Number, required: true },
    precipMm: { type: Number, required: true },
    tempC: { type: Number, required: true },
    isAdverse: { type: Boolean, required: true },
  },
  fetchedAt: { type: Date, default: Date.now, expires: TTL_SECONDS.WEATHER_CACHE }, // 3600s
});

export const WeatherCacheModel =
  mongoose.models.WeatherCache ||
  mongoose.model<IWeatherCacheDoc>('WeatherCache', WeatherCacheSchema, 'weather_cache');

// In-Memory Fallback Store
export const inMemoryIngestionStore = {
  sessionContexts: new Map<string, { tags: SessionTag[]; artistNames: string[]; trackCount: number; fetchedAt: Date }>(),
  events: new Map<string, { events: NormalizedEvent[]; freshUntil: Date; staleUntil: Date }>(),
  weather: new Map<string, { current: { wmoCode: number; precipMm: number; tempC: number; isAdverse: boolean }; fetchedAt: Date }>(),
};

let isConnected = false;
let isInMemory = false;

export async function connectIngestionDatabase(): Promise<boolean> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 2000,
    });
    isConnected = true;
    isInMemory = false;
    console.log(`[ingestion-service] Connected to MongoDB at ${config.mongodbUri}`);
    return true;
  } catch (err: any) {
    console.warn(`[ingestion-service] MongoDB connection failed (${err.message}). Using In-Memory Ingestion Store.`);
    isConnected = false;
    isInMemory = true;
    return false;
  }
}

export function isIngestionDbInMemory(): boolean {
  return isInMemory;
}
