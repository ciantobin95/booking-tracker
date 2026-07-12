import { formatDayShort, needsAttention, type Booking } from '../model';
import { esc } from './html';

export interface ReviewCallbacks {
  onEdit: (booking: Booking) => void;
  onJumpToDay: (dateKey: string) => void;
}

/** Bookings the automation couldn't fully parse, waiting for a human. */
export function reviewCount(bookings: Booking[]): number {
  return bookings.filter((b) => needsAttention(b) && b.status !== 'cancelled').length;
}

export function openReviewList(bookings: Booking[], callbacks: ReviewCallbacks): void {
  const items = bookings.filter((b) => needsAttention(b) && b.status !== 'cancelled');
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet-dialog';
  document.body.appendChild(dialog);

  const rows = items.length
    ? items
        .map(
          (b) => `
            <li class="review-item">
              <button type="button" class="review-jump" data-date="${esc(b.startDate)}">
                <span class="review-title">${esc(b.title || '(untitled booking)')}</span>
                <span class="review-sub">${esc(formatDayShort(b.startDate))}${b.sender ? ` · via ${esc(b.sender)}` : ''}</span>
              </button>
              <button type="button" class="edit-btn" data-review-edit="${esc(b.id)}">Fix</button>
            </li>`,
        )
        .join('')
    : '<p class="empty-day">Nothing needs review. The scanner will add items here when an email can\'t be fully parsed.</p>';

  dialog.innerHTML = `
    <div class="booking-form">
      <div class="form-header">
        <h2>Needs review</h2>
        <button type="button" class="icon-btn" data-close>Close</button>
      </div>
      <ul class="review-list">${rows}</ul>
    </div>`;

  dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
  dialog.querySelectorAll<HTMLButtonElement>('[data-review-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const booking = items.find((b) => b.id === btn.dataset.reviewEdit);
      dialog.close();
      if (booking) callbacks.onEdit(booking);
    });
  });
  dialog.querySelectorAll<HTMLButtonElement>('.review-jump').forEach((btn) => {
    btn.addEventListener('click', () => {
      dialog.close();
      callbacks.onJumpToDay(btn.dataset.date!);
    });
  });

  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
}
