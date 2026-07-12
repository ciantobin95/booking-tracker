import { expect, test, type Page } from '@playwright/test';

/**
 * Full user-journey smoke test against the Firebase emulators:
 * sign in with (emulated) Google, add a stay and an overnight flight through
 * the forms, verify calendar highlighting and day-detail rendering, edit a
 * booking, and resolve a needs-review item injected the way the Gmail
 * scanner would write it.
 */

const today = new Date();
const dateKey = (offset: number): string => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

async function signIn(page: Page): Promise<void> {
  await page.goto('/');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  const popup = await popupPromise;
  await popup.getByRole('button', { name: /add new account/i }).click();
  await popup.getByRole('button', { name: /auto-generate/i }).click();
  await popup.getByRole('button', { name: /sign in with google/i }).click();
  await expect(page.locator('.app-title')).toBeVisible({ timeout: 15_000 });
}

test.beforeEach(async ({ request }) => {
  // Start from a clean emulator state so the run is deterministic.
  await request.delete('http://127.0.0.1:9099/emulator/v1/projects/demo-booking/accounts', {
    headers: { Authorization: 'Bearer owner' },
  });
  await request.delete(
    'http://127.0.0.1:8080/emulator/v1/projects/demo-booking/databases/(default)/documents',
  );
});

test('sign in, add bookings, verify calendar, edit, resolve review item', async ({ page }) => {
  await signIn(page);

  // --- Add a 3-night stay starting today -------------------------------
  await page.locator('#add-fab').click();
  await page.getByRole('tab', { name: /stay/i }).click();
  await page.locator('[name="propertyName"]').fill('Arco Barcelona Hotel');
  await page.locator('[name="platform"]').fill('Booking.com');
  await page.locator('[name="startDate"]').fill(dateKey(0));
  await page.locator('[name="endDate"]').fill(dateKey(3));
  await page.locator('[name="checkInTime"]').fill('14:00');
  await page.locator('[name="checkOutTime"]').fill('11:00');
  await page.locator('[name="costAmount"]').fill('110.29');
  await page.locator('[name="confirmationCode"]').fill('6803895965');
  await page.locator('dialog [data-save]').click();

  // Card appears on today's panel with check-in context and cost.
  const stayCard = page.locator('.booking-card.card-stay');
  await expect(stayCard).toContainText('Arco Barcelona Hotel');
  await expect(stayCard).toContainText('Check-in from 14:00');
  await expect(stayCard).toContainText('€110.29');

  // Calendar: today + following days carry the stay bar.
  await expect(page.locator(`.day-cell[data-date="${dateKey(0)}"] .stay-bar`)).toBeVisible();
  await expect(page.locator(`.day-cell[data-date="${dateKey(1)}"] .stay-bar`)).toBeVisible();
  await expect(page.locator(`.day-cell[data-date="${dateKey(3)}"] .stay-bar`)).toBeVisible();

  // --- Add an overnight flight today ------------------------------------
  await page.locator('#add-fab').click();
  await page.locator('[name="airline"]').fill('Aer Lingus');
  await page.locator('[name="flightNumber"]').fill('EI 0108');
  await page.locator('[name="depAirportCode"]').fill('JFK');
  await page.locator('[name="arrAirportCode"]').fill('DUB');
  await page.locator('[name="depTime"]').fill('23:55');
  await page.locator('[name="arrTime"]').fill('11:40');
  await page.locator('[name="arrivesNextDay"]').check();
  await page.locator('[name="costAmount"]').fill('298.50');
  await page.locator('[name="confirmationCode"]').fill('2BVFSJ');
  await page.locator('dialog [data-save]').click();

  const flightCard = page.locator('.booking-card.card-flight');
  await expect(flightCard).toContainText('EI 0108 · JFK → DUB');
  await expect(flightCard).toContainText('23:55');
  await expect(flightCard).toContainText('(+1 day)');
  await expect(page.locator(`.day-cell[data-date="${dateKey(0)}"] .dot-flight`)).toBeVisible();

  // Arrival day shows the "arrives today" context.
  await page.locator(`.day-cell[data-date="${dateKey(1)}"]`).click();
  await expect(page.locator('.booking-card.card-flight')).toContainText('Arrives today at 11:40');

  // --- Edit the stay ------------------------------------------------------
  await page.locator(`.day-cell[data-date="${dateKey(0)}"]`).click();
  await stayCard.locator('.edit-btn').click();
  await page.locator('[name="propertyName"]').fill('Arco Barcelona Hotel (Room 12)');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.booking-card.card-stay')).toContainText('Arco Barcelona Hotel (Room 12)');

  // --- Needs-review flow --------------------------------------------------
  // Inject a partially-parsed booking exactly the way the Gmail scanner
  // writes documents (REST upsert with a deterministic ID).
  const accounts = await page.request.post(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-booking/accounts:query',
    { headers: { Authorization: 'Bearer owner' }, data: {} },
  );
  const uid: string = (await accounts.json()).userInfo[0].localId;
  const docId = 's_airbnb_villa-laguna-sunrise_' + dateKey(7);
  const res = await page.request.patch(
    `http://127.0.0.1:8080/v1/projects/demo-booking/databases/(default)/documents/users/${uid}/bookings/${docId}`,
    {
      headers: { Authorization: 'Bearer owner' },
      data: {
        fields: {
          type: { stringValue: 'stay' },
          status: { stringValue: 'needs_review' },
          partial: { booleanValue: true },
          title: { stringValue: 'Villa Laguna Sunrise by Ezoria Villas' },
          confirmationCode: { nullValue: null },
          startDate: { stringValue: dateKey(7) },
          endDate: { stringValue: dateKey(11) },
          costAmount: { nullValue: null },
          costCurrency: { stringValue: 'EUR' },
          costScope: { stringValue: 'booking' },
          source: { stringValue: 'gmail' },
          sender: { stringValue: 'airbnb' },
          stay: {
            mapValue: {
              fields: {
                propertyName: { stringValue: 'Villa Laguna Sunrise by Ezoria Villas' },
                platform: { stringValue: 'Airbnb' },
                checkInTime: { stringValue: '16:00' },
                checkOutTime: { stringValue: '11:00' },
              },
            },
          },
        },
      },
    },
  );
  expect(res.ok()).toBeTruthy();

  // Review badge appears; the item can be fixed through the form.
  const reviewBtn = page.locator('#review-btn');
  await expect(reviewBtn).toBeVisible();
  await expect(reviewBtn.locator('.badge')).toHaveText('1');
  await reviewBtn.click();
  await expect(page.locator('.review-item')).toContainText('Villa Laguna Sunrise');
  await page.getByRole('button', { name: 'Fix' }).click();
  await page.locator('[name="costAmount"]').fill('980');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(reviewBtn).toBeHidden();

  // The fixed booking renders as a normal confirmed stay on its start day.
  await page.locator(`.day-cell[data-date="${dateKey(7)}"]`).click();
  const villaCard = page.locator('.booking-card.card-stay');
  await expect(villaCard).toContainText('Villa Laguna Sunrise');
  await expect(villaCard).toContainText('€980.00');
  await expect(villaCard).not.toHaveClass(/card-attention/);

  await page.screenshot({ path: '/tmp/artifacts-smoke/calendar.png', fullPage: true });
});
