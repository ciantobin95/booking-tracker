import './style.css';
import { isFirebaseConfigured } from './firebase-config';
import { signInWithGoogle, useEmulators, watchAuth } from './firebase';

const app = document.getElementById('app')!;

function renderSetupRequired(): void {
  app.innerHTML = `
    <div class="centered-screen">
      <h1>Booking Tracker</h1>
      <p>This deployment isn't connected to Firebase yet.</p>
      <p>Fill in <code>src/firebase-config.ts</code> following
      <a href="https://github.com/ciantobin95/booking-tracker/blob/main/docs/FIREBASE_SETUP.md">docs/FIREBASE_SETUP.md</a>,
      then push to redeploy.</p>
    </div>`;
}

function renderSignIn(errorMessage?: string): void {
  app.innerHTML = `
    <div class="centered-screen">
      <h1>Booking Tracker</h1>
      <p>Your flights, stays and rentals in one calendar.</p>
      ${errorMessage ? `<p class="error-text"></p>` : ''}
      <button id="sign-in-btn" class="primary-btn">Sign in with Google</button>
    </div>`;
  if (errorMessage) {
    app.querySelector('.error-text')!.textContent = errorMessage;
  }
  app.querySelector('#sign-in-btn')!.addEventListener('click', async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      renderSignIn(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    }
  });
}

function renderLoading(): void {
  app.innerHTML = '<div class="centered-screen"><p>Loading…</p></div>';
}

async function boot(): Promise<void> {
  if (!useEmulators && !isFirebaseConfigured()) {
    renderSetupRequired();
    return;
  }
  renderLoading();
  watchAuth(async (user) => {
    if (!user) {
      renderSignIn();
      return;
    }
    const { renderApp } = await import('./ui/app');
    renderApp(app, user);
  });
}

boot();
