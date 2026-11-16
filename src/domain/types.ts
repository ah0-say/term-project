/** 금액은 모두 원 단위 정수다. */
export type Shares = Record<string, number>

export type ExpenseStatus = 'active' | 'cancelled'

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
