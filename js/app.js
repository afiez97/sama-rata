import { state, setTripState } from './state.js';
import {
  renderApp,
  renderTabs,
  renderTripsHistory,
  showError,
  clearError,
  openExpenseEditPanel,
  closeExpenseEditPanel,
} from './render.js';
import {
  createTrip,
  getTrip,
  joinTripByCode,
  updateTrip,
  addMember,
  removeMember,
  addExpense,
  updateExpense,
  deleteExpense,
  resetTrip,
} from './api.js';
import { forgetTrip } from './trips-history.js';
import { initInstallBanner, promptInstall, isStandalone } from './install-prompt.js';

const formStartTrip = document.getElementById('form-start-trip');
const inputStartTripName = document.getElementById('input-start-trip-name');
const inputStartTripCurrency = document.getElementById('input-start-trip-currency');

const formJoinTrip = document.getElementById('form-join-trip');
const inputJoinCode = document.getElementById('input-join-code');
const joinCodeError = document.getElementById('join-code-error');

const btnCopyLink = document.getElementById('btn-copy-link');
const btnCopyCode = document.getElementById('btn-copy-code');
const inputShareLink = document.getElementById('input-share-link');
const tripCodeDisplay = document.getElementById('trip-code-display');

const tripsHistoryList = document.getElementById('trips-history-list');

const btnBackToStart = document.getElementById('btn-back-to-start');

const btnEditTrip = document.getElementById('btn-edit-trip');
const btnRefresh = document.getElementById('btn-refresh');
const formEditTrip = document.getElementById('form-edit-trip');
const inputEditTripName = document.getElementById('input-edit-trip-name');
const inputEditTripCurrency = document.getElementById('input-edit-trip-currency');
const btnCancelEditTrip = document.getElementById('btn-cancel-edit-trip');

const tabExpenses = document.getElementById('tab-expenses');
const tabSettle = document.getElementById('tab-settle');

const formAddMember = document.getElementById('form-add-member');
const inputMemberName = document.getElementById('input-member-name');
const memberChipList = document.getElementById('member-chip-list');

const btnShowAddExpense = document.getElementById('btn-show-add-expense');
const btnCancelAddExpense = document.getElementById('btn-cancel-add-expense');
const formAddExpense = document.getElementById('form-add-expense');
const inputExpenseDescription = document.getElementById('input-expense-description');
const inputExpenseAmount = document.getElementById('input-expense-amount');
const selectExpensePayer = document.getElementById('select-expense-payer');
const participantCheckboxList = document.getElementById('expense-participant-checkboxes');
const participantError = document.getElementById('expense-participant-error');

const formEditExpense = document.getElementById('form-edit-expense');
const editExpensePanel = document.getElementById('edit-expense-panel');
const inputEditExpenseDescription = document.getElementById('input-edit-expense-description');
const inputEditExpenseAmount = document.getElementById('input-edit-expense-amount');
const selectEditExpensePayer = document.getElementById('select-edit-expense-payer');
const editParticipantCheckboxList = document.getElementById('edit-expense-participant-checkboxes');
const editParticipantError = document.getElementById('edit-expense-participant-error');
const btnCancelEditExpense = document.getElementById('btn-cancel-edit-expense');

const expenseList = document.getElementById('expense-list');

const btnResetTrip = document.getElementById('btn-reset-trip');
const resetConfirmPanel = document.getElementById('reset-confirm-panel');
const btnResetConfirm = document.getElementById('btn-reset-confirm');
const btnResetCancel = document.getElementById('btn-reset-cancel');

const statusBannerDismiss = document.getElementById('status-banner-dismiss');

// render.js has no slot for this — built here and dropped right after the
// add-member form so the 409 duplicate_member message lands next to the
// input that caused it instead of the generic top-of-page banner.
const memberFormError = document.createElement('p');
memberFormError.className = 'field-error';
memberFormError.style.color = 'var(--stamp-red)';
memberFormError.style.fontSize = '0.85rem';
memberFormError.style.marginTop = 'var(--space-2)';
memberFormError.hidden = true;
formAddMember.insertAdjacentElement('afterend', memberFormError);

