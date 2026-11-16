import { describe, expect, it } from 'vitest'
import { splitEqual, validateCustomShares } from './split'

const sum = (shares: Record<string, number>) =>
  Object.values(shares).reduce((total, share) => total + share, 0)

describe('splitEqual (균등분할)', () => {
  it('SPEC 나머지 예시: 10000원을 3명이 나누면 3334, 3333, 3333', () => {
    expect(splitEqual(10000, ['A', 'B', 'C'])).toEqual({ A: 3334, B: 3333, C: 3333 })
  })

  it('나누어떨어지면 모두 같은 금액', () => {
    expect(splitEqual(30000, ['A', 'B', 'C'])).toEqual({ A: 10000, B: 10000, C: 10000 })
  })

  it('나머지 r원은 참여자 목록 앞 r명에게 1원씩 (uid 순서가 아니라 목록 순서)', () => {
    expect(splitEqual(10, ['C', 'A', 'B', 'D'])).toEqual({ C: 3, A: 3, B: 2, D: 2 })
  })

  it('금액이 인원보다 적으면 앞 사람부터 1원, 나머지는 0원', () => {
    expect(splitEqual(2, ['A', 'B', 'C'])).toEqual({ A: 1, B: 1, C: 0 })
  })

  it('분담 합계는 항상 총액과 같다', () => {
    for (const amount of [0, 1, 7, 9999, 10000, 123457]) {
      for (const count of [1, 2, 3, 7]) {
        const ids = Array.from({ length: count }, (_, i) => `u${i}`)
        expect(sum(splitEqual(amount, ids))).toBe(amount)
      }
    }
  })

  it('참여자가 없거나 중복이면 거부', () => {
    expect(() => splitEqual(1000, [])).toThrow()
    expect(() => splitEqual(1000, ['A', 'A'])).toThrow()
  })

  it('정수가 아니거나 음수인 금액은 거부', () => {
    expect(() => splitEqual(100.5, ['A', 'B'])).toThrow()
    expect(() => splitEqual(-100, ['A', 'B'])).toThrow()
  })
})

describe('validateCustomShares (직접입력 합계 검사)', () => {
  it('합계가 총액과 같으면 통과', () => {
    expect(validateCustomShares(10000, { A: 5000, B: 3000, C: 2000 })).toEqual({ ok: true })
  })

  it('합계가 총액보다 적으면 거부', () => {
    expect(validateCustomShares(10000, { A: 5000, B: 3000 }).ok).toBe(false)
  })

  it('합계가 총액보다 많으면 거부', () => {
    expect(validateCustomShares(10000, { A: 5000, B: 5001 }).ok).toBe(false)
  })

  it('소수나 음수 분담액은 합계가 맞아도 거부', () => {
    expect(validateCustomShares(10000, { A: 5000.5, B: 4999.5 }).ok).toBe(false)
    expect(validateCustomShares(10000, { A: 11000, B: -1000 }).ok).toBe(false)
  })
})
