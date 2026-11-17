/** 금액은 모두 원 단위 정수다. */
export type Shares = Record<string, number>

export type ExpenseStatus = 'active' | 'cancelled'

export type EventStatus = 'open' | 'settling' | 'settled'

export type TransferStatus = 'pending' | 'sent' | 'confirmed'

/** 이벤트의 정산 진행 상태. pendingCount는 아직 confirmed가 아닌 송금 건수다. */
export interface EventProgress {
  status: EventStatus
  pendingCount: number
}

/** 정산 계산에 필요한 지출 필드만 담는다. */
export interface SettlementExpense {
  amount: number
  payerId: string
  shares: Shares
  status: ExpenseStatus
}

/** fromUid가 toUid에게 amount원을 보낸다. */
export interface SettlementTransfer {
  fromUid: string
  toUid: string
  amount: number
}