function showMemberFormError(message) {
  memberFormError.textContent = message;
  memberFormError.hidden = false;
}

function hideMemberFormError() {
  memberFormError.textContent = '';
  memberFormError.hidden = true;
}

function reportError(message) {
  state.error = message;
  showError(message);
}

function dismissError() {
  state.error = null;
  clearError();
}

async function runMutation(button, fn) {
  if (button) button.disabled = true;
  try {
    await fn();
  } finally {
    if (button) button.disabled = false;
  }
}

// Single source of truth for "reload trip state from the server and
// redraw" — used after every mutation and by both refresh paths. Owns
// state.loading end-to-end so a not_found result never gets rendered
// while loading is still true (which would suppress render.js's
// not-found screen — it only shows when !loading).
async function refreshTrip() {
  state.loading = true;
  try {
    const data = await getTrip(state.slug);
    setTripState(data);
    dismissError();
  } catch (err) {
    if (err.code === 'not_found') {
      state.trip = null;
      state.members = [];
      state.expenses = [];
    } else {
      reportError(err.message);
    }
  } finally {
    state.loading = false;
  }
  renderApp();
}

// Only used for the very first load of a trip. Deliberately does NOT call
// renderApp() on a non-404 failure: render.js's screen logic treats
// "trip is null" as "not found" the instant loading is false, with no way
// to tell a real 404 apart from a network blip. Rendering here would show
// the misleading "Trip Not Found" screen for a plain connectivity hiccup,
// so a generic failure surfaces only the error banner and leaves the
// screens in their initial hidden state until a retry succeeds.
async function loadInitialTrip(slug) {
  state.loading = true;
  try {
    const data = await getTrip(slug);
    setTripState(data);
    state.loading = false;
    dismissError();
    renderApp();
  } catch (err) {
    state.loading = false;
    if (err.code === 'not_found') {
      state.trip = null;
      state.members = [];
      state.expenses = [];
      forgetTrip(slug);
      renderApp();
    } else {
      reportError(err.message);
    }
  }
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const slug = params.get('trip');

  if (!slug) {
    renderApp();
    return;
  }

  state.slug = slug;
  await loadInitialTrip(slug);
}

formStartTrip.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = inputStartTripName.value.trim();
  const currency = inputStartTripCurrency.value.trim();
  const submitBtn = formStartTrip.querySelector('button[type="submit"]');

  await runMutation(submitBtn, async () => {
    try {
      const data = await createTrip({
        name: name || undefined,
        currency: currency || undefined,
      });
      state.slug = data.trip.slug;
      setTripState(data);
      dismissError();
      history.replaceState(null, '', `${location.pathname}?trip=${encodeURIComponent(state.slug)}`);
      renderApp();
    } catch (err) {
      reportError(err.message);
    }
  });
});

function showJoinCodeError(message) {
  joinCodeError.textContent = message;
  joinCodeError.hidden = false;
}

function hideJoinCodeError() {
  joinCodeError.textContent = '';
  joinCodeError.hidden = true;
}

inputJoinCode.addEventListener('input', () => {
  inputJoinCode.value = inputJoinCode.value.replace(/\D/g, '').slice(0, 4);
});

formJoinTrip.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = inputJoinCode.value.trim();
  hideJoinCodeError();
  if (!/^\d{4}$/.test(code)) {
    showJoinCodeError('Enter the 4-digit trip code.');
    return;
  }

  const submitBtn = formJoinTrip.querySelector('button[type="submit"]');
  await runMutation(submitBtn, async () => {
    try {
      const data = await joinTripByCode(code);
      state.slug = data.trip.slug;
      setTripState(data);
      dismissError();
      inputJoinCode.value = '';
      history.replaceState(null, '', `${location.pathname}?trip=${encodeURIComponent(state.slug)}`);
      renderApp();
    } catch (err) {
      showJoinCodeError(err.message);
    }
  });
});

