import type { User } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/firestore';
import { deleteBooking, saveBooking, watchBookings } from '../db';
import { signOutUser } from '../firebase';
import {
  buildOccupancy,
  fromDateKey,
  todayKey,
  type Booking,
} from '../model';
import { monthLabel, renderCalendar } from './calendar';
import { renderDayPanel } from './dayDetail';
import { openBookingForm } from './forms';
import { esc } from './html';
import { openReviewList, reviewCount } from './review';
import { openSettings } from './settings';

interface AppState {
  bookings: Booking[];
  year: number;
  month: number;
  selectedDate: string;
  syncError: string | null;
}

let unsubscribe: Unsubscribe | null = null;

export function renderApp(root: HTMLElement, user: User): void {
  const today = todayKey();
  const state: AppState = {
    bookings: [],
    year: fromDateKey(today).getFullYear(),
    month: fromDateKey(today).getMonth(),
    selectedDate: today,
    syncError: null,
  };

  root.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <span class="app-title">Booking Tracker</span>
        <div class="header-actions">
          <button type="button" id="review-btn" class="icon-btn" hidden>Review <span class="badge"></span></button>
          <button type="button" id="settings-btn" class="icon-btn" title="Settings">⚙︎</button>
        </div>
      </header>
      <div id="sync-banner" class="sync-banner" hidden></div>
      <main class="app-main">
        <section class="month-bar">
          <button type="button" id="prev-month" class="icon-btn" aria-label="Previous month">‹</button>
          <button type="button" id="month-label" class="month-label" title="Jump to today"></button>
          <button type="button" id="next-month" class="icon-btn" aria-label="Next month">›</button>
        </section>
        <section id="calendar" class="calendar"></section>
        <section id="day-panel" class="day-panel"></section>
      </main>
      <button type="button" id="add-fab" class="fab" aria-label="Add booking">＋</button>
    </div>`;

  const calendarEl = root.querySelector<HTMLElement>('#calendar')!;
  const dayPanelEl = root.querySelector<HTMLElement>('#day-panel')!;
  const monthLabelEl = root.querySelector<HTMLButtonElement>('#month-label')!;
  const syncBanner = root.querySelector<HTMLElement>('#sync-banner')!;
  const reviewBtn = root.querySelector<HTMLButtonElement>('#review-btn')!;

  function goToDay(dateKey: string): void {
    state.selectedDate = dateKey;
    const d = fromDateKey(dateKey);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    rerender();
  }

  function editBooking(booking: Booking): void {
    openBookingForm({
      booking,
      defaultDate: state.selectedDate,
      onSave: async (b) => {
        await saveBooking(user.uid, b);
      },
      onDelete: async (b) => {
        await deleteBooking(user.uid, b.id);
      },
    });
  }

  function rerender(): void {
    monthLabelEl.textContent = monthLabel(state.year, state.month);
    const occupancy = buildOccupancy(state.bookings);
    renderCalendar(calendarEl, state.year, state.month, occupancy, state.selectedDate, {
      onSelectDay: goToDay,
    });
    renderDayPanel(dayPanelEl, state.selectedDate, state.bookings, {
      onEdit: editBooking,
    });

    const pending = reviewCount(state.bookings);
    reviewBtn.hidden = pending === 0;
    reviewBtn.querySelector('.badge')!.textContent = String(pending);

    if (state.syncError) {
      syncBanner.hidden = false;
      syncBanner.innerHTML = `Sync problem: ${esc(state.syncError)}`;
    } else {
      syncBanner.hidden = true;
    }
  }

  root.querySelector('#prev-month')!.addEventListener('click', () => {
    state.month -= 1;
    if (state.month < 0) {
      state.month = 11;
      state.year -= 1;
    }
    rerender();
  });
  root.querySelector('#next-month')!.addEventListener('click', () => {
    state.month += 1;
    if (state.month > 11) {
      state.month = 0;
      state.year += 1;
    }
    rerender();
  });
  monthLabelEl.addEventListener('click', () => goToDay(todayKey()));

  root.querySelector('#add-fab')!.addEventListener('click', () => {
    openBookingForm({
      defaultDate: state.selectedDate,
      onSave: async (b) => {
        await saveBooking(user.uid, b);
      },
    });
  });

  reviewBtn.addEventListener('click', () => {
    openReviewList(state.bookings, {
      onEdit: editBooking,
      onJumpToDay: goToDay,
    });
  });

  root.querySelector('#settings-btn')!.addEventListener('click', () => {
    openSettings(user, {
      onSignOut: async () => {
        unsubscribe?.();
        unsubscribe = null;
        await signOutUser();
      },
    });
  });

  unsubscribe?.();
  unsubscribe = watchBookings(
    user.uid,
    (bookings) => {
      state.bookings = bookings;
      state.syncError = null;
      rerender();
    },
    (err) => {
      state.syncError = err.message;
      rerender();
    },
  );

  rerender();
}
