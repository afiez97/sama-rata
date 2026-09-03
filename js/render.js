import { state } from './state.js';
import { buildParticipants, computeSettlement, formatCents, balanceLabel } from './settlement.js';

const screenStart = document.getElementById('screen-start');
const screenNotFound = document.getElementById('screen-not-found');
const screenTrip = document.getElementById('screen-trip');

const tripNameDisplay = document.getElementById('trip-name-display');
const tripCurrencyDisplay = document.getElementById('trip-currency-display');

const memberChipList = document.getElementById('member-chip-list');
const memberChipListEmpty = document.getElementById('member-chip-list-empty');
const payerSelect = document.getElementById('select-expense-payer');

const expenseList = document.getElementById('expense-list');
const expenseListEmpty = document.getElementById('expense-list-empty');

const settleSummary = document.getElementById('settle-summary');
const balanceList = document.getElementById('balance-list');
const transferList = document.getElementById('transfer-list');
const transferListEmpty = document.getElementById('transfer-list-empty');

const tabExpenses = document.getElementById('tab-expenses');
const tabSettle = document.getElementById('tab-settle');
const panelExpenses = document.getElementById('panel-expenses');
const panelSettle = document.getElementById('panel-settle');

const statusBanner = document.getElementById('status-banner');
const statusBannerMessage = document.getElementById('status-banner-message');

const BALANCE_COPY = {
  'gets-back': 'gets back',
  owes: 'owes',
  settled: 'settled up',
};

export function showError(message) {
  statusBannerMessage.textContent = message;
  statusBanner.hidden = false;
}

export function clearError() {
  statusBannerMessage.textContent = '';
  statusBanner.hidden = true;
}

