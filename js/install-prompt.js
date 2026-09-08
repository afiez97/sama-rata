// Best-effort "Install App" support. No platform lets a page silently install
// itself on a visit/scan — Chrome/Android only allows a one-tap install
// after a real button press inside the page, and iOS Safari has no install
// API at all. This surfaces whichever path the current browser actually
// supports: a real native prompt on Chrome/Edge/Android, and manual
// "Add to Home Screen" instructions on iOS Safari.
const DISMISSED_KEY = 'sama_rata_install_dismissed';

function isDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Storage blocked (private browsing etc.) — banner may reappear next visit.
  }
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// Chrome/Firefox/Edge on iOS are all WebKit-under-the-hood but can't actually
// install a standalone home-screen app the way Safari can, so only Safari
// gets the "Add to Home Screen" instructions.
export function isIOSSafari() {
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
  const isOtherIOSBrowser = /crios|fxios|edgios|opios/i.test(ua);
  return isIOS && !isOtherIOSBrowser;
}

// Captured as soon as the browser offers it (independent of any UI), so
// whichever button the user actually clicks — the auto banner or the
// permanent one on the start screen — can use the same captured prompt.
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  setDismissed();
});

// Triggers whatever install path is actually available right now. Returns
// 'accepted' | 'dismissed' (native prompt outcome), 'ios' (show manual
// instructions yourself), or 'unavailable' (neither applies — e.g. desktop
// Chrome before the browser has decided the page is installable yet).
export async function promptInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') setDismissed();
    return outcome;
  }
  if (isIOSSafari()) return 'ios';
  return 'unavailable';
}

// Wires the dismissible banner that appears on its own once the browser
// signals the page is installable (or immediately, on iOS Safari, since
// there's no such signal there) — separate from the always-visible button
// on the start screen, which stays put regardless of a prior dismissal.
export function initInstallBanner() {
  if (isStandalone() || isDismissed()) return;

  const banner = document.getElementById('install-banner');
  const message = document.getElementById('install-banner-message');
  const installBtn = document.getElementById('btn-install-app');
  const dismissBtn = document.getElementById('install-banner-dismiss');

  function show(text, withButton) {
    message.textContent = text;
    installBtn.hidden = !withButton;
    banner.hidden = false;
  }

  function hide() {
    banner.hidden = true;
  }

  window.addEventListener('beforeinstallprompt', () => {
    if (!isDismissed()) show('Install Sama Rata for quick, one-tap access next time.', true);
  });

  window.addEventListener('appinstalled', hide);

  installBtn.addEventListener('click', async () => {
    await promptInstall();
    hide();
  });

  dismissBtn.addEventListener('click', () => {
    setDismissed();
    hide();
  });

  if (isIOSSafari()) {
    show('Add Sama Rata to your Home Screen: tap Share, then "Add to Home Screen".', false);
  }
}
