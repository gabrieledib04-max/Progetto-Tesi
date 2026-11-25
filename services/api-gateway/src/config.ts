import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load from local .env or root .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const rawSpotifyClientId = (process.env.SPOTIFY_CLIENT_ID || '').trim();
const rawSpotifyClientSecret = (process.env.SPOTIFY_CLIENT_SECRET || '').trim();
const hasValidSpotifyCreds = Boolean(
  rawSpotifyClientId && !rawSpotifyClientId.startsWith('your_')
);

export interface GatewayConfig {
  nodeEnv: string;
  port: number;
  host: string;
  logLevel: string;
  clientUrl: string;

  mongodbUri: string;
  ingestionServiceUrl: string;
  recommendationServiceUrl: string;

  tokenEncryptionKey: string; // 32 bytes hex = 64 characters
  sessionSecret: string;
  cookieSecret: string;

  spotify: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string;
  };

  mockExternalProviders: boolean;
}

export const config: GatewayConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || process.env.GATEWAY_PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  // Use 127.0.0.1 by default so cookies match Spotify's loopback IP redirect policy (no localhost)
  clientUrl: process.env.CLIENT_URL || 'http://127.0.0.1:5173',

  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/eventspot',
  ingestionServiceUrl: process.env.INGESTION_SERVICE_URL || 'http://localhost:3001',
  recommendationServiceUrl: process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:3002',

  // Ensure default dev key is valid 64-char hex string (32 bytes)
  tokenEncryptionKey:
    process.env.TOKEN_ENCRYPTION_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  sessionSecret: process.env.SESSION_SECRET || 'eventspot_session_secret_min_32_characters_random',
  cookieSecret: process.env.COOKIE_SECRET || 'eventspot_cookie_secret_min_32_characters_random',

  spotify: {
    clientId: hasValidSpotifyCreds ? rawSpotifyClientId : '',
    clientSecret: rawSpotifyClientSecret.startsWith('your_') ? '' : rawSpotifyClientSecret,
    // Spotify forbids "localhost"; loopback IP 127.0.0.1 is required for local HTTP OAuth callbacks
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3000/v1/auth/callback',
    scopes:
      process.env.SPOTIFY_SCOPES ||
      'user-read-recently-played user-read-currently-playing',
  },

  mockExternalProviders:
    process.env.MOCK_EXTERNAL_PROVIDERS === 'true' || !hasValidSpotifyCreds,
};
