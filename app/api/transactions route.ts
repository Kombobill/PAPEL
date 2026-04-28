import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { seedTransactions } from '@/lib/fraudScorer'
import type { Transaction } from '@/lib/types'

// Swap for Prisma + Postgres in production
const DATA_FILE = path.join(process.cwd(), '.fraud-data.json')

function load(): Transaction[] {
  if (!fs.existsSync(DATA_FILE)) {
    const seed = seedTransactions(30)
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed))
    return seed
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
}

function save(txs: Transaction[]) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(txs))
}

// GET — fetch all transactions
export async function GET() {
  return NextResponse.json(load())
}

// PATCH — block or approve a transaction
export async function PATCH(req: NextRequest) {
  const { id, update } = await req.json() as { id: string; update: Partial<Transaction> }
  const txs = load()
  const idx = txs.findIndex(t => t.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  txs[idx] = { ...txs[idx], ...update }
  save(txs)
  return NextResponse.json(txs[idx])
}

// POST — add new transaction from live feed
export async function POST(req: NextRequest) {
  const tx: Transaction = await req.json()
  const txs = load()
  txs.unshift(tx)
  if (txs.length > 200) txs.splice(200)
  save(txs)
  return NextResponse.json(tx)
}