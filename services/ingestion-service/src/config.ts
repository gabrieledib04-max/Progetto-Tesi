import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

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
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  },

  ticketmaster: {
    apiKey: process.env.TICKETMASTER_API_KEY || '',
    baseUrl: 'https://app.ticketmaster.com/discovery/v2',
  },

  openMeteo: {
    baseUrl: process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1/forecast',
  },

  lastFm: {
    apiKey: process.env.LASTFM_API_KEY,
  },

  mockExternalProviders:
    process.env.MOCK_EXTERNAL_PROVIDERS === 'true' || !process.env.TICKETMASTER_API_KEY,
};
