import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getEstimatedMinutes(distanceKm: number): number {
  // Assuming average cycling speed of 15km/h including traffic/stops
  const speedKmPerMin = 15 / 60;
  return Math.max(2, Math.round(distanceKm / speedKmPerMin) + 2); // adding 2 mins buffer
}