// Swaps a button's label to a brief "Copied!" confirmation, then restores
// it — same pattern for both the link and code copy buttons below.
async function copyToClipboard(text, button, copiedLabel) {
  const originalLabel = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = copiedLabel;
  } catch {
    button.textContent = 'Copy failed';
  }
  setTimeout(() => {
    button.textContent = originalLabel;
  }, 1500);
}

btnCopyLink.addEventListener('click', () => {
  void copyToClipboard(inputShareLink.value, btnCopyLink, 'Copied!');
});

btnCopyCode.addEventListener('click', () => {
  void copyToClipboard(tripCodeDisplay.textContent, btnCopyCode, 'Copied!');
});

tripsHistoryList.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('.trips-history-remove');
  if (removeBtn) {
    forgetTrip(removeBtn.dataset.slug);
    renderTripsHistory();
    return;
  }

  const openBtn = e.target.closest('.trips-history-open');
  if (openBtn) {
    const slug = openBtn.dataset.slug;
    state.slug = slug;
    history.replaceState(null, '', `${location.pathname}?trip=${encodeURIComponent(slug)}`);
    void loadInitialTrip(slug);
  }
});

btnBackToStart.addEventListener('click', () => {
  state.slug = null;
  state.trip = null;
  state.members = [];
  state.expenses = [];
  dismissError();
  history.replaceState(null, '', location.pathname);
  renderApp();
});

btnEditTrip.addEventListener('click', () => {
  const opening = formEditTrip.hidden;
  if (opening && state.trip) {
    inputEditTripName.value = state.trip.name;
    inputEditTripCurrency.value = state.trip.currency;
  }
  formEditTrip.hidden = !opening;
  btnEditTrip.setAttribute('aria-expanded', String(opening));
});

btnCancelEditTrip.addEventListener('click', () => {
  formEditTrip.hidden = true;
  btnEditTrip.setAttribute('aria-expanded', 'false');
});

formEditTrip.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = inputEditTripName.value.trim();
  const currency = inputEditTripCurrency.value.trim();
  if (!name || !currency) return;

  const submitBtn = formEditTrip.querySelector('button[type="submit"]');
  await runMutation(submitBtn, async () => {
    try {
      await updateTrip(state.slug, { name, currency });
      await refreshTrip();
      formEditTrip.hidden = true;
      btnEditTrip.setAttribute('aria-expanded', 'false');
    } catch (err) {
      reportError(err.message);
    }
  });
});

btnRefresh.addEventListener('click', async () => {
  lastSyncAt = Date.now();
  btnRefresh.disabled = true;
  try {
    await refreshTrip();
  } finally {
    btnRefresh.disabled = false;
  }
});

tabExpenses.addEventListener('click', () => {
  state.activeTab = 'expenses';
  renderTabs(state);
});

tabSettle.addEventListener('click', () => {
  state.activeTab = 'settle';
  renderTabs(state);
});

formAddMember.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = inputMemberName.value.trim();
  hideMemberFormError();
  if (!name) return;

  const submitBtn = formAddMember.querySelector('button[type="submit"]');
  await runMutation(submitBtn, async () => {
    try {
      await addMember(state.slug, name);
      inputMemberName.value = '';
      await refreshTrip();
    } catch (err) {
      if (err.code === 'duplicate_member') {
        showMemberFormError(err.message);
      } else {
        reportError(err.message);
      }
    }
  });
});

memberChipList.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip-remove');
  if (!btn) return;
  const memberId = Number(btn.dataset.memberId);
  void (async () => {
    try {
      await removeMember(state.slug, memberId);
      await refreshTrip();
    } catch (err) {
      reportError(err.message);
    }
  })();
});

btnShowAddExpense.addEventListener('click', () => {
  btnShowAddExpense.hidden = true;
  formAddExpense.hidden = false;
});

