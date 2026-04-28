import type { Transaction, RiskLevel, Signal } from './types'

const HIGH_RISK_COUNTRIES = new Set(['NG', 'RU', 'PH', 'CN', 'KY', 'MT', 'VN', 'UA'])
const HIGH_RISK_MCC = new Set(['6099', '6051', '7993', '7995', '6211'])

const MERCHANTS = ['Amazon', 'Walmart', 'Unknown ATM', 'Shell Gas', 'Coinbase',
  'Offshore Transfer', 'Apple Store', 'Steam', 'Suspicious VPN', 'Target',
  'Casino Online', 'PayPal', 'Foreign Wire', 'Netflix', 'Crypto Exchange']
const COUNTRIES = ['US','US','NG','US','KY','RU','US','US','PH','US','MT','US','CN','US','US']
const MCC_CODES  = ['5411','5411','6011','5541','6051','6099','5732','7995','7372','5311','7993','6012','6099','7829','6051']
const BASE_SCORES = [12, 10, 72, 20, 65, 90, 8, 30, 85, 14, 78, 18, 88, 5, 80]

export function riskLevel(score: number): RiskLevel {
  if (score >= 70) return 'HIGH'
  if (score >= 40) return 'MEDIUM'
  return 'LOW'
}

export function computeSignals(tx: Transaction): Signal[] {
  const signals: Signal[] = []
  if (tx.score >= 70)
    signals.push({ type: 'danger', msg: 'Score exceeds high-risk threshold (>=70)' })
  if (tx.velocity > 4)
    signals.push({ type: 'danger', msg: `Velocity alert: ${tx.velocity} transactions in 1 hour` })
  if (HIGH_RISK_COUNTRIES.has(tx.country))
    signals.push({ type: 'danger', msg: `High-risk country: ${tx.country}` })
  const hour = new Date(tx.timestamp).getHours()
  if (hour < 6 || hour > 22)
    signals.push({ type: 'warn', msg: 'Unusual transaction hour (outside normal hours)' })
  if (tx.newMerchant)
    signals.push({ type: 'warn', msg: 'First transaction with this merchant' })
  if (tx.amount > 2000)
    signals.push({ type: 'warn', msg: `Large amount: $${tx.amount.toLocaleString()}` })
  if (HIGH_RISK_MCC.has(tx.mcc))
    signals.push({ type: 'warn', msg: `High-risk MCC code: ${tx.mcc}` })
  if (signals.length === 0)
    signals.push({ type: 'ok', msg: 'No anomalies detected — transaction appears normal' })
  return signals
}

export function generateTransaction(index: number): Transaction {
  const mi = index % MERCHANTS.length
  const baseScore = BASE_SCORES[mi]
  const score = Math.min(99, Math.max(2, baseScore + Math.floor((Math.random() - 0.5) * 22)))
  const amount = score > 65
    ? parseFloat((Math.random() * 4800 + 200).toFixed(2))
    : parseFloat((Math.random() * 350 + 5).toFixed(2))
  const now = Date.now()
  const timestamp = now - Math.floor(Math.random() * 86400000)
  const date = new Date(timestamp)
  const timeStr = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`
  const daysAgo = Math.floor((now - timestamp) / 86400000)
  return {
    id: 'TXN-' + String(10000 + index + Math.floor(Math.random() * 90000)),
    merchant: MERCHANTS[mi],
    country: COUNTRIES[mi],
    mcc: MCC_CODES[mi],
    amount, score,
    level: riskLevel(score),
    time: `${daysAgo === 0 ? 'Today' : 'Yesterday'} ${timeStr}`,
    timestamp,
    card: '**** ' + (1000 + Math.floor(Math.random() * 8999)),
    ip: score > 70
      ? `${Math.floor(Math.random()*200+50)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.1`
      : '192.168.1.1',
    velocity: score > 70
      ? Math.floor(Math.random() * 8 + 3)
      : Math.floor(Math.random() * 2 + 1),
    newMerchant: score > 60,
    blocked: false,
    approved: false,
  }
}

export function seedTransactions(count = 30): Transaction[] {
  return Array.from({ length: count }, (_, i) => generateTransaction(i))
}