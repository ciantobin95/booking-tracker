import {
  formatCost,
  formatDayLong,
  needsAttention,
  type Booking,
} from '../model';
import { esc } from './html';

export interface DayDetailCallbacks {
  onEdit: (booking: Booking) => void;
}

const TYPE_ICONS: Record<string, string> = { flight: '✈️', stay: '🛏️', car: '🚗' };

export function renderDayPanel(
  container: HTMLElement,
  dateKey: string,
  bookings: Booking[],
  callbacks: DayDetailCallbacks,
): void {
  const items = bookings
    .filter((b) => b.startDate <= dateKey && dateKey <= b.endDate)
    .sort((a, b) => sortTime(a, dateKey).localeCompare(sortTime(b, dateKey)));

  const cards = items.length
    ? items.map((b) => bookingCard(b, dateKey)).join('')
    : '<p class="empty-day">No bookings on this day.</p>';

  container.innerHTML = `
    <h2 class="day-heading">${esc(formatDayLong(dateKey))}</h2>
    <div class="booking-cards">${cards}</div>`;

  container.querySelectorAll<HTMLButtonElement>('[data-edit-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const booking = items.find((b) => b.id === btn.dataset.editId);
      if (booking) callbacks.onEdit(booking);
    });
  });
}

function sortTime(b: Booking, dateKey: string): string {
  if (b.type === 'flight') {
    // On the arrival day of an overnight flight, sort by landing time.
    if (b.flight?.arrivesNextDay && dateKey === b.endDate) return b.flight.arrTime ?? '00:00';
    return b.flight?.depTime ?? '99:98';
  }
  if (b.type === 'stay') {
    if (dateKey === b.startDate) return b.stay?.checkInTime ?? '99:97';
    if (dateKey === b.endDate) return b.stay?.checkOutTime ?? '00:01';
    return '00:02';
  }
  if (b.type === 'car') {
    if (dateKey === b.startDate) return b.car?.pickupTime ?? '99:96';
    return '00:03';
  }
  return '99:99';
}

function statusChips(b: Booking): string {
  const chips: string[] = [];
  if (b.status === 'cancelled') chips.push('<span class="chip chip-cancelled">Cancelled</span>');
  if (b.status === 'needs_review') chips.push('<span class="chip chip-warn">Needs review</span>');
  if (b.partial) chips.push('<span class="chip chip-warn">Missing details</span>');
  return chips.join('');
}

function row(label: string, value: string | null | undefined): string {
  if (!value) return '';
  return `<div class="detail-row"><span class="detail-label">${esc(label)}</span><span class="detail-value">${esc(value)}</span></div>`;
}

function footer(b: Booking): string {
  const emailLink = b.gmailMessageId
    ? `<a class="email-link" target="_blank" rel="noopener" href="https://mail.google.com/mail/u/0/#all/${encodeURIComponent(b.gmailMessageId)}">View source email</a>`
    : '';
  return `
    <div class="card-footer">
      ${emailLink}
      <button type="button" class="edit-btn" data-edit-id="${esc(b.id)}">Edit</button>
    </div>`;
}

function bookingCard(b: Booking, dateKey: string): string {
  const cancelled = b.status === 'cancelled' ? ' card-cancelled' : '';
  const attention = needsAttention(b) && b.status !== 'cancelled' ? ' card-attention' : '';
  const inner =
    b.type === 'flight'
      ? flightBody(b, dateKey)
      : b.type === 'stay'
        ? stayBody(b, dateKey)
        : carBody(b, dateKey);
  return `
    <article class="booking-card card-${b.type}${cancelled}${attention}">
      <div class="card-header">
        <span class="card-icon">${TYPE_ICONS[b.type] ?? '📌'}</span>
        <span class="card-title">${esc(b.title)}</span>
        ${statusChips(b)}
      </div>
      ${inner}
      ${footer(b)}
    </article>`;
}