btnCancelAddExpense.addEventListener('click', () => {
  formAddExpense.hidden = true;
  btnShowAddExpense.hidden = false;
});

// Auto-ticks the payer as a participant when they're picked, per the app's
// "the payer counts as one of the people splitting it by default" rule.
// Doesn't force it to stay ticked — the user can still untick the payer
// afterward for a case like "Alice paid for a gift only Bob and Carol split".
selectExpensePayer.addEventListener('change', () => {
  const checkbox = participantCheckboxList.querySelector(
    `input[data-member-id="${selectExpensePayer.value}"]`
  );
  if (checkbox) checkbox.checked = true;
});

formAddExpense.addEventListener('submit', async (e) => {
  e.preventDefault();
  const description = inputExpenseDescription.value.trim();
  const amount = Number(inputExpenseAmount.value);
  const paidByMemberId = Number(selectExpensePayer.value);
  const participantIds = Array.from(
    participantCheckboxList.querySelectorAll('input[type="checkbox"]:checked')
  ).map((input) => Number(input.dataset.memberId));

  participantError.hidden = participantIds.length > 0;
  if (!description || !Number.isFinite(amount) || amount <= 0 || !paidByMemberId) {
    return;
  }
  if (participantIds.length === 0) {
    return;
  }

  const submitBtn = formAddExpense.querySelector('button[type="submit"]');
  await runMutation(submitBtn, async () => {
    try {
      await addExpense(state.slug, { description, amount, paidByMemberId, participantIds });
      inputExpenseDescription.value = '';
      inputExpenseAmount.value = '';
      await refreshTrip();
    } catch (err) {
      reportError(err.message);
    }
  });
});

selectEditExpensePayer.addEventListener('change', () => {
  const checkbox = editParticipantCheckboxList.querySelector(
    `input[data-member-id="${selectEditExpensePayer.value}"]`
  );
  if (checkbox) checkbox.checked = true;
});

btnCancelEditExpense.addEventListener('click', () => {
  closeExpenseEditPanel();
});

formEditExpense.addEventListener('submit', async (e) => {
  e.preventDefault();
  const expenseId = Number(editExpensePanel.dataset.expenseId);
  const description = inputEditExpenseDescription.value.trim();
  const amount = Number(inputEditExpenseAmount.value);
  const paidByMemberId = Number(selectEditExpensePayer.value);
  const participantIds = Array.from(
    editParticipantCheckboxList.querySelectorAll('input[type="checkbox"]:checked')
  ).map((input) => Number(input.dataset.memberId));

  editParticipantError.hidden = participantIds.length > 0;
  if (!expenseId || !description || !Number.isFinite(amount) || amount <= 0 || !paidByMemberId) {
    return;
  }
  if (participantIds.length === 0) {
    return;
  }

  const submitBtn = formEditExpense.querySelector('button[type="submit"]');
  await runMutation(submitBtn, async () => {
    try {
      await updateExpense(state.slug, expenseId, { description, amount, paidByMemberId, participantIds });
      closeExpenseEditPanel();
      await refreshTrip();
    } catch (err) {
      reportError(err.message);
    }
  });
});

// Expense delete uses an inline two-step confirm (see .expense-row.is-confirming
// / .expense-confirm-actions in style.css), built here since render.js's list
// render only draws the initial delete button.
function beginExpenseDeleteConfirm(deleteBtn) {
  const row = deleteBtn.closest('.expense-row');
  if (!row || row.classList.contains('is-confirming')) return;
  row.classList.add('is-confirming');

  const actions = document.createElement('div');
  actions.className = 'expense-confirm-actions';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn btn-danger expense-confirm-delete';
  confirmBtn.dataset.expenseId = deleteBtn.dataset.expenseId;
  confirmBtn.textContent = 'Delete';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-secondary expense-confirm-cancel';
  cancelBtn.textContent = 'Cancel';

  actions.append(confirmBtn, cancelBtn);
  row.append(actions);
}

