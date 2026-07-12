import { toDateKey, todayKey, type DayOccupancy } from '../model';

export interface CalendarCallbacks {
  onSelectDay: (dateKey: string) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-IE', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Render a month grid (weeks starting Monday). Days touched by bookings are
 * highlighted; stays render as a continuous range bar, flights/cars as dots.
 */
export function renderCalendar(
  container: HTMLElement,
  year: number,
  month: number,
  occupancy: Map<string, DayOccupancy>,
  selectedDate: string,
  callbacks: CalendarCallbacks,
): void {
  const first = new Date(year, month, 1);
  // Monday-based offset of the 1st of the month.
  const leadDays = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - leadDays);
  const today = todayKey();

  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const key = toDateKey(d);
    const occ = occupancy.get(key);
    const classes = ['day-cell'];
    if (d.getMonth() !== month) classes.push('outside');
    if (key === today) classes.push('today');
    if (key === selectedDate) classes.push('selected');

    let dots = '';
    let stayBar = '';
    if (occ) {
      if (occ.cancelledOnly) {
        classes.push('cancelled-only');
      } else {
        classes.push('has-bookings');
        if (occ.hasFlight) dots += '<span class="dot dot-flight"></span>';
        if (occ.hasCar) dots += '<span class="dot dot-car"></span>';
        if (occ.hasAttention) dots += '<span class="dot dot-attention"></span>';
        if (occ.hasStay) {
          const stays = occ.active.filter((b) => b.type === 'stay' && b.status !== 'cancelled');
          const prevKey = toDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
          const nextKey = toDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
          // The bar joins visually with a neighboring day iff some stay spans both.
          const continuesLeft = stays.some((b) => b.startDate <= prevKey && key <= b.endDate);
          const continuesRight = stays.some((b) => b.startDate <= key && nextKey <= b.endDate);
          const barClasses = ['stay-bar'];
          if (!continuesLeft) barClasses.push('bar-start');
          if (!continuesRight) barClasses.push('bar-end');
          stayBar = `<span class="${barClasses.join(' ')}"></span>`;
        }
      }
    }

    cells += `
      <button type="button" class="${classes.join(' ')}" data-date="${key}" aria-label="${key}">
        <span class="day-number">${d.getDate()}</span>
        <span class="day-dots">${dots}</span>
        ${stayBar}
      </button>`;
  }

  container.innerHTML = `
    <div class="weekday-row">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>
    <div class="day-grid">${cells}</div>`;

  container.querySelectorAll<HTMLButtonElement>('.day-cell').forEach((cell) => {
    cell.addEventListener('click', () => callbacks.onSelectDay(cell.dataset.date!));
  });
}
