export type BookingType = 'flight' | 'stay' | 'car';
export type BookingStatus = 'confirmed' | 'cancelled' | 'needs_review';

export interface FlightDetails {
  airline?: string;
  flightNumber?: string;
  depAirportCode?: string;
  depAirportName?: string;
  depTerminal?: string;
  arrAirportCode?: string;
  arrAirportName?: string;
  arrTerminal?: string;
  depTime?: string;
  arrTime?: string;
  arrivesNextDay?: boolean;
  fareType?: string;
  durationText?: string;
  seat?: string;
  bags?: string[];
  passengers?: string[];
}

export interface StayDetails {
  propertyName?: string;
  address?: string;
  phone?: string;
  platform?: string;
  pin?: string;
  checkInTime?: string;
  checkOutTime?: string;
  guestsText?: string;
  mealPlan?: string;
  cancellationPolicy?: string;
}

export interface CarDetails {
  company?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupTime?: string;
  dropoffTime?: string;
}

export interface HistoryEntry {
  at: string;
  note: string;
}

export interface Booking {
  id: string;
  type: BookingType;
  status: BookingStatus;
  partial?: boolean;
  title: string;
  confirmationCode: string | null;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD, >= startDate */
  endDate: string;
  costAmount: number | null;
  costCurrency: string;
  costScope: 'booking' | 'reservation';
  source: 'manual' | 'gmail';
  sender: string | null;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  notes?: string;
  history?: HistoryEntry[];
  flight?: FlightDetails;
  stay?: StayDetails;
  car?: CarDetails;
}

// ---------------------------------------------------------------------------
// Date helpers. All dates are plain YYYY-MM-DD strings interpreted in the
// device's local calendar; no timezone conversion happens anywhere.
// ---------------------------------------------------------------------------

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function isValidDateKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && !isNaN(fromDateKey(key).getTime());
}

/** Every day a booking touches, from startDate to endDate inclusive. */
export function bookingDays(b: Booking): string[] {
  const days: string[] = [];
  let cursor = b.startDate;
  // Guard against corrupt ranges so one bad document can't hang the UI.
  for (let i = 0; i < 366 && cursor <= b.endDate; i++) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export interface DayOccupancy {
  active: Booking[];
  hasConfirmed: boolean;
  hasFlight: boolean;
  hasStay: boolean;
  hasCar: boolean;
  hasAttention: boolean;
  cancelledOnly: boolean;
}

/** Index bookings by every day they touch, for calendar highlighting. */
export function buildOccupancy(bookings: Booking[]): Map<string, DayOccupancy> {
  const map = new Map<string, DayOccupancy>();
  for (const b of bookings) {
    for (const day of bookingDays(b)) {
      let occ = map.get(day);
      if (!occ) {
        occ = {
          active: [],
          hasConfirmed: false,
          hasFlight: false,
          hasStay: false,
          hasCar: false,
          hasAttention: false,
          cancelledOnly: true,
        };
        map.set(day, occ);
      }
      occ.active.push(b);
      if (b.status !== 'cancelled') {
        occ.cancelledOnly = false;
        if (b.type === 'flight') occ.hasFlight = true;
        if (b.type === 'stay') occ.hasStay = true;
        if (b.type === 'car') occ.hasCar = true;
        if (b.status === 'needs_review' || b.partial) occ.hasAttention = true;
        else occ.hasConfirmed = true;
      }
    }
  }
  return map;
}

export function needsAttention(b: Booking): boolean {
  return b.status === 'needs_review' || b.partial === true;
}

export function formatCost(b: Booking): string | null {
  if (b.costAmount == null) return null;
  const symbol = b.costCurrency === 'EUR' ? '€' : `${b.costCurrency} `;
  const amount = `${symbol}${b.costAmount.toFixed(2)}`;
  return b.costScope === 'reservation' ? `${amount} (reservation total)` : amount;
}

export function formatDayLong(key: string): string {
  return fromDateKey(key).toLocaleDateString('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDayShort(key: string): string {
  return fromDateKey(key).toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
