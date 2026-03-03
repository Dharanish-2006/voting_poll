import { useState, useEffect, useRef, useMemo } from "react"
import { useSocket } from "./useSocket.js"

// ─── Utilities ─────────────────────────────────────────────────────────────────
const totalVotes = (poll) => poll.votes.reduce((a, b) => a + b, 0)
const pct = (v, total) => (total === 0 ? 0 : Math.round((v / total) * 100))
const COLORS = ["#FF6B35", "#FFD700", "#00E5C8", "#A78BFA", "#F472B6", "#60A5FA"]

// Stable voter ID per browser session
const VOTER_ID = (() => {
  let id = sessionStorage.getItem("votenova_voter_id")
  if (!id) { id = `v_${Date.now()}_${Math.random().toString(36).slice(2)}`; sessionStorage.setItem("votenova_voter_id", id) }
  return id
})()

// ─── Icons ─────────────────────────────────────────────────────────────────────
const Icons = {
  Bolt: () => <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  Plus: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="1em" height="1em"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Users: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="1em" height="1em"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Check: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="1em" height="1em"><polyline points="20 6 9 17 4 12"/></svg>,
  BarChart: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="1em" height="1em"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  Lock: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="1em" height="1em"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Download: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="1em" height="1em"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Eye: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="1em" height="1em"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Trash: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="1em" height="1em"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Close: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="1em" height="1em"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Star: () => <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Wifi: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="1em" height="1em"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  WifiOff: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="1em" height="1em"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a11 11 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  Radio: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="1em" height="1em"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>,
}

// ─── Animated Progress Bar ─────────────────────────────────────────────────────
function Bar({ value, max, color, delay = 0 }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setW(max === 0 ? 0 : (value / max) * 100), delay + 80)
    return () => clearTimeout(t)
  }, [value, max, delay])
  return (
    <div style={{ background: "#111128", borderRadius: 8, height: 13, overflow: "hidden", flex: 1 }}>
      <div style={{
        height: "100%", width: `${w}%`, background: color, borderRadius: 8,
        transition: "width 0.65s cubic-bezier(0.34,1.56,0.64,1)",
        boxShadow: `0 0 10px ${color}99`,
      }}/>
    </div>
  )
}

// ─── Live Dot ──────────────────────────────────────────────────────────────────
function LiveDot({ color = "#FF6B35" }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10, flexShrink: 0 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, animation: "ping 1.2s ease-in-out infinite", opacity: 0.7 }}/>
      <span style={{ position: "relative", borderRadius: "50%", width: 10, height: 10, background: color }}/>
    </span>
  )
}

// ─── Connection Banner ─────────────────────────────────────────────────────────
function ConnBanner({ connected, error }) {
  if (connected) return null
  return (
    <div style={{
      background: error ? "#2a0a0a" : "#1a1a0a",
      borderBottom: `1px solid ${error ? "#ff4444" : "#FFD700"}`,
      padding: "8px 24px", textAlign: "center",
      color: error ? "#ff8888" : "#FFD700",
      fontSize: 13, fontFamily: "'DM Mono', monospace",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    }}>
      {error ? <><Icons.WifiOff/> Cannot reach backend — start the server on port 3001</> : <><Icons.Wifi/> Connecting to VoteNova server...</>}
    </div>
  )
}

