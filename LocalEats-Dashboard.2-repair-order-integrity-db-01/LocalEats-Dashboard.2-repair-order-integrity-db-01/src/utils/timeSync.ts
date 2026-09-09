// Network & Internet Time Sync Utility
// Ensures shop operating hours, timestamps, and order lifecycles rely on synchronized internet time rather than the client device clock.

let timeOffsetMs = 0;
let isInitialized = false;

/**
 * Synchronizes client time with internet time APIs or server HTTP Date headers.
 */
export async function initTimeSync(): Promise<number> {
  const startTime = Date.now();
  
  // 1. Try primary worldtimeapi REST API endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    
    const response = await fetch("https://worldtimeapi.org/api/ip", {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.utc_datetime) {
        const serverUtcMs = new Date(data.utc_datetime).getTime();
        const endTime = Date.now();
        const latency = Math.max(0, (endTime - startTime) / 2);
        timeOffsetMs = (serverUtcMs + latency) - Date.now();
        isInitialized = true;
        console.log(`[TimeSync] Internet time offset established: ${timeOffsetMs}ms`);
        return timeOffsetMs;
      }
    }
  } catch {
    // Fallback if worldtimeapi is blocked or unreachable
  }

  // 2. Fallback to current host HEAD response Date header
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(window.location.origin, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const dateHeader = response.headers.get("Date");
    if (dateHeader) {
      const serverMs = new Date(dateHeader).getTime();
      timeOffsetMs = serverMs - Date.now();
      isInitialized = true;
      console.log(`[TimeSync] Server Date header offset established: ${timeOffsetMs}ms`);
      return timeOffsetMs;
    }
  } catch {
    // Safe fallback: zero offset
  }

  isInitialized = true;
  return timeOffsetMs;
}

/**
 * Returns current timestamp in ms adjusted for internet/server time offset.
 */
export function getNetworkTimestamp(): number {
  return Date.now() + timeOffsetMs;
}

/**
 * Returns current Date object synchronized with internet time.
 */
export function getNetworkDate(): Date {
  return new Date(getNetworkTimestamp());
}

/**
 * Returns ISO string of current network time.
 */
export function getNetworkISOString(): string {
  return getNetworkDate().toISOString();
}

/**
 * Formats current network time as HH:mm string.
 */
export function getNetworkFormattedTimeHHMM(): string {
  const d = getNetworkDate();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function isTimeSyncReady(): boolean {
  return isInitialized;
}

// Auto-initialize background time sync on module load
if (typeof window !== "undefined") {
  initTimeSync().catch(() => {});
  
  // Re-sync every 15 minutes to account for device clock drift
  setInterval(() => {
    initTimeSync().catch(() => {});
  }, 15 * 60 * 1000);
}
