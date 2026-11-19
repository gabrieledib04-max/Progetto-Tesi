import { NormalizedEvent, SubScores, ContextVector } from '@eventspot/shared';

export interface ExplanationResult {
  reasons: string[];
  naturalLanguageReason: string;
}

/**
 * Generates transparent white-box explanation based on active contextual drivers
 * (Pagano et al., ACM RecSys, 2016; Huang et al., 2020)
 */
export function generateExplanation(
  event: NormalizedEvent,
  context: ContextVector,
  subScores: SubScores,
  distanceKm: number
): ExplanationResult {
  const reasons: string[] = [];

  // 1. Semantic / Music Reason
  if (!context.isSessionEmpty && subScores.semanticSim > 0.3) {
    const matchingArtists = event.artistNames.filter((ea) =>
      context.sessionArtists.some((sa) => sa.toLowerCase() === ea.toLowerCase())
    );

    if (matchingArtists.length > 0) {
      reasons.push(`Artista (${matchingArtists.join(', ')}) presente nella tua sessione recente`);
    } else {
      // Find matching genre tags
      const matchingGenres = event.genres.filter((eg) =>
        context.sessionTags.some((st) => st.name.toLowerCase() === eg.toLowerCase())
      );
      if (matchingGenres.length > 0) {
        reasons.push(`Affine ai generi del tuo ascolto odierno (${matchingGenres.slice(0, 2).join(', ')})`);
      } else {
        reasons.push('Compatibile con il profilo musicale della tua sessione');
      }
    }
  } else if (context.isSessionEmpty) {
    reasons.push('Selezionato in base alla vicinanza e popolarità locale');
  }

  // 2. Spatial Reason
  if (distanceKm <= 10) {
    reasons.push(`A soli ${distanceKm} km dalla tua posizione (${event.venue.city})`);
  } else if (distanceKm <= 35) {
    reasons.push(`Facilmente raggiungibile (${distanceKm} km, ${event.venue.city})`);
  } else {
    reasons.push(`A circa ${distanceKm} km da te (${event.venue.city})`);
  }

  // 3. Temporal Reason
  const eventDate = new Date(event.startDateTime);
  const diffDays = Math.max(0, (eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 4) {
    reasons.push('Concerto in programma questo weekend');
  } else if (diffDays <= 14) {
    reasons.push('Data imminente nelle prossime due settimane');
  }

  // 4. Weather Reason
  if (context.weather.isAvailable) {
    if (context.weather.isAdverse && !event.venue.isOutdoor) {
      reasons.push(`Venue al coperto (${event.venue.name}), protetta dal meteo previsto`);
    } else if (!context.weather.isAdverse && event.venue.isOutdoor) {
      reasons.push(`Live all'aperto con meteo favorevole previsto`);
    }
  }

  // Form single cohesive sentence
  const naturalLanguageReason = reasons.join('; ') + '.';

  return {
    reasons,
    naturalLanguageReason,
  };
}
