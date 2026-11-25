import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const rawSpotifyClientId = (process.env.SPOTIFY_CLIENT_ID || '').trim();
const rawSpotifyClientSecret = (process.env.SPOTIFY_CLIENT_SECRET || '').trim();
const rawTicketmasterKey = (process.env.TICKETMASTER_API_KEY || '').trim();
const rawLastFmKey = (process.env.LASTFM_API_KEY || '').trim();

const clean = (val: string) => (val && !val.startsWith('your_') ? val : '');

export interface IngestionConfig {
  nodeEnv: string;
  port: number;
  host: string;
  logLevel: string;
  mongodbUri: string;

  spotify: {
    clientId: string;
    clientSecret: string;
  };

  ticketmaster: {
    apiKey: string;
    baseUrl: string;
  };

  openMeteo: {
    baseUrl: string;
  };

  lastFm: {
    apiKey?: string;
  };

  mockExternalProviders: boolean;
}

export const config: IngestionConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || process.env.INGESTION_PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/eventspot',

  spotify: {
    clientId: clean(rawSpotifyClientId),
    clientSecret: clean(rawSpotifyClientSecret),
  },

  ticketmaster: {
    apiKey: clean(rawTicketmasterKey),
    baseUrl: 'https://app.ticketmaster.com/discovery/v2',
  },

  openMeteo: {
    baseUrl: process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1/forecast',
  },

  lastFm: {
    apiKey: clean(rawLastFmKey) || undefined,
  },

  // Stay in mock mode unless explicitly enabled via MOCK_EXTERNAL_PROVIDERS=false
  // (Individual adapters also check if their specific API key / accessToken is present)
  mockExternalProviders: process.env.MOCK_EXTERNAL_PROVIDERS !== 'false',
};
