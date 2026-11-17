import type { EventProgress, EventStatus, TransferStatus } from './types'

/** 각 상태에서 갈 수 있는 유일한 다음 상태. null이면 마지막 상태다. */
const NEXT_EVENT_STATUS: Record<EventStatus, EventStatus | null> = {
  open: 'settling',
  settling: 'settled',
  settled: null,
}

const NEXT_TRANSFER_STATUS: Record<TransferStatus, TransferStatus | null> = {
  pending: 'sent',
  sent: 'confirmed',
  confirmed: null,
}

/** 이벤트는 open→settling→settled 순서로 한 단계씩만 이동한다. 되돌리기와 제자리는 거부. */
export function canTransitionEvent(from: EventStatus, to: EventStatus): boolean {
  return NEXT_EVENT_STATUS[from] === to
}

/** 송금은 pending→sent→confirmed 순서로 한 단계씩만 이동한다. 되돌리기와 제자리는 거부. */
export function canTransitionTransfer(from: TransferStatus, to: TransferStatus): boolean {
  return NEXT_TRANSFER_STATUS[from] === to
}

/**
 * 정산 시작 후 이벤트 상태. transferCount는 만들 transfers 건수다.
 * 송금이 0건이면 확인할 것이 없으므로 settling을 거쳐 같은 batch에서 바로 settled가 된다.
 */
export function startSettlement(status: EventStatus, transferCount: number): EventProgress {
  if (!canTransitionEvent(status, 'settling')) {
    throw new Error('진행 중(open)인 이벤트만 정산을 시작할 수 있습니다.')
  }
  if (!Number.isSafeInteger(transferCount) || transferCount < 0) {
    throw new Error('송금 건수는 0 이상의 정수여야 합니다.')
  }
  if (transferCount === 0) {
    return { status: 'settled', pendingCount: 0 }
  }
  return { status: 'settling', pendingCount: transferCount }
}

/**
 * 송금 1건이 confirmed가 된 뒤의 이벤트 상태.
 * pendingCount를 1 줄이고, 결과가 0이면 settled, 아니면 settling을 유지한다.
 */
export function applyTransferConfirmed(event: Readonly<EventProgress>): EventProgress {
  if (event.status !== 'settling') {
    throw new Error('정산 중(settling)인 이벤트에서만 송금을 확인할 수 있습니다.')
  }
  if (!Number.isSafeInteger(event.pendingCount) || event.pendingCount < 1) {
    throw new Error('확인할 송금이 남아 있지 않습니다.')
  }
  const pendingCount = event.pendingCount - 1
  return { status: pendingCount === 0 ? 'settled' : 'settling', pendingCount }
}
