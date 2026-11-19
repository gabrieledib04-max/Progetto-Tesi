import { TimeSlot } from '@eventspot/shared';

/**
 * Computes Temporal Congruence combining date proximity and weekday-hour slot matching
 * (Huang et al., Electronics, 2020)
 * Range: [0.0, 1.0]
 */
export function computeTemporalCongruence(
  currentTimeSlot: TimeSlot,
  eventStartIso: string
): number {
  const eventDate = new Date(eventStartIso);
  const now = new Date();

  // 1. Proximity score: exponential decay over days into the future
  const diffMs = eventDate.getTime() - now.getTime();
  const deltaDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));

  // gamma = 0.04: ~0.92 for 2 days, ~0.75 for 7 days, ~0.57 for 14 days, ~0.30 for 30 days
  const proximityScore = Math.exp(-0.04 * deltaDays);

  // 2. Weekday-Hour Slot Match
  const eventDay = eventDate.getDay();
  const eventHour = eventDate.getHours() || 21; // concerts usually start 20-21
  const isEventWeekend = eventDay === 0 || eventDay === 5 || eventDay === 6;
  const isEventEvening = eventHour >= 18;

  let slotMatch = 0.6; // baseline

  // Weekend-to-Weekend matching
  if (currentTimeSlot.isWeekend && isEventWeekend) {
    slotMatch += 0.25;
  } else if (!currentTimeSlot.isWeekend && !isEventWeekend) {
    slotMatch += 0.15;
  }

  // Evening concert alignment
  if (isEventEvening) {
    slotMatch += 0.15;
  }

  slotMatch = Math.min(1.0, slotMatch);

  // 3. Combined weighted temporal congruence (60% proximity, 40% slot match)
  const score = 0.60 * proximityScore + 0.40 * slotMatch;
  return Math.min(1.0, Math.max(0.0, Math.round(score * 1000) / 1000));
}