function flightBody(b: Booking, dateKey: string): string {
  const f = b.flight ?? {};
  const nextDay = f.arrivesNextDay ? ' (+1 day)' : '';
  const context =
    f.arrivesNextDay && dateKey === b.endDate
      ? `<p class="card-context">Arrives today${f.arrTime ? ` at ${esc(f.arrTime)}` : ''} — departed ${esc(b.startDate)}</p>`
      : '';
  const route =
    f.depAirportCode || f.arrAirportCode
      ? `<div class="flight-route">
          <div class="route-side"><span class="route-code">${esc(f.depAirportCode ?? '?')}</span><span class="route-time">${esc(f.depTime ?? '')}</span></div>
          <span class="route-arrow">→</span>
          <div class="route-side"><span class="route-code">${esc(f.arrAirportCode ?? '?')}</span><span class="route-time">${esc(f.arrTime ?? '')}${nextDay}</span></div>
        </div>`
      : '';
  return `
    ${context}
    ${route}
    <div class="detail-rows">
      ${row('Airline', f.airline)}
      ${row('Flight', f.flightNumber)}
      ${row('From', joinParts(f.depAirportName, f.depTerminal))}
      ${row('To', joinParts(f.arrAirportName, f.arrTerminal))}
      ${row('Duration', f.durationText)}
      ${row('Fare', f.fareType)}
      ${row('Seat', f.seat)}
      ${row('Bags', (f.bags ?? []).join(' · '))}
      ${row('Passengers', (f.passengers ?? []).join(', '))}
      ${row('Cost', formatCost(b))}
      ${row('Reference', b.confirmationCode)}
      ${row('Notes', b.notes)}
    </div>`;
}

function stayBody(b: Booking, dateKey: string): string {
  const s = b.stay ?? {};
  let context: string;
  if (dateKey === b.startDate) {
    context = `Check-in${s.checkInTime ? ` from ${s.checkInTime}` : ''}`;
  } else if (dateKey === b.endDate) {
    context = `Check-out${s.checkOutTime ? ` until ${s.checkOutTime}` : ''}`;
  } else {
    context = `Staying (${b.startDate} → ${b.endDate})`;
  }
  const pin = s.pin
    ? `<details class="pin-details"><summary>Show ${esc(s.platform ?? 'platform')} PIN</summary><span class="pin-value">${esc(s.pin)}</span></details>`
    : '';
  return `
    <p class="card-context">${esc(context)}</p>
    <div class="detail-rows">
      ${row('Property', s.propertyName)}
      ${row('Address', s.address)}
      ${row('Phone', s.phone)}
      ${row('Platform', s.platform)}
      ${row('Guests', s.guestsText)}
      ${row('Meals', s.mealPlan)}
      ${row('Cancellation', s.cancellationPolicy)}
      ${row('Cost', formatCost(b))}
      ${row('Reference', b.confirmationCode)}
      ${row('Notes', b.notes)}
    </div>
    ${pin}`;
}

function carBody(b: Booking, dateKey: string): string {
  const c = b.car ?? {};
  let context: string;
  if (dateKey === b.startDate) {
    context = `Pick-up${c.pickupTime ? ` at ${c.pickupTime}` : ''}`;
  } else if (dateKey === b.endDate) {
    context = `Drop-off${c.dropoffTime ? ` at ${c.dropoffTime}` : ''}`;
  } else {
    context = `Rental ongoing (${b.startDate} → ${b.endDate})`;
  }
  return `
    <p class="card-context">${esc(context)}</p>
    <div class="detail-rows">
      ${row('Company', c.company)}
      ${row('Pick-up', joinParts(c.pickupLocation, c.pickupTime))}
      ${row('Drop-off', joinParts(c.dropoffLocation, c.dropoffTime))}
      ${row('Cost', formatCost(b))}
      ${row('Reference', b.confirmationCode)}
      ${row('Notes', b.notes)}
    </div>`;
}

function joinParts(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(', ');
}
