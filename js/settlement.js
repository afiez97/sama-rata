// Pure, DOM-free settlement math. Integer cents only until formatCents.

export function buildParticipants(members, expenses) {
  const paidByMemberId = new Map();
  for (const expense of expenses) {
    const prev = paidByMemberId.get(expense.paid_by_member_id) || 0;
    paidByMemberId.set(expense.paid_by_member_id, prev + expense.amount_cents);
  }

  const participants = [];
  for (const member of members) {
    const paidCents = paidByMemberId.get(member.id) || 0;
    if (member.is_active || paidCents > 0) {
      participants.push({
        id: member.id,
        name: member.name,
        active: member.is_active,
        paidCents,
      });
    }
  }
  return participants;
}

export function computeSettlement(participants) {
  if (participants.length === 0) {
    return { fairShareCents: 0, totalCents: 0, balances: [], transfers: [] };
  }

  const totalCents = participants.reduce((sum, p) => sum + p.paidCents, 0);
  const n = participants.length;
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;

  const sortedById = [...participants].sort((a, b) => a.id - b.id);
  const shareCentsById = new Map();
  sortedById.forEach((p, index) => {
    shareCentsById.set(p.id, index < remainder ? base + 1 : base);
  });

  const balances = participants.map((p) => {
    const shareCents = shareCentsById.get(p.id);
    return {
      id: p.id,
      name: p.name,
      active: p.active,
      paidCents: p.paidCents,
      shareCents,
      balanceCents: p.paidCents - shareCents,
    };
  });

  const transfers = greedySettle(balances);

  return { fairShareCents: base, totalCents, balances, transfers };
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
