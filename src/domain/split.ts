import type { Shares } from './types'

function assertAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error('금액은 0 이상의 정수(원)여야 합니다.')
  }
}

/**
 * 균등분할. 몫을 모두에게 주고, 나머지 r원은 참여자 목록 앞 r명에게 1원씩 더한다.
 * 예: 10000원을 3명이 나누면 3334, 3333, 3333.
 */
export function splitEqual(amount: number, participantIds: readonly string[]): Shares {
  assertAmount(amount)
  const count = participantIds.length
  if (count === 0) {
    throw new Error('참여자가 한 명 이상 있어야 합니다.')
  }
  if (new Set(participantIds).size !== count) {
    throw new Error('참여자가 중복되었습니다.')
  }

  const remainder = amount % count
  const base = (amount - remainder) / count
  const shares: Shares = {}
  participantIds.forEach((uid, index) => {
    shares[uid] = index < remainder ? base + 1 : base
  })
  return shares
}

export type SharesValidation = { ok: true } | { ok: false; reason: string }

/**
 * 직접입력분할 검사. 각 분담액이 0 이상의 정수이고 합계가 총액과 같아야 한다.
 * ok가 false면 저장을 거부한다.
 */
export function validateCustomShares(amount: number, shares: Shares): SharesValidation {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    return { ok: false, reason: '금액은 0 이상의 정수(원)여야 합니다.' }
  }
  let sum = 0
  for (const share of Object.values(shares)) {
    if (!Number.isSafeInteger(share) || share < 0) {
      return { ok: false, reason: '분담액은 0 이상의 정수(원)여야 합니다.' }
    }
    sum += share
  }
  if (sum !== amount) {
    return { ok: false, reason: `분담액 합계(${sum}원)가 총액(${amount}원)과 다릅니다.` }
  }
  return { ok: true }
}
