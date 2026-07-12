import {
  addDays,
  isValidDateKey,
  type Booking,
  type BookingType,
} from '../model';
import { esc } from './html';

export interface BookingFormOptions {
  /** When set, we're editing; otherwise creating. */
  booking?: Booking;
  defaultDate: string;
  onSave: (booking: Booking) => Promise<void>;
  onDelete?: (booking: Booking) => Promise<void>;
}

/**
 * Phone-friendly add/edit form in a <dialog>. When editing, fields not shown
 * in the form (e.g. parser-extracted extras like fare type or cancellation
 * policy) are preserved: the form mutates a copy of the original document
 * instead of rebuilding it.
 */
export function openBookingForm(options: BookingFormOptions): void {
  const existing = options.booking;
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet-dialog';
  document.body.appendChild(dialog);

  let type: BookingType = existing?.type ?? 'flight';

  function fieldValue(name: string): string {
    const el = dialog.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      `[name="${name}"]`,
    );
    return el ? el.value.trim() : '';
  }

  function checked(name: string): boolean {
    return dialog.querySelector<HTMLInputElement>(`[name="${name}"]`)?.checked ?? false;
  }

  function render(): void {
    const b = existing;
    const isEdit = !!b;
    dialog.innerHTML = `
      <form method="dialog" class="booking-form">
        <div class="form-header">
          <h2>${isEdit ? 'Edit booking' : 'Add booking'}</h2>
          <button type="button" class="icon-btn" data-close>Close</button>
        </div>
        ${
          isEdit
            ? ''
            : `<div class="type-switch" role="tablist">
                ${(['flight', 'stay', 'car'] as BookingType[])
                  .map(
                    (t) =>
                      `<button type="button" role="tab" data-type="${t}" class="type-tab${t === type ? ' active' : ''}">${
                        t === 'flight' ? '✈️ Flight' : t === 'stay' ? '🛏️ Stay' : '🚗 Car'
                      }</button>`,
                  )
                  .join('')}
              </div>`
        }
        <div class="form-fields">
          ${typeFields(type, b, options.defaultDate)}
          <label>Cost (EUR)
            <input name="costAmount" type="number" step="0.01" min="0" inputmode="decimal"
              value="${b?.costAmount != null ? esc(String(b.costAmount)) : ''}" placeholder="e.g. 179.25" />
          </label>
          <label>Booking reference
            <input name="confirmationCode" type="text" autocapitalize="characters"
              value="${esc(b?.confirmationCode ?? '')}" placeholder="e.g. 2BVFSJ" />
          </label>
          <label>Notes
            <textarea name="notes" rows="2">${esc(b?.notes ?? '')}</textarea>
          </label>
          <label>Status
            <select name="status">
              <option value="confirmed" ${b?.status !== 'cancelled' ? 'selected' : ''}>Confirmed</option>
              <option value="cancelled" ${b?.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </label>
        </div>
        <p class="form-error" hidden></p>
        <div class="form-actions">
          ${isEdit && options.onDelete ? '<button type="button" class="danger-btn" data-delete>Delete</button>' : ''}
          <button type="button" class="primary-btn" data-save>${isEdit ? 'Save changes' : 'Add booking'}</button>
        </div>
      </form>`;

    dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
    dialog.querySelectorAll<HTMLButtonElement>('.type-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        type = tab.dataset.type as BookingType;
        render();
      });
    });

    const errorEl = dialog.querySelector<HTMLElement>('.form-error')!;

    dialog.querySelector('[data-save]')!.addEventListener('click', async () => {
      const result = collect();
      if (typeof result === 'string') {
        errorEl.hidden = false;
        errorEl.textContent = result;
        return;
      }
      try {
        await options.onSave(result);
        dialog.close();
      } catch (err) {
        errorEl.hidden = false;
        errorEl.textContent = err instanceof Error ? err.message : 'Saving failed.';
      }
    });

    dialog.querySelector('[data-delete]')?.addEventListener('click', async () => {
      if (!existing || !options.onDelete) return;
      if (!confirm('Delete this booking permanently? This cannot be undone.')) return;
      try {
        await options.onDelete(existing);
        dialog.close();
      } catch (err) {
        errorEl.hidden = false;
        errorEl.textContent = err instanceof Error ? err.message : 'Deleting failed.';
      }
    });
  }

  function collect(): Booking | string {
    // Start from the original so parser-only fields survive a manual edit.
    const base: Booking = existing
      ? structuredClone(existing)
      : {
          id: '',
          type,
          status: 'confirmed',
          title: '',
          confirmationCode: null,
          startDate: options.defaultDate,
          endDate: options.defaultDate,
          costAmount: null,
          costCurrency: 'EUR',
          costScope: 'booking',
          source: 'manual',
          sender: null,
        };

    const cost = fieldValue('costAmount');
    base.costAmount = cost ? Number(cost) : null;
    if (base.costAmount != null && !isFinite(base.costAmount)) return 'Cost must be a number.';
    base.confirmationCode = fieldValue('confirmationCode') || null;
    base.notes = fieldValue('notes');
    base.status = fieldValue('status') === 'cancelled' ? 'cancelled' : 'confirmed';
    // Saving through the form resolves any review flags.
    base.partial = false;

    if (base.type === 'flight') {
      const startDate = fieldValue('startDate');
      if (!isValidDateKey(startDate)) return 'Departure date is required.';
      const f = { ...(base.flight ?? {}) };
      f.airline = fieldValue('airline');
      f.flightNumber = fieldValue('flightNumber');
      f.depAirportCode = fieldValue('depAirportCode').toUpperCase();
      f.arrAirportCode = fieldValue('arrAirportCode').toUpperCase();
      f.depTime = fieldValue('depTime');
      f.arrTime = fieldValue('arrTime');
      f.arrivesNextDay = checked('arrivesNextDay');
      f.seat = fieldValue('seat');
      base.flight = f;
      base.startDate = startDate;
      base.endDate = f.arrivesNextDay ? addDays(startDate, 1) : startDate;
      const route =
        f.depAirportCode && f.arrAirportCode ? `${f.depAirportCode} → ${f.arrAirportCode}` : '';
      base.title =
        [f.flightNumber, route].filter(Boolean).join(' · ') || f.airline || 'Flight';
    } else if (base.type === 'stay') {
      const startDate = fieldValue('startDate');
      const endDate = fieldValue('endDate');
      if (!isValidDateKey(startDate)) return 'Check-in date is required.';
      if (!isValidDateKey(endDate)) return 'Check-out date is required.';
      if (endDate < startDate) return 'Check-out must be on or after check-in.';
      const s = { ...(base.stay ?? {}) };
      s.propertyName = fieldValue('propertyName');
      if (!s.propertyName) return 'Property name is required.';
      s.platform = fieldValue('platform');
      s.address = fieldValue('address');
      s.phone = fieldValue('phone');
      s.guestsText = fieldValue('guestsText');
      s.checkInTime = fieldValue('checkInTime');
      s.checkOutTime = fieldValue('checkOutTime');
      base.stay = s;
      base.startDate = startDate;
      base.endDate = endDate;
      base.title = s.propertyName;
    } else {
      const startDate = fieldValue('startDate');
      const endDate = fieldValue('endDate');
      if (!isValidDateKey(startDate)) return 'Pick-up date is required.';
      if (!isValidDateKey(endDate)) return 'Drop-off date is required.';
      if (endDate < startDate) return 'Drop-off must be on or after pick-up.';
      const c = { ...(base.car ?? {}) };
      c.company = fieldValue('company');
      c.pickupLocation = fieldValue('pickupLocation');
      c.dropoffLocation = fieldValue('dropoffLocation');
      c.pickupTime = fieldValue('pickupTime');
      c.dropoffTime = fieldValue('dropoffTime');
      base.car = c;
      base.startDate = startDate;
      base.endDate = endDate;
      base.title = c.company ? `${c.company} — car hire` : 'Car hire';
    }
    return base;
  }

  render();
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
}

