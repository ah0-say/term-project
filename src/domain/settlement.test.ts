import { describe, expect, it } from 'vitest'
import { computeNetBalances, settlePairwise, settleReduced } from './settlement'
import { splitEqual } from './split'
import type { SettlementExpense } from './types'

function expense(
  amount: number,
  payerId: string,
  participantIds: string[],
  status: SettlementExpense['status'] = 'active',
): SettlementExpense {
  return { amount, payerId, shares: splitEqual(amount, participantIds), status }
}

const lunch = expense(30000, 'A', ['A', 'B', 'C']) // 1차 점심
const cafe = expense(15000, 'B', ['A', 'B', 'C']) // 2차 카페
const third = expense(20000, 'A', ['A', 'B']) // 3차 A,B만

describe('SPEC 테스트 예시 1', () => {
  const expenses = [lunch, cafe]

  it('쌍별 상계: B→A 5000, C→A 10000, C→B 5000', () => {
    expect(settlePairwise(expenses)).toEqual([
      { fromUid: 'B', toUid: 'A', amount: 5000 },
      { fromUid: 'C', toUid: 'A', amount: 10000 },
      { fromUid: 'C', toUid: 'B', amount: 5000 },
    ])
  })

  it('횟수 줄이기: C→A 15000 한 건', () => {
    expect(settleReduced(expenses)).toEqual([{ fromUid: 'C', toUid: 'A', amount: 15000 }])
  })
})

describe('SPEC 테스트 예시 2', () => {
  const expenses = [lunch, cafe, third]

  it('쌍별 상계: B→A 15000, C→A 10000, C→B 5000', () => {
    expect(settlePairwise(expenses)).toEqual([
      { fromUid: 'B', toUid: 'A', amount: 15000 },
      { fromUid: 'C', toUid: 'A', amount: 10000 },
      { fromUid: 'C', toUid: 'B', amount: 5000 },
    ])
  })

  it('횟수 줄이기: B→A 10000, C→A 15000', () => {
    expect(settleReduced(expenses)).toEqual([
      { fromUid: 'B', toUid: 'A', amount: 10000 },
      { fromUid: 'C', toUid: 'A', amount: 15000 },
    ])
  })
})

describe('정산 공통 규칙', () => {
  it('취소된 지출은 제외한다', () => {
    const expenses = [lunch, { ...cafe, status: 'cancelled' as const }]
    const expected = [
      { fromUid: 'B', toUid: 'A', amount: 10000 },
      { fromUid: 'C', toUid: 'A', amount: 10000 },
    ]
    expect(settlePairwise(expenses)).toEqual(expected)
    expect(settleReduced(expenses)).toEqual(expected)
  })

  it('지출이 없으면 0건', () => {
    expect(settlePairwise([])).toEqual([])
    expect(settleReduced([])).toEqual([])
  })

  it('양방향 금액이 같으면 차액 0이라 항목을 만들지 않는다', () => {
    const expenses = [expense(20000, 'A', ['A', 'B']), expense(20000, 'B', ['A', 'B'])]
    expect(settlePairwise(expenses)).toEqual([])
    expect(settleReduced(expenses)).toEqual([])
  })

  it('결제자 혼자 부담한 지출은 채무를 만들지 않는다', () => {
    expect(settlePairwise([expense(5000, 'A', ['A'])])).toEqual([])
  })

  it('결제자가 분담에 없으면 참여자 전원이 결제자에게 보낸다', () => {
    expect(settlePairwise([expense(10000, 'A', ['B', 'C'])])).toEqual([
      { fromUid: 'B', toUid: 'A', amount: 5000 },
      { fromUid: 'C', toUid: 'A', amount: 5000 },
    ])
  })

  it('순잔액 합은 0이고, 두 방식 모두 순잔액을 정확히 청산한다', () => {
    const expenses = [lunch, cafe, third, expense(10000, 'C', ['A', 'B', 'C'])]
    const balances = computeNetBalances(expenses)
    expect([...balances.values()].reduce((a, b) => a + b, 0)).toBe(0)

    for (const settle of [settlePairwise, settleReduced]) {
      const after = new Map(balances)
      for (const t of settle(expenses)) {
        expect(t.amount).toBeGreaterThan(0)
        after.set(t.fromUid, (after.get(t.fromUid) ?? 0) + t.amount)
        after.set(t.toUid, (after.get(t.toUid) ?? 0) - t.amount)
      }
      expect([...after.values()].every((v) => v === 0)).toBe(true)
    }
  })
})

describe('횟수 줄이기 세부 규칙', () => {
  it('동률은 uid 사전순으로 매칭하고 결과는 (fromUid, toUid) 순으로 정렬한다', () => {
    // 순잔액: A +10000, B +10000, C -10000, D -10000
    const expenses: SettlementExpense[] = [
      { amount: 10000, payerId: 'A', shares: { C: 10000 }, status: 'active' },
      { amount: 10000, payerId: 'B', shares: { D: 10000 }, status: 'active' },
      // 순잔액은 그대로 두고 채무 관계만 꼬아 놓는다.
      { amount: 3000, payerId: 'C', shares: { D: 3000 }, status: 'active' },
      { amount: 3000, payerId: 'D', shares: { C: 3000 }, status: 'active' },
    ]
    expect(settleReduced(expenses)).toEqual([
      { fromUid: 'C', toUid: 'A', amount: 10000 },
      { fromUid: 'D', toUid: 'B', amount: 10000 },
    ])
  })

  it('건수는 최대 n-1건', () => {
    const ids = ['A', 'B', 'C', 'D', 'E']
    const expenses = [
      expense(10001, 'A', ids),
      expense(7003, 'B', ids),
      expense(999, 'C', ['C', 'D', 'E']),
      expense(45000, 'E', ['A', 'B']),
    ]
    expect(settleReduced(expenses).length).toBeLessThanOrEqual(ids.length - 1)
  })
})
