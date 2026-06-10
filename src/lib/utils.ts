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

export function getFriendlyErrorMessage(error: unknown, defaultMessage = "Something went wrong"): string {
  if (!error) return defaultMessage;
  
  const errorMessage = (error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error)).toLowerCase();
  
  // Network / Connection
  if (errorMessage.includes("fetch") || errorMessage.includes("network") || errorMessage.includes("failed to fetch")) {
    return "We couldn't connect. Please check your internet connection and try again.";
  }
  
  // Database constraint errors
  if (errorMessage.includes("duplicate key") || errorMessage.includes("unique constraint")) {
    return "This item already exists. Please choose a different name or detail.";
  }
  if (errorMessage.includes("not-null constraint") || errorMessage.includes("null value")) {
    return "Please fill out all required fields before saving.";
  }
  if (errorMessage.includes("violates foreign key")) {
    return "Unable to save because a related item could not be found.";
  }
  
  // Security / Auth
  if (errorMessage.includes("row-level security") || errorMessage.includes("rls")) {
    return "You don't have permission to do this. Please check your account access.";
  }
  if (errorMessage.includes("jwt") || errorMessage.includes("unauthorized") || errorMessage.includes("expired")) {
    return "Your session has expired. Please sign in again.";
  }
  
  // General platform
  if (errorMessage.includes("timeout")) {
    return "The operation took too long. Please try again.";
  }
  if (errorMessage.includes("rate limit") || errorMessage.includes("too many requests")) {
    return "You are doing this too fast. Please wait a moment and try again.";
  }
  if (errorMessage.includes("failed to fetch")) {
    return "Unable to reach the server. Please check your connection.";
  }

  // Common UI Fallbacks
  if (errorMessage.includes("user_id")) {
    return "Please sign in to complete this action.";
  }

  // If it's a generic unhandled supabase error (usually start with cryptic strings), fall back softly.
  // Otherwise, return the message with a capitalized first letter if it's already friendly,
  // or just the default.
  if (errorMessage.length > 100 || errorMessage.includes("uuid") || errorMessage.includes("syntax error")) {
    return defaultMessage;
  }
  
  // If we couldn't match a specific category but the error is short enough, return it formatted better,
  // otherwise return default.
  if (errorMessage !== "[object object]" && errorMessage !== "") {
     if (error instanceof Error) {
         return error.message;
     }
     if (typeof error === "object" && error !== null && "message" in error) {
         return String((error as Error).message);
     }
     return defaultMessage;
  }

  return defaultMessage;
}