// ─── Create Poll Modal ─────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreate }) {
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [anonymous, setAnonymous] = useState(true)
  const [timer, setTimer] = useState(60)

  const inp = {
    background: "#0e0e22", border: "1px solid #2e2e52", borderRadius: 10,
    color: "#e0e0ff", padding: "10px 14px", fontSize: 14, width: "100%",
    fontFamily: "'Syne', sans-serif", outline: "none", boxSizing: "border-box",
  }

  const submit = () => {
    if (!question.trim() || options.some(o => !o.trim())) return
    onCreate({ question: question.trim(), options: options.map(o => o.trim()), anonymous, timer })
    onClose()
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000bb", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(145deg,#0b0b1e,#161630)", border: "1px solid #2e2e52", borderRadius: 22, padding: 32, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 0 80px #00E5C820" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ color: "#e0e0ff", fontFamily: "'Syne',sans-serif", fontSize: 20, margin: 0, fontWeight: 800 }}>Create New Poll</h2>
          <button onClick={onClose} style={{ background: "#1e1e38", border: "none", borderRadius: 8, color: "#8888aa", padding: 8, cursor: "pointer" }}><Icons.Close/></button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "#6666aa", fontSize: 11, fontFamily: "'DM Mono',monospace", display: "block", marginBottom: 6, letterSpacing: 1 }}>QUESTION *</label>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask your audience something..." style={{ ...inp, resize: "vertical", minHeight: 76 }}/>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "#6666aa", fontSize: 11, fontFamily: "'DM Mono',monospace", display: "block", marginBottom: 6, letterSpacing: 1 }}>OPTIONS (min 2)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: COLORS[i % COLORS.length] + "22", border: `1px solid ${COLORS[i % COLORS.length]}`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS[i % COLORS.length], fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{String.fromCharCode(65 + i)}</div>
                <input value={opt} onChange={e => { const o = [...options]; o[i] = e.target.value; setOptions(o) }} placeholder={`Option ${String.fromCharCode(65 + i)}`} style={inp}/>
                {options.length > 2 && <button onClick={() => setOptions(options.filter((_,j)=>j!==i))} style={{ background: "#1e1a1a", border: "1px solid #3e2a2a", borderRadius: 7, color: "#ff7777", padding: "6px 8px", cursor: "pointer" }}><Icons.Close/></button>}
              </div>
            ))}
            {options.length < 6 && (
              <button onClick={() => setOptions([...options, ""])} style={{ background: "transparent", border: "1px dashed #2e2e52", borderRadius: 10, color: "#4444aa", padding: 10, cursor: "pointer", fontSize: 13 }}>+ Add option</button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <label style={{ color: "#6666aa", fontSize: 11, fontFamily: "'DM Mono',monospace", display: "block", marginBottom: 6, letterSpacing: 1 }}>TIMER (SEC)</label>
            <input type="number" value={timer} min={10} max={600} onChange={e => setTimer(+e.target.value)} style={inp}/>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ color: "#6666aa", fontSize: 11, fontFamily: "'DM Mono',monospace", display: "block", marginBottom: 6, letterSpacing: 1 }}>VOTING</label>
            <button onClick={() => setAnonymous(!anonymous)} style={{ ...inp, cursor: "pointer", background: anonymous ? "#00E5C811" : "#A78BFA11", border: `1px solid ${anonymous ? "#00E5C8" : "#A78BFA"}`, color: anonymous ? "#00E5C8" : "#A78BFA", textAlign: "left" }}>
              {anonymous ? "🔒 Anonymous" : "👤 Named"}
            </button>
          </div>
        </div>

        <button onClick={submit} disabled={!question.trim() || options.some(o=>!o.trim())} style={{ width: "100%", background: question.trim() ? "linear-gradient(135deg,#FF6B35,#ff9060)" : "#2a2a44", border: "none", borderRadius: 12, color: "#fff", padding: 14, cursor: question.trim() ? "pointer" : "not-allowed", fontSize: 15, fontWeight: 800, fontFamily: "'Syne',sans-serif", transition: "all 0.2s" }}>
          Launch Poll →
        </button>
      </div>
    </div>
  )
}

