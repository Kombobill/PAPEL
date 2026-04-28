'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { Transaction, Signal, RiskLevel } from '@/lib/types'
import { computeSignals, generateTransaction, riskLevel } from '@/lib/fraudScorer'

const riskColor = (s: number) => s >= 70 ? '#E24B4A' : s >= 40 ? '#BA7517' : '#3B6D11'
const riskBg    = (s: number) => s >= 70 ? '#FCEBEB' : s >= 40 ? '#FAEEDA' : '#EAF3DE'
const riskFg    = (s: number) => s >= 70 ? '#791F1F' : s >= 40 ? '#633806' : '#27500A'

export default function FraudDashboard() {
  const [txs, setTxs]             = useState<Transaction[]>([])
  const [selected, setSelected]   = useState<Transaction | null>(null)
  const [filter, setFilter]       = useState<'all' | RiskLevel>('all')
  const [explanation, setExplanation] = useState('')
  const [explaining, setExplaining]   = useState(false)
  const [streaming, setStreaming]     = useState(false)
  const counter = useRef(0)

  // Load transactions on mount
  useEffect(() => {
    fetch('/api/transactions').then(r => r.json()).then(setTxs)
  }, [])

  // Stream a new transaction every 4 seconds
  useEffect(() => {
    const id = setInterval(async () => {
      const tx = generateTransaction(counter.current++ % 15 + Math.floor(Math.random() * 15))
      setStreaming(true)
      setTimeout(() => setStreaming(false), 800)
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
      })
      setTxs(p => [tx, ...p.slice(0, 199)])
    }, 4000)
    return () => clearInterval(id)
  }, [])

  const select = useCallback((tx: Transaction) => {
    setSelected(tx)
    setExplanation('')
  }, [])

  const patch = useCallback(async (update: Partial<Transaction>) => {
    if (!selected) return
    await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, update }),
    })
    const updated = { ...selected, ...update }
    setSelected(updated)
    setTxs(p => p.map(t => t.id === updated.id ? updated : t))
  }, [selected])

  const explain = useCallback(async () => {
    if (!selected || explaining) return
    setExplaining(true)
    setExplanation('')
    const res = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selected),
    })
    if (!res.body) { setExplaining(false); return }
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      setExplanation(p => p + dec.decode(value))
    }
    setExplaining(false)
  }, [selected, explaining])

  const filtered    = txs.filter(t => filter === 'all' || t.level === filter)
  const flagged     = txs.filter(t => t.level === 'HIGH').length
  const blockedAmt  = txs.filter(t => t.blocked).reduce((s, t) => s + t.amount, 0)
  const avg         = txs.length ? Math.round(txs.reduce((s,t) => s + t.score, 0) / txs.length) : 0
  const signals: Signal[] = selected ? computeSignals(selected) : []

  return (
    <div style={{ fontFamily:'system-ui,sans-serif', padding:24, maxWidth:1100, margin:'0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, background:'#E24B4A', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L2 6v6l7 4 7-4V6L9 2z" stroke="white" strokeWidth="1.5"/>
              <path d="M9 7v4M7 9h4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:600 }}>FraudSentinel</div>
            <div style={{ fontSize:12, color:'#888' }}>Real-time transaction monitoring</div>
          </div>
        </div>
        <div style={{ fontSize:12, color:'#3B6D11', background:'#EAF3DE', border:'1px solid #C0DD97', padding:'4px 12px', borderRadius:20 }}>
          {streaming ? '⚡ New transaction...' : '🟢 Live — scanning'}
        </div>
      </div>

      {/* ── Metrics ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:20 }}>
        {[
          ['Flagged today',    flagged,    '#E24B4A'],
          ['Blocked $',        `$${blockedAmt.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}`, '#BA7517'],
          ['False positive',   '2.1%',     '#3B6D11'],
          ['Accuracy',         '97.8%',    '#3B6D11'],
          ['Avg risk score',   avg,        undefined],
        ].map(([label, value, color]) => (
          <div key={label as string} style={{ background:'#f7f7f5', borderRadius:8, padding:'12px 14px' }}>
            <div style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:600, color:(color as string) ?? 'inherit' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Two-panel layout ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:14 }}>

        {/* Feed */}
        <div style={{ background:'#fff', border:'1px solid #e5e5e3', borderRadius:12, padding:'14px 16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
            <span style={{ fontSize:13, fontWeight:600 }}>Transaction feed</span>
            <div style={{ display:'flex', gap:6 }}>
              {(['all','HIGH','MEDIUM','LOW'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  fontSize:11, padding:'3px 10px', borderRadius:12, border:'1px solid',
                  cursor:'pointer', fontFamily:'inherit',
                  background: filter===f ? '#E24B4A' : 'transparent',
                  borderColor: filter===f ? '#E24B4A' : '#ccc',
                  color: filter===f ? '#fff' : '#666',
                }}>{f==='all'?'All':f[0]+f.slice(1).toLowerCase()}</button>
              ))}
            </div>
          </div>
          <div style={{ maxHeight:420, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
            {filtered.map(tx => (
              <div key={tx.id} onClick={() => select(tx)} style={{
                display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer',
                background: selected?.id===tx.id ? '#f7f7f5' : 'transparent',
                border: selected?.id===tx.id ? '1px solid #ddd' : '1px solid transparent',
              }}>
                <div style={{ width:32, height:32, borderRadius:8, background:riskBg(tx.score), color:riskFg(tx.score), display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, flexShrink:0 }}>
                  {tx.merchant.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tx.merchant}</div>
                  <div style={{ fontSize:11, color:'#888' }}>{tx.id} · {tx.time}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                  <span style={{ fontSize:13, fontWeight:500, color:tx.score>70?'#E24B4A':'inherit' }}>${tx.amount.toLocaleString()}</span>
                  <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, fontWeight:600, background:riskBg(tx.score), color:riskFg(tx.score) }}>{tx.level}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div style={{ background:'#fff', border:'1px solid #e5e5e3', borderRadius:12, padding:'14px 16px', overflowY:'auto' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'#999' }}>
            {selected ? `Transaction — ${selected.id}` : 'Select a transaction'}
          </div>
          {!selected && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:200, color:'#bbb', fontSize:13, gap:8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 13h4M7 16h2"/>
              </svg>
              Click any transaction to inspect
            </div>
          )}
          {selected && (
            <>
              {/* Risk bar */}
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>Risk score</div>
                <div style={{ height:8, borderRadius:4, background:'#f0f0ee', overflow:'hidden', marginBottom:3 }}>
                  <div style={{ height:'100%', width:`${selected.score}%`, background:riskColor(selected.score), borderRadius:4, transition:'width .4s' }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#888' }}>
                  <span>0</span>
                  <span style={{ fontWeight:600, color:riskColor(selected.score) }}>{selected.score}/100</span>
                  <span>100</span>
                </div>
              </div>
              {/* Fields */}
              {[
                ['Merchant', selected.merchant], ['Amount', `$${selected.amount.toLocaleString()}`],
                ['Card', selected.card], ['Country', selected.country],
                ['MCC', selected.mcc], ['IP', selected.ip],
                ['Velocity', `${selected.velocity} tx/hr`],
                ['Status', selected.blocked ? '🔴 Blocked' : selected.approved ? '🟢 Approved' : '⚪ Active'],
              ].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f0f0ee', fontSize:13 }}>
                  <span style={{ color:'#888' }}>{k}</span>
                  <span style={{ fontWeight:500 }}>{v}</span>
                </div>
              ))}
              {/* Signals */}
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:10 }}>
                {signals.map((s,i) => (
                  <div key={i} style={{ display:'flex', gap:8, fontSize:12, padding:'5px 8px', borderRadius:6,
                    background: s.type==='danger'?'#FCEBEB':s.type==='warn'?'#FAEEDA':'#EAF3DE',
                    color: s.type==='danger'?'#791F1F':s.type==='warn'?'#633806':'#27500A' }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, marginTop:3,
                      background: s.type==='danger'?'#A32D2D':s.type==='warn'?'#BA7517':'#3B6D11' }}/>
                    {s.msg}
                  </div>
                ))}
              </div>
              {/* Actions */}
              <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
                <button onClick={() => patch({ blocked:true, approved:false })}
                  style={{ fontSize:12, padding:'6px 14px', borderRadius:6, border:'1px solid #A32D2D', background:'#FCEBEB', color:'#791F1F', cursor:'pointer', fontFamily:'inherit' }}>
                  Block
                </button>
                <button onClick={() => { const s = Math.max(5, selected.score-30); patch({ blocked:false, approved:true, score:s, level:riskLevel(s) }) }}
                  style={{ fontSize:12, padding:'6px 14px', borderRadius:6, border:'1px solid #3B6D11', background:'#EAF3DE', color:'#27500A', cursor:'pointer', fontFamily:'inherit' }}>
                  Approve
                </button>
                <button onClick={explain} disabled={explaining}
                  style={{ fontSize:12, padding:'6px 14px', borderRadius:6, border:'1px solid #ddd', background:'transparent', cursor:explaining?'wait':'pointer', fontFamily:'inherit' }}>
                  {explaining ? 'Analyzing...' : 'AI Explain ✦'}
                </button>
              </div>
              {explanation && (
                <div style={{ marginTop:12, padding:'10px 12px', background:'#f7f7f5', borderRadius:8, fontSize:12, lineHeight:1.7, color:'#444', whiteSpace:'pre-wrap' }}>
                  {explanation}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}