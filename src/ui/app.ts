import type { User } from 'firebase/auth';
import { signOutUser } from '../firebase';

export function renderApp(root: HTMLElement, user: User): void {
  root.innerHTML = `
    <div class="centered-screen">
      <h1>Booking Tracker</h1>
      <p>Signed in as <span class="user-email"></span>. Calendar coming in the next phase.</p>
      <button id="sign-out-btn" class="secondary-btn">Sign out</button>
    </div>`;
  root.querySelector('.user-email')!.textContent = user.email ?? user.uid;
  root.querySelector('#sign-out-btn')!.addEventListener('click', () => signOutUser());
}
