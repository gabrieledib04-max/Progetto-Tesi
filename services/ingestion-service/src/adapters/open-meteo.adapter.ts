import { WeatherCondition } from '@eventspot/shared';
import { encodeGeohash } from '../utils/geohash.js';
import {
  WeatherCacheModel,
  inMemoryIngestionStore,
  isIngestionDbInMemory,
} from '../db/mongodb.js';
import { config } from '../config.js';

export class OpenMeteoAdapter {
  /**
   * Fetches weather forecast and adverse weather condition with 1-hour cache
   */
  async getWeather(lat: number, lon: number): Promise<WeatherCondition> {
    const geohash4 = encodeGeohash(lat, lon, 4);

    // 1. Check cache
    const cached = await this.getCachedWeather(geohash4);
    if (cached) {
      return {
        ...cached,
        isAvailable: true,
      };
    }

    if (config.mockExternalProviders) {
      const mockResult: WeatherCondition = {
        wmoCode: 2, // partly cloudy
        precipMm: 0,
        tempC: 18,
        isAdverse: false,
        isAvailable: true,
      };
      await this.saveCachedWeather(geohash4, mockResult);
      return mockResult;
    }

    // 2. Outgoing call to Open-Meteo API with 1.5s timeout (NFR-R5)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const url = new URL(config.openMeteo.baseUrl);
      url.searchParams.set('latitude', lat.toString());
      url.searchParams.set('longitude', lon.toString());
      url.searchParams.set('current', 'temperature_2m,precipitation,weather_code');
      url.searchParams.set('timezone', 'auto');

      const res = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Open-Meteo returned status ${res.status}`);
      }

      const data = (await res.json()) as any;
      const current = data.current || {};
      const wmoCode = Number(current.weather_code) || 0;
      const precipMm = Number(current.precipitation) || 0;
      const tempC = Number(current.temperature_2m) || 18;

      // WMO Weather interpretation codes:
      // 51-67: Drizzle & Rain
      // 71-77: Snow
      // 80-82: Rain showers
      // 95-99: Thunderstorm
      const isAdverse = wmoCode >= 51 || precipMm >= 1.0;

      const condition: WeatherCondition = {
        wmoCode,
        precipMm,
        tempC,
        isAdverse,
        isAvailable: true,
      };

      await this.saveCachedWeather(geohash4, condition);
      return condition;
    } catch (err: any) {
      console.warn(`[OpenMeteoAdapter] Weather fetch failed (${err.message}). Graceful fallback.`);
      // NFR-R5: Zero-out impact, mark unavailable
      return {
        wmoCode: 0,
        precipMm: 0,
        tempC: 18,
        isAdverse: false,
        isAvailable: false,
      };
    }
  }

  private async getCachedWeather(geohash4: string): Promise<Omit<WeatherCondition, 'isAvailable'> | null> {
    if (isIngestionDbInMemory()) {
      const entry = inMemoryIngestionStore.weather.get(geohash4);
      if (!entry) return null;
      if (Date.now() - entry.fetchedAt.getTime() > 3600 * 1000) {
        inMemoryIngestionStore.weather.delete(geohash4);
        return null;
      }
      return entry.current;
    }

    const doc = (await WeatherCacheModel.findOne({ geohash4 }).lean()) as any;
    if (!doc) return null;
    return doc.current;
  }

  private async saveCachedWeather(geohash4: string, condition: WeatherCondition): Promise<void> {
    const payload = {
      wmoCode: condition.wmoCode,
      precipMm: condition.precipMm,
      tempC: condition.tempC,
      isAdverse: condition.isAdverse,
    };

    if (isIngestionDbInMemory()) {
      inMemoryIngestionStore.weather.set(geohash4, {
        current: payload,
        fetchedAt: new Date(),
      });
      return;
    }

    await WeatherCacheModel.findOneAndUpdate(
      { geohash4 },
      { $set: { current: payload, fetchedAt: new Date() } },
      { upsert: true }
    );
  }
}

export const openMeteoAdapter = new OpenMeteoAdapter();