function cancelExpenseDeleteConfirm(cancelBtn) {
  const row = cancelBtn.closest('.expense-row');
  if (!row) return;
  row.classList.remove('is-confirming');
  row.querySelector('.expense-confirm-actions')?.remove();
}

expenseList.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.expense-edit');
  if (editBtn) {
    const expenseId = Number(editBtn.dataset.expenseId);
    const expense = state.expenses.find((exp) => exp.id === expenseId);
    if (expense) openExpenseEditPanel(expense);
    return;
  }

  const deleteBtn = e.target.closest('.expense-delete');
  if (deleteBtn) {
    beginExpenseDeleteConfirm(deleteBtn);
    return;
  }

  const cancelBtn = e.target.closest('.expense-confirm-cancel');
  if (cancelBtn) {
    cancelExpenseDeleteConfirm(cancelBtn);
    return;
  }

  const confirmBtn = e.target.closest('.expense-confirm-delete');
  if (confirmBtn) {
    const expenseId = Number(confirmBtn.dataset.expenseId);
    void (async () => {
      try {
        await deleteExpense(state.slug, expenseId);
        await refreshTrip();
      } catch (err) {
        reportError(err.message);
      }
    })();
  }
});

btnResetTrip.addEventListener('click', () => {
  resetConfirmPanel.hidden = false;
});

btnResetCancel.addEventListener('click', () => {
  resetConfirmPanel.hidden = true;
});

btnResetConfirm.addEventListener('click', async () => {
  await runMutation(btnResetConfirm, async () => {
    try {
      await resetTrip(state.slug);
      resetConfirmPanel.hidden = true;
      await refreshTrip();
    } catch (err) {
      reportError(err.message);
    }
  });
});

statusBannerDismiss.addEventListener('click', () => {
  dismissError();
});

// Collapsible Settle Up sections — collapsed by default (set in the HTML's
// `hidden`/aria-expanded attributes) since Balances and Suggested Transfers
// can run long and push everything else off-screen on mobile.
function setupDisclosure(buttonId, contentId) {
  const button = document.getElementById(buttonId);
  const content = document.getElementById(contentId);
  button.addEventListener('click', () => {
    const isOpen = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!isOpen));
    content.hidden = isOpen;
  });
}

setupDisclosure('btn-toggle-balances', 'balances-content');
setupDisclosure('btn-toggle-transfers', 'transfers-content');

const SYNC_DEBOUNCE_MS = 2000;
let lastSyncAt = 0;

// Covers both cases on tab focus/visibility: a trip already loaded gets a
// silent re-fetch, while a trip that never loaded (e.g. the initial fetch
// hit a network error) gets another attempt via loadInitialTrip so the app
// can recover on its own once connectivity comes back.
async function silentRefresh() {
  if (!state.slug) return;
  const now = Date.now();
  if (now - lastSyncAt < SYNC_DEBOUNCE_MS) return;
  lastSyncAt = now;

  if (state.trip) {
    await refreshTrip();
  } else {
    await loadInitialTrip(state.slug);
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void silentRefresh();
});

window.addEventListener('focus', () => {
  void silentRefresh();
});

boot();
initInstallBanner();

const btnInstallStart = document.getElementById('btn-install-start');
const installStartHint = document.getElementById('install-start-hint');

if (!isStandalone()) {
  btnInstallStart.hidden = false;
}

btnInstallStart.addEventListener('click', async () => {
  const result = await promptInstall();
  if (result === 'ios') {
    installStartHint.textContent = 'Tap the Share icon, then "Add to Home Screen".';
    installStartHint.hidden = false;
  } else if (result === 'unavailable') {
    installStartHint.textContent = 'Look for "Install App" or "Add to Home Screen" in your browser\'s menu.';
    installStartHint.hidden = false;
  } else {
    installStartHint.hidden = true;
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
