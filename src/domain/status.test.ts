import { describe, expect, it } from 'vitest'
import {
  applyTransferConfirmed,
  canTransitionEvent,
  canTransitionTransfer,
  startSettlement,
} from './status'
import type { EventStatus, TransferStatus } from './types'

const eventStatuses: EventStatus[] = ['open', 'settling', 'settled']
const transferStatuses: TransferStatus[] = ['pending', 'sent', 'confirmed']

describe('이벤트 상태 전이', () => {
  it('open→settling, settling→settled는 허용', () => {
    expect(canTransitionEvent('open', 'settling')).toBe(true)
    expect(canTransitionEvent('settling', 'settled')).toBe(true)
  })

  it('되돌리기는 거부', () => {
    expect(canTransitionEvent('settling', 'open')).toBe(false)
    expect(canTransitionEvent('settled', 'settling')).toBe(false)
    expect(canTransitionEvent('settled', 'open')).toBe(false)
  })

  it('허용된 두 전이 말고는 전부 거부 (건너뛰기, 제자리 포함)', () => {
    const allowed = new Set(['open>settling', 'settling>settled'])
    for (const from of eventStatuses) {
      for (const to of eventStatuses) {
        expect(canTransitionEvent(from, to)).toBe(allowed.has(`${from}>${to}`))
      }
    }
  })
})

describe('송금 상태 전이', () => {
  it('pending→sent, sent→confirmed는 허용', () => {
    expect(canTransitionTransfer('pending', 'sent')).toBe(true)
    expect(canTransitionTransfer('sent', 'confirmed')).toBe(true)
  })

  it('sent를 건너뛴 pending→confirmed는 거부', () => {
    expect(canTransitionTransfer('pending', 'confirmed')).toBe(false)
  })

  it('허용된 두 전이 말고는 전부 거부 (되돌리기, 제자리 포함)', () => {
    const allowed = new Set(['pending>sent', 'sent>confirmed'])
    for (const from of transferStatuses) {
      for (const to of transferStatuses) {
        expect(canTransitionTransfer(from, to)).toBe(allowed.has(`${from}>${to}`))
      }
    }
  })
})

describe('startSettlement (정산 시작)', () => {
  it('송금이 n건이면 settling, pendingCount n', () => {
    expect(startSettlement('open', 3)).toEqual({ status: 'settling', pendingCount: 3 })
  })

  it('송금이 0건이면 바로 settled, pendingCount 0', () => {
    expect(startSettlement('open', 0)).toEqual({ status: 'settled', pendingCount: 0 })
  })

  it('open이 아닌 이벤트는 정산을 시작할 수 없다', () => {
    expect(() => startSettlement('settling', 3)).toThrow()
    expect(() => startSettlement('settled', 0)).toThrow()
  })

  it('송금 건수가 음수거나 정수가 아니면 거부', () => {
    expect(() => startSettlement('open', -1)).toThrow()
    expect(() => startSettlement('open', 1.5)).toThrow()
  })
})

describe('applyTransferConfirmed (송금 확인 후 pendingCount와 이벤트 상태)', () => {
  it('남은 송금이 있으면 pendingCount만 1 줄고 settling 유지', () => {
    expect(applyTransferConfirmed({ status: 'settling', pendingCount: 3 })).toEqual({
      status: 'settling',
      pendingCount: 2,
    })
  })

  it('마지막 송금이 확인되면 pendingCount 0, settled', () => {
    expect(applyTransferConfirmed({ status: 'settling', pendingCount: 1 })).toEqual({
      status: 'settled',
      pendingCount: 0,
    })
  })

  it('정산 시작부터 3건을 차례로 확인하면 마지막에만 settled', () => {
    let event = startSettlement('open', 3)
    event = applyTransferConfirmed(event)
    expect(event).toEqual({ status: 'settling', pendingCount: 2 })
    event = applyTransferConfirmed(event)
    expect(event).toEqual({ status: 'settling', pendingCount: 1 })
    event = applyTransferConfirmed(event)
    expect(event).toEqual({ status: 'settled', pendingCount: 0 })
  })

  it('입력 객체를 바꾸지 않는다', () => {
    const event = { status: 'settling', pendingCount: 2 } as const
    applyTransferConfirmed(event)
    expect(event).toEqual({ status: 'settling', pendingCount: 2 })
  })

  it('settling이 아닌 이벤트에서는 거부', () => {
    expect(() => applyTransferConfirmed({ status: 'open', pendingCount: 0 })).toThrow()
    expect(() => applyTransferConfirmed({ status: 'settled', pendingCount: 0 })).toThrow()
  })

  it('남은 송금이 없거나 pendingCount가 정수가 아니면 거부', () => {
    expect(() => applyTransferConfirmed({ status: 'settling', pendingCount: 0 })).toThrow()
    expect(() => applyTransferConfirmed({ status: 'settling', pendingCount: 1.5 })).toThrow()
  })
})
