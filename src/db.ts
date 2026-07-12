import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Booking } from './model';

function bookingsCollection(uid: string) {
  return collection(db(), 'users', uid, 'bookings');
}

/**
 * Live-subscribe to all of a user's bookings. The dataset is small (a personal
 * travel history), so we load it whole and filter client-side; combined with
 * Firestore's persistent cache this also gives instant offline rendering.
 */
export function watchBookings(
  uid: string,
  onChange: (bookings: Booking[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    bookingsCollection(uid),
    (snapshot) => {
      const bookings: Booking[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as Omit<Booking, 'id'>;
        bookings.push({ ...data, id: d.id });
      });
      bookings.sort((a, b) =>
        a.startDate === b.startDate
          ? (a.flight?.depTime ?? a.stay?.checkInTime ?? '').localeCompare(
              b.flight?.depTime ?? b.stay?.checkInTime ?? '',
            )
          : a.startDate.localeCompare(b.startDate),
      );
      onChange(bookings);
    },
    onError,
  );
}

/** Create or update a booking. Manual entries get an `m_`-prefixed random ID. */
export async function saveBooking(uid: string, booking: Booking): Promise<string> {
  const id = booking.id || `m_${doc(bookingsCollection(uid)).id}`;
  const { id: _ignored, ...data } = booking;
  await setDoc(
    doc(bookingsCollection(uid), id),
    { ...prune(data), updatedAt: serverTimestamp() },
    { merge: false },
  );
  return id;
}

export async function deleteBooking(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(bookingsCollection(uid), id));
}

/** Firestore rejects `undefined` values; strip them (recursively) before writes. */
function prune<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(prune) as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = prune(v);
    }
    return out as T;
  }
  return value;
}
