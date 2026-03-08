"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Monitor, Volume2, Square, Loader2, Send, CheckCircle2 } from "lucide-react";
import { useRecorder } from "@/lib/use-recorder";
import {
  createSession, uploadAudioChunk, getTranscript, askQuestion,
  finishSession, startSystemCapture, stopSystemCapture,
  type Segment, type Summary,
} from "@/lib/api";

type QaEntry = { question: string; answer: string };
type AudioDevice = { deviceId: string; label: string };

const COLORS = ["#4f7df9", "#f04545", "#34c759", "#f5a623", "#a855f7", "#14b8a6", "#f97316", "#ec4899"];
function spkColor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return COLORS[h % COLORS.length];
}
function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RecordPage() {
  const router = useRouter();

  // Config
  const [name, setName] = useState("");
  const [screen, setScreen] = useState(false);
  const [mic, setMic] = useState(true);
  const [sysAudio, setSysAudio] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [micId, setMicId] = useState("");

  useEffect(() => {
    (async () => {
      try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); } catch {}
      const devs = await navigator.mediaDevices.enumerateDevices();
      const ins = devs.filter((d) => d.kind === "audioinput").map((d) => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 8)}` }));
      setDevices(ins);
      if (ins.length) setMicId(ins[0].deviceId);
    })();
  }, []);

  // Session
  const [sid, setSid] = useState<string | null>(null);
  const [segs, setSegs] = useState<Segment[]>([]);
  const [qa, setQa] = useState<QaEntry[]>([]);
  const [q, setQ] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState("idle");
  const [err, setErr] = useState<string | null>(null);
  const [askBusy, setAskBusy] = useState(false);
  const sidRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pending = useRef(0);

  const onChunk = useCallback(async (blob: Blob) => {
    const id = sidRef.current; if (!id) return;
    pending.current++;
    try {
      await uploadAudioChunk(id, blob);
      const d = await getTranscript(id);
      setSegs(d.segments);
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (e: unknown) { if (!String(e).includes("not recording")) setErr(e instanceof Error ? e.message : "Upload failed"); }
    finally { pending.current--; }
  }, []);

  const { start: startRec, stop: stopRec } = useRecorder(onChunk);

  useEffect(() => {
    if (status !== "recording" || !sysAudio || !sidRef.current) return;
    const iv = setInterval(async () => {
      try { const id = sidRef.current; if (!id) return; const d = await getTranscript(id); setSegs(d.segments); scrollRef.current?.scrollIntoView({ behavior: "smooth" }); } catch {}
    }, 5000);
    return () => clearInterval(iv);
  }, [status, sysAudio]);

  const doStart = async () => {
    setErr(null); setSummary(null); setSegs([]); setQa([]);
    try {
      const s = await createSession({ name: name || "Untitled Meeting", record_screen: screen, record_mic: mic });
      setSid(s.session_id); sidRef.current = s.session_id; setStatus("recording");
      if (mic || screen) await startRec({ recordScreen: screen, recordMic: mic, micDeviceId: micId });
      if (sysAudio) { try { await startSystemCapture(s.session_id); } catch (e: unknown) { setErr("System audio failed: " + (e instanceof Error ? e.message : String(e))); } }
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed to start"); }
  };

  const doStop = async () => {
    stopRec(); setStatus("processing");
    if (sysAudio && sidRef.current) { try { await stopSystemCapture(sidRef.current); } catch {} }
    while (pending.current > 0) await new Promise((r) => setTimeout(r, 200));
    try { if (sidRef.current) { const r = await finishSession(sidRef.current); setSummary(r.summary); setStatus("finished"); } }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed to finish"); setStatus("finished"); }
  };

  const doAsk = async () => {
    if (!q.trim() || !sidRef.current) return;
    setAskBusy(true);
    try { const r = await askQuestion(sidRef.current, q); setQa((p) => [...p, { question: q, answer: r.answer }]); setQ(""); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setAskBusy(false); }
  };

  // ── SETUP SCREEN ──
  if (!configured) {
    return (
      <div className="px-10 py-10 max-w-lg mx-auto">
        <button type="button" onClick={() => router.push("/")} className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer mb-8">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1">New Recording</h1>
        <p className="text-sm text-secondary mb-8">Configure audio sources and start.</p>

        <div className="space-y-6">
          {/* Name */}
          <fieldset>
            <legend className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Meeting Name</legend>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint Planning Q1"
              className="w-full px-4 py-3 text-sm bg-surface border border-edge rounded-xl text-foreground placeholder:text-hint outline-none focus:border-primary transition-colors"
            />
          </fieldset>

          {/* Sources */}
          <fieldset>
            <legend className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">Audio Sources</legend>
            <div className="space-y-2">
              {[
                { checked: mic, set: setMic, icon: Mic, label: "Microphone", sub: "" },
                { checked: screen, set: setScreen, icon: Monitor, label: "Screen audio", sub: "Browser tab only" },
                { checked: sysAudio, set: setSysAudio, icon: Volume2, label: "System audio", sub: "Teams, Zoom, etc." },
              ].map(({ checked, set, icon: Icon, label, sub }) => (
                <label key={label} className={`flex items-center gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${checked ? "bg-primary/5 border-primary/30" : "bg-surface border-edge hover:border-edge-strong"}`}>
                  <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className="sr-only" />
                  <span className={`grid place-items-center w-9 h-9 rounded-lg shrink-0 ${checked ? "bg-primary/15 text-primary" : "bg-raised text-hint"}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-foreground">{label}</span>
                    {sub && <span className="block text-xs text-hint mt-0.5">{sub}</span>}
                  </span>
                  <span className={`w-5 h-5 rounded-full border-2 grid place-items-center transition-colors ${checked ? "border-primary bg-primary" : "border-edge"}`}>
                    {checked && <CheckCircle2 className="w-4 h-4 text-primary-fg" />}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Mic select */}
          {mic && devices.length > 1 && (
            <fieldset>
              <legend className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Microphone Device</legend>
              <select value={micId} onChange={(e) => setMicId(e.target.value)} className="w-full px-4 py-3 text-sm bg-surface border border-edge rounded-xl text-foreground outline-none focus:border-primary transition-colors">
                {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
              </select>
            </fieldset>
          )}

          <button
            type="button"
            onClick={() => { setConfigured(true); doStart(); }}
            disabled={!screen && !mic && !sysAudio}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-fg text-sm font-semibold hover:bg-primary-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-0 cursor-pointer shadow-sm"
          >
            Start Recording
          </button>
        </div>
      </div>
    );
  }

  // ── RECORDING / FINISHED ──
  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-edge bg-surface shrink-0">
        <div className="flex items-center gap-3">
          {status === "recording" && <span className="rec-dot w-2 h-2 rounded-full bg-danger" />}
          <h1 className="text-sm font-semibold text-foreground">{name || "Untitled Meeting"}</h1>
          <span className="text-xs text-hint px-2.5 py-0.5 rounded-full bg-raised">
            {status === "recording" ? "Recording" : status === "processing" ? "Processing" : "Finished"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status === "recording" && (
            <button type="button" onClick={doStop} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-danger text-primary-fg text-sm font-medium hover:opacity-90 transition border-0 cursor-pointer">
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          )}
          {status === "processing" && <span className="inline-flex items-center gap-1.5 text-sm text-hint"><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating summary...</span>}
          {status === "finished" && (
            <button type="button" onClick={() => router.push("/")} className="px-3.5 py-1.5 rounded-lg bg-raised text-foreground text-sm font-medium hover:bg-overlay transition border-0 cursor-pointer">Back to Meetings</button>
          )}
        </div>
      </header>

      {err && <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">{err}</div>}

      {/* Main split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Transcript */}
        <section className="flex-1 overflow-y-auto px-6 py-5">
          <h2 className="text-xs font-semibold text-hint uppercase tracking-wider mb-4">Transcript</h2>
          {segs.length === 0 && <p className="text-sm text-hint text-center py-20">Transcript will appear here once recording starts...</p>}
          <div className="space-y-0.5">
            {segs.map((seg, i) => (
              <div key={i} className="flex gap-3 py-2 px-3 rounded-lg hover:bg-surface transition-colors text-sm">
                <span className="text-[11px] text-hint font-mono tabular-nums w-10 pt-0.5 shrink-0">{fmtTime(seg.start)}</span>
                <span className="font-semibold shrink-0 w-24 truncate" style={{ color: spkColor(seg.speaker) }}>{seg.speaker}</span>
                <span className="text-foreground leading-relaxed">{seg.text}</span>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </section>

        {/* Right panel */}
        <aside className="w-96 border-l border-edge flex flex-col bg-surface">
          {/* Q&A input */}
          <div className="p-4 border-b border-edge">
            <h2 className="text-xs font-semibold text-hint uppercase tracking-wider mb-3">Ask a Question</h2>
            <div className="flex gap-2 items-center bg-raised border border-edge rounded-xl px-3 focus-within:border-primary transition-colors">
              <input type="text" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doAsk()} placeholder="Ask about the meeting..." disabled={!sid || askBusy} className="flex-1 py-2.5 text-sm text-foreground bg-transparent outline-none placeholder:text-hint disabled:opacity-50" />
              <button type="button" onClick={doAsk} disabled={!sid || !q.trim() || askBusy} className="grid place-items-center w-8 h-8 rounded-lg bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-30 disabled:cursor-not-allowed transition border-0 cursor-pointer shrink-0">
                {askBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Q&A + summary scroll */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {qa.map((entry, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-raised border border-edge">
                <p className="text-xs font-semibold text-primary mb-1.5">Q: {entry.question}</p>
                <p className="text-sm text-foreground leading-relaxed">{entry.answer}</p>
              </div>
            ))}

            {summary && (
              <div className="pt-4 mt-2 border-t border-edge space-y-4">
                <h2 className="text-xs font-semibold text-hint uppercase tracking-wider">Meeting Summary</h2>
                <div className="p-4 rounded-xl bg-raised border border-edge space-y-2">
                  {summary.summary.split("\n").filter(Boolean).map((p, i) => <p key={i} className="text-sm text-foreground leading-relaxed">{p}</p>)}
                </div>
                {summary.action_items.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-hint uppercase tracking-wider mb-2">Action Items</h3>
                    <ul className="space-y-1.5">
                      {summary.action_items.map((it, i) => <li key={i} className="flex items-start gap-2 text-sm text-foreground"><span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />{it}</li>)}
                    </ul>
                  </div>
                )}
                {summary.decisions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-hint uppercase tracking-wider mb-2">Decisions</h3>
                    <ul className="space-y-1.5">
                      {summary.decisions.map((it, i) => <li key={i} className="flex items-start gap-2 text-sm text-foreground"><span className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0" />{it}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