// ─── Results Modal ─────────────────────────────────────────────────────────────
function ResultsModal({ poll, onClose, onExport }) {
  const total = totalVotes(poll)
  const maxVotes = Math.max(...poll.votes)

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000bb", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(145deg,#0b0b1e,#161630)", border: "1px solid #2e2e52", borderRadius: 22, padding: 32, width: "100%", maxWidth: 500, boxShadow: "0 0 80px #FF6B3520" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              {poll.active && <LiveDot/>}
              <span style={{ color: poll.active ? "#FF6B35" : "#6666aa", fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 600, letterSpacing: 1 }}>
                {poll.active ? "LIVE RESULTS" : "FINAL RESULTS"}
              </span>
              <span style={{ color: "#4444aa", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>· {total} votes</span>
            </div>
            <h2 style={{ color: "#e0e0ff", fontFamily: "'Syne',sans-serif", fontSize: 17, margin: 0, lineHeight: 1.4, maxWidth: 380 }}>{poll.question}</h2>
          </div>
          <button onClick={onClose} style={{ background: "#1e1e38", border: "none", borderRadius: 8, color: "#8888aa", padding: 8, cursor: "pointer", flexShrink: 0, marginLeft: 12 }}><Icons.Close/></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 13, marginBottom: 22 }}>
          {poll.options.map((opt, i) => {
            const p = pct(poll.votes[i], total)
            const isWinner = poll.votes[i] === maxVotes && maxVotes > 0
            return (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: isWinner ? "#fff" : "#9999bb", fontSize: 13, fontFamily: "'Syne',sans-serif", fontWeight: isWinner ? 700 : 400, display: "flex", alignItems: "center", gap: 6 }}>
                    {isWinner && <Icons.Star/>}{opt}
                  </span>
                  <span style={{ color: COLORS[i % COLORS.length], fontSize: 13, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{poll.votes[i]} · {p}%</span>
                </div>
                <Bar value={poll.votes[i]} max={total} color={COLORS[i % COLORS.length]} delay={i * 80}/>
              </div>
            )
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#4444aa", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>Code: <span style={{ color: "#FFD700" }}>{poll.code}</span></span>
          <button onClick={() => onExport(poll.id)} style={{ background: "linear-gradient(135deg,#00E5C8,#00b49e)", border: "none", borderRadius: 10, color: "#051a15", padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <Icons.Download/> Export CSV
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Voter View ────────────────────────────────────────────────────────────────
function VoterView({ polls, onVote }) {
  const activePoll = polls.find(p => p.active)
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState("idle") // idle | loading | voted | error | already
  const [errMsg, setErrMsg] = useState("")

  useEffect(() => { setSelected(null); setStatus("idle") }, [activePoll?.id])

  const handleVote = async () => {
    if (selected === null || !activePoll) return
    setStatus("loading")
    try {
      await onVote(activePoll.id, selected, VOTER_ID)
      setStatus("voted")
    } catch (err) {
      if (err.message === "Already voted") setStatus("already")
      else { setErrMsg(err.message); setStatus("error") }
    }
  }

  // ── Join screen ──
  const [joined, setJoined] = useState(false)
  const [code, setCode] = useState("")
  if (!joined) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, gap: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>🗳️</div>
        <h2 style={{ color: "#e0e0ff", fontFamily: "'Syne',sans-serif", fontSize: 24, margin: "0 0 6px", fontWeight: 800 }}>Join a Session</h2>
        <p style={{ color: "#5555aa", fontFamily: "'DM Mono',monospace", fontSize: 13 }}>Enter your poll code to participate</p>
      </div>
      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 340 }}>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && code.length >= 4 && setJoined(true)} placeholder="NOVA42" style={{ flex: 1, background: "#0e0e22", border: "1px solid #2e2e52", borderRadius: 12, color: "#e0e0ff", padding: "12px 16px", fontSize: 20, fontFamily: "'DM Mono',monospace", outline: "none", textAlign: "center", letterSpacing: 5 }}/>
        <button onClick={() => code.length >= 4 && setJoined(true)} style={{ background: "linear-gradient(135deg,#FF6B35,#ff9060)", border: "none", borderRadius: 12, color: "#fff", padding: "12px 18px", cursor: "pointer", fontSize: 14, fontWeight: 800 }}>→</button>
      </div>
      <button onClick={() => { setCode("NOVA42"); setJoined(true) }} style={{ background: "transparent", border: "1px solid #2e2e52", borderRadius: 10, color: "#5555aa", padding: "8px 16px", cursor: "pointer", fontSize: 12 }}>Use demo code</button>
    </div>
  )

  // ── Waiting ──
  if (!activePoll) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, gap: 16 }}>
      <div style={{ fontSize: 48 }}>⏳</div>
      <h2 style={{ color: "#e0e0ff", fontFamily: "'Syne',sans-serif", margin: 0, fontWeight: 800 }}>Waiting for Host...</h2>
      <p style={{ color: "#5555aa", fontFamily: "'DM Mono',monospace", fontSize: 13 }}>Session <span style={{ color: "#FFD700" }}>NOVA42</span> · {polls.length} poll(s) available</p>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF6B35", animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }}/>)}
      </div>
    </div>
  )

  // ── Already voted ──
  if (status === "already") return (
    <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "center", padding: "40px 0" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✋</div>
      <h2 style={{ color: "#FFD700", fontFamily: "'Syne',sans-serif", margin: "0 0 8px", fontWeight: 800 }}>Already Voted</h2>
      <p style={{ color: "#5555aa", fontFamily: "'DM Mono',monospace", fontSize: 13 }}>You've already submitted a vote for this poll</p>
    </div>
  )

  // ── Voted — show live results ──
  if (status === "voted") {
    const total = totalVotes(activePoll)
    return (
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 38, marginBottom: 8 }}>✅</div>
          <h2 style={{ color: "#00E5C8", fontFamily: "'Syne',sans-serif", margin: "0 0 4px", fontWeight: 800 }}>Vote Submitted!</h2>
          <p style={{ color: "#5555aa", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>Live results — updating in real-time</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activePoll.options.map((opt, i) => {
            const p = pct(activePoll.votes[i], total)
            const isMine = i === selected
            return (
              <div key={i} style={{ background: isMine ? COLORS[i%COLORS.length]+"18" : "#0e0e22", border: `1px solid ${isMine ? COLORS[i%COLORS.length] : "#1e1e38"}`, borderRadius: 12, padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ color: isMine ? "#fff" : "#8888bb", fontSize: 13, fontFamily: "'Syne',sans-serif", fontWeight: isMine ? 700 : 400 }}>{isMine && "✓ "}{opt}</span>
                  <span style={{ color: COLORS[i%COLORS.length], fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700 }}>{p}%</span>
                </div>
                <Bar value={activePoll.votes[i]} max={total} color={COLORS[i%COLORS.length]}/>
              </div>
            )
          })}
        </div>
        <p style={{ textAlign: "center", color: "#4444aa", fontSize: 12, marginTop: 14, fontFamily: "'DM Mono',monospace" }}>{total} votes cast</p>
      </div>
    )
  }

  // ── Vote form ──
  return (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <LiveDot/>
        <span style={{ color: "#FF6B35", fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 700, letterSpacing: 1 }}>LIVE POLL</span>
      </div>
      <h2 style={{ color: "#e0e0ff", fontFamily: "'Syne',sans-serif", fontSize: 20, margin: "0 0 22px", lineHeight: 1.4, fontWeight: 800 }}>{activePoll.question}</h2>

      {status === "error" && <div style={{ background: "#2a0a0a", border: "1px solid #ff4444", borderRadius: 10, padding: "10px 14px", color: "#ff8888", fontSize: 13, marginBottom: 14, fontFamily: "'DM Mono',monospace" }}>⚠️ {errMsg}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {activePoll.options.map((opt, i) => (
          <button key={i} onClick={() => setSelected(i)} style={{ background: selected === i ? COLORS[i%COLORS.length]+"1a" : "#0e0e22", border: `2px solid ${selected === i ? COLORS[i%COLORS.length] : "#1e1e38"}`, borderRadius: 13, padding: "13px 16px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, transition: "all 0.18s" }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: selected === i ? COLORS[i%COLORS.length] : "#1e1e38", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, transition: "all 0.18s" }}>
              {selected === i ? <Icons.Check/> : String.fromCharCode(65 + i)}
            </div>
            <span style={{ color: selected === i ? "#fff" : "#9999bb", fontSize: 14, fontFamily: "'Syne',sans-serif", fontWeight: selected === i ? 700 : 400 }}>{opt}</span>
          </button>
        ))}
      </div>

      <button onClick={handleVote} disabled={selected === null || status === "loading"} style={{ width: "100%", background: selected !== null ? "linear-gradient(135deg,#FF6B35,#ff9060)" : "#1e1e38", border: "none", borderRadius: 13, color: selected !== null ? "#fff" : "#5555aa", padding: 15, cursor: selected !== null ? "pointer" : "not-allowed", fontSize: 15, fontWeight: 800, fontFamily: "'Syne',sans-serif", transition: "all 0.2s" }}>
        {status === "loading" ? "Submitting..." : selected !== null ? "Submit Vote →" : "Select an option"}
      </button>
    </div>
  )
}

// ─── Host Poll Card ────────────────────────────────────────────────────────────
function PollCard({ poll, onActivate, onDelete, onView }) {
  const total = totalVotes(poll)
  const maxVotes = Math.max(...poll.votes)
  const leadIdx = poll.votes.indexOf(maxVotes)
  return (
    <div style={{ background: "linear-gradient(135deg,#0e0e22,#161630)", border: `1px solid ${poll.active ? "#FF6B35" : "#1e1e38"}`, borderRadius: 15, padding: "18px 22px", transition: "transform 0.18s, border-color 0.2s", cursor: "default" }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
    >
      {poll.active && <div style={{ position: "relative", height: 2, marginBottom: 14, borderRadius: 2, overflow: "hidden", background: "#1e1e38" }}><div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,#FF6B35,#FFD700,#00E5C8,#FF6B35)", backgroundSize: "200%", animation: "slide 2s linear infinite" }}/></div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <p style={{ color: "#d0d0f0", fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1.4, flex: 1, paddingRight: 14 }}>{poll.question}</p>
        {poll.active && <LiveDot/>}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {poll.options.map((opt, i) => (
          <span key={i} style={{ background: i === leadIdx && total > 0 ? "#FF6B3520" : "#ffffff08", border: `1px solid ${i === leadIdx && total > 0 ? "#FF6B35" : "#2e2e52"}`, color: i === leadIdx && total > 0 ? "#FF6B35" : "#6666aa", borderRadius: 20, padding: "3px 9px", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
            {opt} · {pct(poll.votes[i], total)}%
          </span>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#5555aa", fontSize: 12, display: "flex", alignItems: "center", gap: 4, fontFamily: "'DM Mono',monospace" }}><Icons.Users/> {total}</span>
          <span style={{ background: poll.anonymous ? "#00E5C818" : "#A78BFA18", color: poll.anonymous ? "#00E5C8" : "#A78BFA", border: `1px solid ${poll.anonymous ? "#00E5C8" : "#A78BFA"}44`, borderRadius: 10, padding: "2px 8px", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
            {poll.anonymous ? "Anon" : "Named"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onView(poll)} style={{ background: "#1a1a30", border: "1px solid #2e2e52", borderRadius: 8, color: "#7777aa", padding: "6px 10px", cursor: "pointer", fontSize: 13 }}><Icons.Eye/></button>
          {!poll.active && <button onClick={() => onActivate(poll.id)} style={{ background: "linear-gradient(135deg,#FF6B35,#ff9060)", border: "none", borderRadius: 8, color: "#fff", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>Launch</button>}
          {poll.active && <button onClick={() => onView(poll)} style={{ background: "#0e2a1a", border: "1px solid #00E5C8", borderRadius: 8, color: "#00E5C8", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><Icons.BarChart/> Live</button>}
          <button onClick={() => onDelete(poll.id)} style={{ background: "#1e0a0a", border: "1px solid #4e2a2a", borderRadius: 8, color: "#ff7777", padding: "6px 10px", cursor: "pointer", fontSize: 13 }}><Icons.Trash/></button>
        </div>
      </div>
    </div>
  )
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { polls, connected, connError, onlineCount, createPoll, activatePoll, closePoll, deletePoll, castVote, exportCSV } = useSocket()
  const [view, setView] = useState("host")
  const [showCreate, setShowCreate] = useState(false)
  const [viewingPoll, setViewingPoll] = useState(null)

  const activePoll = polls.find(p => p.active)
  const totalAllVotes = polls.reduce((a, p) => a + totalVotes(p), 0)

  // Keep results modal in sync with live data
  const livePollForModal = viewingPoll ? polls.find(p => p.id === viewingPoll.id) || viewingPoll : null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:ital,wght@0,400;0,500;1,400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#07071a;color:#e0e0ff}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:#0e0e22}
        ::-webkit-scrollbar-thumb{background:#2e2e52;border-radius:3px}
        @keyframes ping{75%,100%{transform:scale(2.2);opacity:0}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes slide{0%{background-position:0 0}100%{background-position:200% 0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{box-shadow:0 0 18px #FF6B3540}50%{box-shadow:0 0 38px #FF6B3580}}
        textarea:focus,input:focus{border-color:#FF6B3588!important}
        button:active{transform:scale(0.97)}
      `}</style>

      <div style={{ minHeight: "100vh", background: "#07071a", fontFamily: "'Syne',sans-serif" }}>
        {/* Ambient background */}
        <div style={{ position: "fixed", top: -300, right: -300, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,#FF6B3509 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }}/>
        <div style={{ position: "fixed", bottom: -300, left: -300, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,#00E5C808 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }}/>

        {/* Connection banner */}
        <ConnBanner connected={connected} error={connError}/>

        {/* Header */}
        <header style={{ position: "sticky", top: 0, zIndex: 100, background: "#07071aee", backdropFilter: "blur(20px)", borderBottom: "1px solid #12122e" }}>
          <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 62, padding: "0 24px" }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#FF6B35,#FFD700)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 17, animation: "glow 3s ease-in-out infinite" }}>
                <Icons.Bolt/>
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: -0.5 }}>Vote<span style={{ color: "#FF6B35" }}>Nova</span></div>
                <div style={{ color: "#4444aa", fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: 2 }}>REAL-TIME POLLING</div>
              </div>
            </div>

            {/* Tab switcher */}
            <div style={{ display: "flex", background: "#0e0e22", borderRadius: 11, padding: 3, border: "1px solid #1e1e38" }}>
              {["host","voter"].map(v => (
                <button key={v} onClick={() => setView(v)} style={{ background: view === v ? "linear-gradient(135deg,#FF6B35,#ff9060)" : "transparent", border: "none", borderRadius: 8, color: view === v ? "#fff" : "#5555aa", padding: "7px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Syne',sans-serif", transition: "all 0.2s" }}>
                  {v === "host" ? "🎙 Host" : "🗳 Vote"}
                </button>
              ))}
            </div>

            {/* Right controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, background: connected ? "#00E5C812" : "#ffffff08", border: `1px solid ${connected ? "#00E5C844" : "#2e2e52"}`, borderRadius: 20, padding: "5px 10px" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "#00E5C8" : "#ff6666", flexShrink: 0 }}/>
                <span style={{ color: connected ? "#00E5C8" : "#ff6666", fontSize: 10, fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{connected ? "LIVE" : "OFFLINE"}</span>
              </div>
              {view === "host" && (
                <button onClick={() => setShowCreate(true)} style={{ background: "linear-gradient(135deg,#FF6B35,#ff9060)", border: "none", borderRadius: 9, color: "#fff", padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icons.Plus/> New Poll
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main */}
        <main style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px", position: "relative", zIndex: 1 }}>
          {view === "host" ? (
            <div style={{ animation: "fadeUp 0.35s ease" }}>
              {/* Stats row */}
              <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
                {[
                  { label: "Total Polls", value: polls.length, color: "#A78BFA" },
                  { label: "Total Votes", value: totalAllVotes, color: "#00E5C8" },
                  { label: "Online Now", value: activePoll ? onlineCount : "—", color: "#60A5FA" },
                  { label: "Session Code", value: "NOVA42", color: "#FFD700" },
                ].map((s, i) => (
                  <div key={i} style={{ background: "linear-gradient(135deg,#0e0e22,#141430)", border: `1px solid ${s.color}22`, borderRadius: 12, padding: "12px 18px", flex: 1, minWidth: 110 }}>
                    <div style={{ color: s.color, fontSize: 20, fontWeight: 800, fontFamily: "'DM Mono',monospace", letterSpacing: -1 }}>{s.value}</div>
                    <div style={{ color: "#4444aa", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* QR / session join banner */}
              <div style={{ background: "linear-gradient(135deg,#0e0e22,#141430)", border: "1px solid #1e1e38", borderRadius: 15, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
                <div style={{ width: 52, height: 52, background: "#fff", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="40" height="40" viewBox="0 0 21 21" fill="#07071a">
                    <rect x="1" y="1" width="5" height="5"/><rect x="15" y="1" width="5" height="5"/>
                    <rect x="1" y="15" width="5" height="5"/><rect x="2" y="2" width="3" height="3" fill="#fff"/>
                    <rect x="16" y="2" width="3" height="3" fill="#fff"/><rect x="2" y="16" width="3" height="3" fill="#fff"/>
                    <rect x="8" y="1" width="2" height="2"/><rect x="11" y="1" width="2" height="2"/>
                    <rect x="8" y="4" width="2" height="2"/><rect x="11" y="4" width="2" height="2"/>
                    <rect x="8" y="7" width="5" height="2"/><rect x="1" y="8" width="5" height="5"/>
                    <rect x="2" y="9" width="3" height="3" fill="#fff"/>
                    <rect x="8" y="11" width="2" height="2"/><rect x="11" y="11" width="5" height="5"/>
                    <rect x="16" y="16" width="5" height="5"/><rect x="8" y="15" width="2" height="2"/>
                    <rect x="11" y="8" width="9" height="2"/><rect x="8" y="18" width="2" height="2"/>
                    <rect x="12" y="17" width="3" height="3" fill="#fff"/>
                  </svg>
                </div>
                <div>
                  <div style={{ color: "#d0d0f0", fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, marginBottom: 3 }}>Audience Join Code</div>
                  <div style={{ color: "#FFD700", fontFamily: "'DM Mono',monospace", fontSize: 24, fontWeight: 700, letterSpacing: 5 }}>NOVA42</div>
                  <div style={{ color: "#4444aa", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>votenova.app/join · or switch to Vote tab</div>
                </div>
                {activePoll && (
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, background: "#FF6B3514", border: "1px solid #FF6B3544", borderRadius: 20, padding: "6px 12px" }}>
                    <Icons.Radio/>
                    <span style={{ color: "#FF6B35", fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{onlineCount} online</span>
                  </div>
                )}
              </div>

              {/* Active poll spotlight */}
              {activePoll && (
                <div style={{ background: "linear-gradient(135deg,#160800,#201000)", border: "1px solid #FF6B35", borderRadius: 18, padding: 22, marginBottom: 22, animation: "glow 3s ease-in-out infinite" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <LiveDot/><span style={{ color: "#FF6B35", fontSize: 11, fontFamily: "'DM Mono',monospace", fontWeight: 700, letterSpacing: 1 }}>ACTIVE POLL</span>
                        <span style={{ color: "#6666aa", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>· {totalVotes(activePoll)} votes</span>
                      </div>
                      <h3 style={{ color: "#fff", fontSize: 17, fontWeight: 800, maxWidth: 480, lineHeight: 1.4 }}>{activePoll.question}</h3>
                    </div>
                    <button onClick={() => setViewingPoll(activePoll)} style={{ background: "#FF6B3520", border: "1px solid #FF6B3555", borderRadius: 9, color: "#FF6B35", padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, flexShrink: 0, marginLeft: 12 }}>
                      <Icons.BarChart/> Full Results
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
                    {activePoll.options.map((opt, i) => {
                      const total = totalVotes(activePoll)
                      const p = pct(activePoll.votes[i], total)
                      const isLeader = activePoll.votes[i] === Math.max(...activePoll.votes) && total > 0
                      return (
                        <div key={i}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ color: isLeader ? "#fff" : "#9999bb", fontSize: 13, fontWeight: isLeader ? 700 : 400, display: "flex", alignItems: "center", gap: 5 }}>
                              {isLeader && "👑 "}{opt}
                            </span>
                            <span style={{ color: COLORS[i%COLORS.length], fontSize: 13, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{activePoll.votes[i]} · {p}%</span>
                          </div>
                          <Bar value={activePoll.votes[i]} max={total} color={COLORS[i%COLORS.length]} delay={i*60}/>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => closePoll(activePoll.id)} style={{ background: "#160800", border: "1px solid #FF6B35", borderRadius: 8, color: "#FF6B35", padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                      <Icons.Lock/> Close Poll
                    </button>
                    <button onClick={() => exportCSV(activePoll.id)} style={{ background: "#071608", border: "1px solid #00E5C8", borderRadius: 8, color: "#00E5C8", padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                      <Icons.Download/> Export CSV
                    </button>
                  </div>
                </div>
              )}

              {/* All polls list */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ color: "#4444aa", fontSize: 11, fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>
                  ALL POLLS ({polls.filter(p => !p.active).length} inactive)
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {polls.filter(p => !p.active).map(poll => (
                  <PollCard key={poll.id} poll={poll} onActivate={activatePoll} onDelete={deletePoll} onView={setViewingPoll}/>
                ))}
                {polls.filter(p => !p.active).length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#3333aa", fontFamily: "'DM Mono',monospace", fontSize: 13, border: "1px dashed #1e1e38", borderRadius: 14 }}>
                    No polls yet · click <strong style={{ color: "#FF6B35" }}>New Poll</strong> to create one
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ animation: "fadeUp 0.35s ease" }}>
              <VoterView polls={polls} onVote={castVote}/>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={createPoll}/>}
      {livePollForModal && <ResultsModal poll={livePollForModal} onClose={() => setViewingPoll(null)} onExport={exportCSV}/>}
    </>
  )
}
