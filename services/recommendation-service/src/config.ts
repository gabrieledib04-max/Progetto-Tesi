import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_WEIGHTS } from '@eventspot/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export interface RecommendationConfig {
  nodeEnv: string;
  port: number;
  host: string;
  logLevel: string;

  weights: {
    sessionSemantic: number;
    timeCongruence: number;
    spatialDecay: number;
    weatherCompatibility: number;
  };

  fallbackWeights: {
    time: number;
    spatial: number;
    weather: number;
  };
}

export const config: RecommendationConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || process.env.RECOMMENDATION_PORT || '3002', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',

  weights: {
    sessionSemantic: parseFloat(process.env.WEIGHT_SESSION_SEMANTIC || String(DEFAULT_WEIGHTS.SESSION_SEMANTIC)),
    timeCongruence: parseFloat(process.env.WEIGHT_TIME_CONGRUENCE || String(DEFAULT_WEIGHTS.TIME_CONGRUENCE)),
    spatialDecay: parseFloat(process.env.WEIGHT_SPATIAL_DECAY || String(DEFAULT_WEIGHTS.SPATIAL_DECAY)),
    weatherCompatibility: parseFloat(
      process.env.WEIGHT_WEATHER_COMPATIBILITY || String(DEFAULT_WEIGHTS.WEATHER_COMPATIBILITY)
    ),
  },

  fallbackWeights: {
    time: parseFloat(process.env.FALLBACK_WEIGHT_TIME || String(DEFAULT_WEIGHTS.FALLBACK_TIME)),
    spatial: parseFloat(process.env.FALLBACK_WEIGHT_SPATIAL || String(DEFAULT_WEIGHTS.FALLBACK_SPATIAL)),
    weather: parseFloat(process.env.FALLBACK_WEIGHT_WEATHER || String(DEFAULT_WEIGHTS.FALLBACK_WEATHER)),
  },
};
