import { WeatherCondition } from '@eventspot/shared';

/**
 * Computes Weather Compatibility score based on indoor vs outdoor venue classification
 * Range: [0.0, 1.0]
 */
export function computeWeatherCompatibility(
  weather: WeatherCondition,
  isOutdoor: boolean
): number {
  if (!weather.isAvailable) {
    return 0.50; // Neutral baseline when weather service is unreachable
  }

  if (weather.isAdverse) {
    // Adverse weather (rain / thunderstorm / snow)
    if (isOutdoor) {
      return 0.20; // Penalize open-air concert in rain
    } else {
      return 1.00; // Bonus for warm indoor club/arena on a rainy evening
    }
  } else {
    // Favorable weather
    return 0.85; // Positive for both outdoor and indoor events
  }
}
