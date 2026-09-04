// Pure, DOM-free settlement math. Integer cents only until formatCents.

// Splits amountCents across participantIds with a deterministic remainder
// (sorted by id, first N get the extra cent) so shares always sum to
// exactly amountCents — no float drift, no missing/duplicated cents.
function splitExpenseCents(amountCents, participantIds) {
  const n = participantIds.length;
  const base = Math.floor(amountCents / n);
  const remainder = amountCents - base * n;
  const sortedIds = [...participantIds].sort((a, b) => a - b);

  const shareById = new Map();
  sortedIds.forEach((id, index) => {
    shareById.set(id, index < remainder ? base + 1 : base);
  });
  return shareById;
}

// Each expense is split only among the members ticked on it (expense.participants),
// not the whole trip — so there is no single global "fair share" anymore. A member's
// balance is what they paid across all expenses minus what they owe across the
// expenses they're a participant on.
export function computeSettlement(members, expenses) {
  const paidCentsById = new Map();
  const owedCentsById = new Map();

  for (const expense of expenses) {
    const prevPaid = paidCentsById.get(expense.paid_by_member_id) || 0;
    paidCentsById.set(expense.paid_by_member_id, prevPaid + expense.amount_cents);

    const participantIds = expense.participants.map((p) => p.id);
    if (participantIds.length === 0) continue;
    const shareById = splitExpenseCents(expense.amount_cents, participantIds);
    for (const [id, share] of shareById) {
      owedCentsById.set(id, (owedCentsById.get(id) || 0) + share);
    }
  }

  const totalCents = expenses.reduce((sum, e) => sum + e.amount_cents, 0);

  const balances = members
    .filter((m) => m.is_active || paidCentsById.has(m.id) || owedCentsById.has(m.id))
    .map((m) => {
      const paidCents = paidCentsById.get(m.id) || 0;
      const owedCents = owedCentsById.get(m.id) || 0;
      return {
        id: m.id,
        name: m.name,
        active: m.is_active,
        paidCents,
        owedCents,
        balanceCents: paidCents - owedCents,
      };
    });

  const transfers = greedySettle(balances);

  return { totalCents, balances, transfers };
}

export function greedySettle(balances) {
  const creditors = balances
    .filter((b) => b.balanceCents > 0)
    .map((b) => ({ id: b.id, name: b.name, amount: b.balanceCents }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter((b) => b.balanceCents < 0)
    .map((b) => ({ id: b.id, name: b.name, amount: -b.balanceCents }))
    .sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);

    transfers.push({ from: debtor.name, to: creditor.name, amountCents: amount });

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount === 0) ci++;
    if (debtor.amount === 0) di++;
  }

  return transfers;
}

export function formatCents(cents, currencySymbol) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${currencySymbol} ${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function balanceLabel(balanceCents) {
  if (balanceCents > 0) return 'gets-back';
  if (balanceCents < 0) return 'owes';
  return 'settled';
}