function formatDate(rawDate) {
  if (!rawDate) return '';
  const parsed = new Date(rawDate.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return rawDate;
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function renderApp(appState = state) {
  const hasTrip = Boolean(appState.trip);
  // A slug present but no trip loaded (and no fetch in flight) means the lookup
  // failed — that's the "trip not found" screen rather than the fresh-start form.
  const notFound = !hasTrip && Boolean(appState.slug) && !appState.loading;

  screenStart.classList.toggle('is-hidden', hasTrip || notFound);
  screenNotFound.classList.toggle('is-hidden', !notFound);
  screenTrip.classList.toggle('is-hidden', !hasTrip);

  if (hasTrip) {
    renderTripHeader(appState);
    renderMemberChips(appState);
    renderExpenseList(appState);
    renderSettleUp(appState);
    renderTabs(appState);
  }
}

export function renderTripHeader(appState = state) {
  const { trip } = appState;
  if (!trip) return;
  tripNameDisplay.textContent = trip.name;
  tripCurrencyDisplay.textContent = trip.currency;
}

export function renderMemberChips(appState = state) {
  const activeMembers = appState.members.filter((member) => member.is_active);

  const chipNodes = activeMembers.map((member) => {
    const li = document.createElement('li');
    li.className = 'chip';
    li.dataset.memberId = String(member.id);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'chip-name';
    nameSpan.textContent = member.name;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'chip-remove';
    removeBtn.dataset.memberId = String(member.id);
    removeBtn.setAttribute('aria-label', `Remove ${member.name}`);
    removeBtn.textContent = '×';

    li.append(nameSpan, removeBtn);
    return li;
  });

  memberChipList.replaceChildren(...chipNodes);
  memberChipListEmpty.hidden = activeMembers.length > 0;

  const previousSelection = payerSelect.value;
  const optionNodes = activeMembers.map((member) => {
    const option = document.createElement('option');
    option.value = String(member.id);
    option.textContent = member.name;
    return option;
  });
  payerSelect.replaceChildren(...optionNodes);

  const stillExists = activeMembers.some((member) => String(member.id) === previousSelection);
  if (stillExists) {
    payerSelect.value = previousSelection;
  } else if (activeMembers.length > 0) {
    payerSelect.value = String(activeMembers[0].id);
  }
}

export function renderExpenseList(appState = state) {
  const expenses = appState.expenses;

  const rowNodes = expenses.map((expense) => {
    const li = document.createElement('li');
    li.className = 'expense-row';
    li.dataset.expenseId = String(expense.id);

    const main = document.createElement('div');
    main.className = 'expense-row-main';

    const desc = document.createElement('span');
    desc.className = 'expense-desc';
    desc.textContent = expense.description;

    const meta = document.createElement('div');
    meta.className = 'expense-meta';

    const payer = document.createElement('span');
    payer.className = 'expense-payer';
    payer.append(document.createTextNode(`Paid by ${expense.paid_by_name}`));
    if (!expense.paid_by_active) {
      payer.append(document.createTextNode(' (removed)'));
    }

    const date = document.createElement('span');
    date.className = 'expense-date';
    date.textContent = formatDate(expense.created_at);

    meta.append(payer, date);
    main.append(desc, meta);

    const side = document.createElement('div');
    side.className = 'expense-row-side';

    const amount = document.createElement('span');
    amount.className = 'expense-amount';
    amount.textContent = formatCents(expense.amount_cents, appState.trip.currency);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'expense-delete';
    deleteBtn.dataset.expenseId = String(expense.id);
    deleteBtn.setAttribute('aria-label', `Delete expense: ${expense.description}`);
    deleteBtn.textContent = '✕';

    side.append(amount, deleteBtn);
    li.append(main, side);
    return li;
  });

  expenseList.replaceChildren(...rowNodes);
  expenseListEmpty.hidden = expenses.length > 0;
}

export function renderSettleUp(appState = state) {
  const currency = appState.trip ? appState.trip.currency : '';
  const participants = buildParticipants(appState.members, appState.expenses);
  const settlement = computeSettlement(participants);

  if (participants.length === 0) {
    settleSummary.textContent = 'Add members and expenses to see the fair share.';
    balanceList.replaceChildren();
    transferList.replaceChildren();
    transferListEmpty.hidden = true;
    return;
  }

  settleSummary.textContent = '';
  const strong = document.createElement('strong');
  strong.textContent = formatCents(settlement.fairShareCents, currency);
  settleSummary.append(document.createTextNode('Each person’s fair share is '), strong, document.createTextNode('.'));

  const balanceNodes = settlement.balances.map((balance) => {
    const li = document.createElement('li');
    const label = balanceLabel(balance.balanceCents);
    li.className = `balance-row is-${label === 'gets-back' ? 'positive' : label === 'owes' ? 'negative' : 'zero'}`;

    const name = document.createElement('span');
    name.className = 'balance-name';
    name.append(document.createTextNode(balance.name));
    if (!balance.active) {
      name.append(document.createTextNode(' (removed)'));
    }

    const status = document.createElement('span');
    status.className = 'balance-status';
    if (label === 'settled') {
      status.textContent = BALANCE_COPY.settled;
    } else {
      status.textContent = `${BALANCE_COPY[label]} ${formatCents(Math.abs(balance.balanceCents), currency)}`;
    }

    li.append(name, status);
    return li;
  });
  balanceList.replaceChildren(...balanceNodes);

  const transferNodes = settlement.transfers.map((transfer) => {
    const li = document.createElement('li');
    li.className = 'transfer-row';

    const parties = document.createElement('span');
    parties.className = 'transfer-parties';
    parties.append(
      document.createTextNode(transfer.from),
      document.createTextNode(' pays '),
      document.createTextNode(transfer.to)
    );

    const amount = document.createElement('span');
    amount.className = 'transfer-amount';
    amount.textContent = formatCents(transfer.amountCents, currency);

    li.append(parties, amount);
    return li;
  });
  transferList.replaceChildren(...transferNodes);
  transferListEmpty.hidden = transferNodes.length > 0;
}

export function renderTabs(appState = state) {
  const isExpenses = appState.activeTab !== 'settle';

  tabExpenses.classList.toggle('is-active', isExpenses);
  tabExpenses.setAttribute('aria-selected', String(isExpenses));
  tabExpenses.tabIndex = isExpenses ? 0 : -1;

  tabSettle.classList.toggle('is-active', !isExpenses);
  tabSettle.setAttribute('aria-selected', String(!isExpenses));
  tabSettle.tabIndex = isExpenses ? -1 : 0;

  panelExpenses.hidden = !isExpenses;
  panelSettle.hidden = isExpenses;
}