function typeFields(type: BookingType, b: Booking | undefined, defaultDate: string): string {
  if (type === 'flight') {
    const f = b?.flight;
    return `
      <label>Departure date
        <input name="startDate" type="date" required value="${esc(b?.startDate ?? defaultDate)}" />
      </label>
      <div class="field-pair">
        <label>Airline
          <input name="airline" type="text" value="${esc(f?.airline ?? '')}" placeholder="e.g. Ryanair" />
        </label>
        <label>Flight number
          <input name="flightNumber" type="text" autocapitalize="characters" value="${esc(f?.flightNumber ?? '')}" placeholder="e.g. FR 6131" />
        </label>
      </div>
      <div class="field-pair">
        <label>From (airport code)
          <input name="depAirportCode" type="text" maxlength="4" autocapitalize="characters" value="${esc(f?.depAirportCode ?? '')}" placeholder="DUB" />
        </label>
        <label>To (airport code)
          <input name="arrAirportCode" type="text" maxlength="4" autocapitalize="characters" value="${esc(f?.arrAirportCode ?? '')}" placeholder="NAP" />
        </label>
      </div>
      <div class="field-pair">
        <label>Take-off (local)
          <input name="depTime" type="time" value="${esc(f?.depTime ?? '')}" />
        </label>
        <label>Landing (local)
          <input name="arrTime" type="time" value="${esc(f?.arrTime ?? '')}" />
        </label>
      </div>
      <label class="check-label">
        <input name="arrivesNextDay" type="checkbox" ${f?.arrivesNextDay ? 'checked' : ''} />
        Arrives next day
      </label>
      <label>Seat
        <input name="seat" type="text" value="${esc(f?.seat ?? '')}" placeholder="e.g. 28F" />
      </label>`;
  }
  if (type === 'stay') {
    const s = b?.stay;
    return `
      <label>Property name
        <input name="propertyName" type="text" required value="${esc(s?.propertyName ?? '')}" placeholder="e.g. Arco Barcelona Hotel" />
      </label>
      <label>Platform
        <input name="platform" type="text" list="platform-options" value="${esc(s?.platform ?? '')}" placeholder="e.g. Booking.com" />
        <datalist id="platform-options">
          <option value="Booking.com"></option>
          <option value="Airbnb"></option>
          <option value="Direct"></option>
        </datalist>
      </label>
      <div class="field-pair">
        <label>Check-in date
          <input name="startDate" type="date" required value="${esc(b?.startDate ?? defaultDate)}" />
        </label>
        <label>Check-out date
          <input name="endDate" type="date" required value="${esc(b?.endDate ?? addDays(defaultDate, 1))}" />
        </label>
      </div>
      <div class="field-pair">
        <label>Check-in from
          <input name="checkInTime" type="time" value="${esc(s?.checkInTime ?? '')}" />
        </label>
        <label>Check-out until
          <input name="checkOutTime" type="time" value="${esc(s?.checkOutTime ?? '')}" />
        </label>
      </div>
      <label>Address
        <input name="address" type="text" value="${esc(s?.address ?? '')}" />
      </label>
      <div class="field-pair">
        <label>Phone
          <input name="phone" type="tel" value="${esc(s?.phone ?? '')}" />
        </label>
        <label>Guests
          <input name="guestsText" type="text" value="${esc(s?.guestsText ?? '')}" placeholder="e.g. 2 adults" />
        </label>
      </div>`;
  }
  const c = b?.car;
  return `
    <label>Company
      <input name="company" type="text" value="${esc(c?.company ?? '')}" placeholder="e.g. Avis" />
    </label>
    <div class="field-pair">
      <label>Pick-up date
        <input name="startDate" type="date" required value="${esc(b?.startDate ?? defaultDate)}" />
      </label>
      <label>Drop-off date
        <input name="endDate" type="date" required value="${esc(b?.endDate ?? defaultDate)}" />
      </label>
    </div>
    <div class="field-pair">
      <label>Pick-up time
        <input name="pickupTime" type="time" value="${esc(c?.pickupTime ?? '')}" />
      </label>
      <label>Drop-off time
        <input name="dropoffTime" type="time" value="${esc(c?.dropoffTime ?? '')}" />
      </label>
    </div>
    <label>Pick-up location
      <input name="pickupLocation" type="text" value="${esc(c?.pickupLocation ?? '')}" />
    </label>
    <label>Drop-off location
      <input name="dropoffLocation" type="text" value="${esc(c?.dropoffLocation ?? '')}" />
    </label>`;
}
