export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface Transaction {
  id: string
  merchant: string
  amount: number
  country: string
  mcc: string
  card: string
  ip: string
  velocity: number
  score: number
  level: RiskLevel
  time: string
  timestamp: number
  newMerchant: boolean
  blocked: boolean
  approved: boolean
}

export interface Signal {
  type: 'danger' | 'warn' | 'ok'
  msg: string
}