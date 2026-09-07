// Remembers trips this browser has created, joined, or opened, purely as a
// local convenience so a repeat user doesn't have to hang on to the link or
// code — nothing here is sent to the server or shared between browsers.
const STORAGE_KEY = 'sama_rata_trips_history';
const MAX_TRIPS = 20;

export function loadTripsHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveTripsHistory(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked (private browsing, disabled site data) — the
    // list just won't persist this time; nothing else depends on it.
  }
}

// Adds/updates a trip at the front of the list (most-recently-visited first).
export function rememberTrip({ slug, joinCode, name, currency }) {
  if (!slug) return;
  const list = loadTripsHistory().filter((trip) => trip.slug !== slug);
  list.unshift({ slug, joinCode, name, currency, lastVisitedAt: Date.now() });
  saveTripsHistory(list.slice(0, MAX_TRIPS));
}

export function forgetTrip(slug) {
  saveTripsHistory(loadTripsHistory().filter((trip) => trip.slug !== slug));
}
