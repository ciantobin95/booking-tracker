import type { User } from 'firebase/auth';
import { esc } from './html';

export interface SettingsCallbacks {
  onSignOut: () => Promise<void>;
}

export function openSettings(user: User, callbacks: SettingsCallbacks): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet-dialog';
  document.body.appendChild(dialog);

  dialog.innerHTML = `
    <div class="booking-form">
      <div class="form-header">
        <h2>Settings</h2>
        <button type="button" class="icon-btn" data-close>Close</button>
      </div>
      <div class="settings-body">
        <p class="settings-line"><span class="detail-label">Signed in as</span> ${esc(user.email ?? '(no email)')}</p>
        <p class="settings-line"><span class="detail-label">User ID</span>
          <code class="uid-value">${esc(user.uid)}</code>
          <button type="button" class="edit-btn" data-copy-uid>Copy</button>
        </p>
        <p class="settings-hint">The email scanner needs this User ID — paste it into the Apps
        Script's Script Properties as <code>FIREBASE_UID</code> (see docs/APPS_SCRIPT_SETUP.md).</p>
        <button type="button" class="secondary-btn" data-sign-out>Sign out</button>
      </div>
    </div>`;

  dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-copy-uid]')!.addEventListener('click', async (ev) => {
    await navigator.clipboard.writeText(user.uid);
    (ev.currentTarget as HTMLButtonElement).textContent = 'Copied';
  });
  dialog.querySelector('[data-sign-out]')!.addEventListener('click', async () => {
    dialog.close();
    await callbacks.onSignOut();
  });

  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
}
