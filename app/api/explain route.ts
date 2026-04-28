import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { Transaction } from '@/lib/types'
import { computeSignals } from '@/lib/fraudScorer'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const tx: Transaction = await req.json()
  const signals = computeSignals(tx)

  const prompt = `You are a senior fraud analyst. Analyze this transaction concisely.

Transaction: ${tx.merchant} | $${tx.amount} | ${tx.country} | MCC ${tx.mcc} | Score ${tx.score}/100 | Velocity ${tx.velocity}/hr

Signals:
${signals.map(s => `- [${s.type.toUpperCase()}] ${s.msg}`).join('\n')}

Give:
1. 2-sentence risk summary
2. Top 3 red/green flags
3. Recommended action + one-line reason

Under 200 words. Professional and concise.`

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new NextResponse(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}