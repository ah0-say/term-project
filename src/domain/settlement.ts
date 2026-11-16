import type { SettlementExpense, SettlementTransfer } from './types'

/** localeCompare는 환경에 따라 달라질 수 있어 코드 단위 비교로 고정한다. */
function compareUid(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** 결과를 (fromUid, toUid) 순으로 정렬한다. */
function sortTransfers(transfers: SettlementTransfer[]): SettlementTransfer[] {
  return transfers.sort(
    (x, y) => compareUid(x.fromUid, y.fromUid) || compareUid(x.toUid, y.toUid),
  )
}

/**
 * active 지출에서 생기는 채무를 (채무자, 채권자, 금액)으로 순회한다.
 * 결제자 본인 분담액과 0원 분담은 채무가 아니다.
 */
function forEachDebt(
  expenses: readonly SettlementExpense[],
  visit: (debtorId: string, creditorId: string, amount: number) => void,
): void {
  for (const expense of expenses) {
    if (expense.status !== 'active') continue
    for (const [uid, share] of Object.entries(expense.shares)) {
      if (uid === expense.payerId || share === 0) continue
      visit(uid, expense.payerId, share)
    }
  }
}

/**
 * 기본 정산(쌍별 상계). 같은 두 사람의 양방향 금액을 합산해 차액 방향으로 1건만 만든다.
 * 차액이 0이면 항목을 만들지 않는다.
 */
export function settlePairwise(expenses: readonly SettlementExpense[]): SettlementTransfer[] {
  // low < high 인 쌍에 대해 "low가 high에게 보낼 금액"(음수면 반대 방향)을 누적한다.
  const owed = new Map<string, Map<string, number>>()
  forEachDebt(expenses, (debtorId, creditorId, amount) => {
    const debtorIsLow = compareUid(debtorId, creditorId) < 0
    const low = debtorIsLow ? debtorId : creditorId
    const high = debtorIsLow ? creditorId : debtorId
    let row = owed.get(low)
    if (!row) {
      row = new Map()
      owed.set(low, row)
    }
    row.set(high, (row.get(high) ?? 0) + (debtorIsLow ? amount : -amount))
  })

  const transfers: SettlementTransfer[] = []
  for (const [low, row] of owed) {
    for (const [high, net] of row) {
      if (net > 0) transfers.push({ fromUid: low, toUid: high, amount: net })
      else if (net < 0) transfers.push({ fromUid: high, toUid: low, amount: -net })
    }
  }
  return sortTransfers(transfers)
}

/** 사람별 순잔액(받을 돈 - 보낼 돈). 전체 합은 항상 0이다. */
export function computeNetBalances(expenses: readonly SettlementExpense[]): Map<string, number> {
  const balances = new Map<string, number>()
  forEachDebt(expenses, (debtorId, creditorId, amount) => {
    balances.set(debtorId, (balances.get(debtorId) ?? 0) - amount)
    balances.set(creditorId, (balances.get(creditorId) ?? 0) + amount)
  })
  return balances
}

/**
 * 횟수 줄이기(근사) 정산. 순잔액 기준으로 채권자와 채무자를 그리디로 매칭한다.
 * 금액 큰 순, 동률은 uid 사전순. 최대 n-1건이며 최소 횟수를 보장하지는 않는다.
 */
export function settleReduced(expenses: readonly SettlementExpense[]): SettlementTransfer[] {
  const byAmountThenUid = (x: { uid: string; left: number }, y: { uid: string; left: number }) =>
    y.left - x.left || compareUid(x.uid, y.uid)

  const creditors: { uid: string; left: number }[] = []
  const debtors: { uid: string; left: number }[] = []
  for (const [uid, balance] of computeNetBalances(expenses)) {
    if (balance > 0) creditors.push({ uid, left: balance })
    else if (balance < 0) debtors.push({ uid, left: -balance })
  }
  creditors.sort(byAmountThenUid)
  debtors.sort(byAmountThenUid)

  const transfers: SettlementTransfer[] = []
  let c = 0
  let d = 0
  while (c < creditors.length && d < debtors.length) {
    const creditor = creditors[c]
    const debtor = debtors[d]
    const amount = Math.min(creditor.left, debtor.left)
    transfers.push({ fromUid: debtor.uid, toUid: creditor.uid, amount })
    creditor.left -= amount
    debtor.left -= amount
    if (creditor.left === 0) c++
    if (debtor.left === 0) d++
  }
  return sortTransfers(transfers)
}
