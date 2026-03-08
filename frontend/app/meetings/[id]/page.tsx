"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, FileText, ListChecks, MessageSquare } from "lucide-react";
import { getMeeting, type MeetingDetail } from "@/lib/api";

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

type Tab = "transcript" | "summary" | "qa";
const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: "transcript", label: "Transcript", icon: FileText },
  { key: "summary", label: "Summary", icon: ListChecks },
  { key: "qa", label: "Q&A", icon: MessageSquare },
];

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("transcript");

  useEffect(() => {
    if (id) getMeeting(id).then(setMeeting).catch((e) => setError(e.message));
  }, [id]);

  if (error) return (
    <div className="p-10"><div className="px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">{error}</div></div>
  );
  if (!meeting) return (
    <div className="grid place-items-center h-screen"><Loader2 className="w-5 h-5 animate-spin text-hint" /></div>
  );

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const qaCount = meeting.qa_history?.length || 0;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-edge bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.push("/")} className="grid place-items-center w-8 h-8 rounded-lg hover:bg-raised text-hint hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate">{meeting.name}</h1>
            <p className="text-xs text-hint mt-0.5">{fmtDate(meeting.created_at)}</p>
          </div>
          <span className="text-xs text-hint px-2.5 py-1 rounded-full bg-raised">{meeting.total_segments} segments</span>
        </div>
      </header>

      {/* Tabs */}
      <nav className="px-6 border-b border-edge bg-surface shrink-0 flex">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors bg-transparent cursor-pointer ${
                active ? "border-primary text-primary" : "border-transparent text-secondary hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.key === "qa" && qaCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-raised text-xs text-hint">{qaCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "transcript" && (
          <div className="max-w-3xl space-y-0.5">
            {meeting.segments.map((seg, i) => (
              <div key={i} className="flex gap-3 py-2 px-3 rounded-lg hover:bg-surface transition-colors text-sm">
                <span className="text-[11px] text-hint font-mono tabular-nums w-10 pt-0.5 shrink-0">{fmtTime(seg.start)}</span>
                <span className="font-semibold shrink-0 w-24 truncate" style={{ color: spkColor(seg.speaker) }}>{seg.speaker}</span>
                <span className="text-foreground leading-relaxed">{seg.text}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "summary" && meeting.summary && (
          <div className="max-w-2xl space-y-8">
            <div className="p-5 rounded-xl bg-surface border border-edge space-y-2">
              {meeting.summary.summary.split("\n").filter(Boolean).map((p, i) => (
                <p key={i} className="text-sm text-foreground leading-relaxed">{p}</p>
              ))}
            </div>
            {meeting.summary.action_items.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-hint uppercase tracking-wider mb-3">Action Items</h3>
                <div className="space-y-2">
                  {meeting.summary.action_items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-surface border border-edge">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span className="text-sm text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {meeting.summary.decisions.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-hint uppercase tracking-wider mb-3">Decisions</h3>
                <div className="space-y-2">
                  {meeting.summary.decisions.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-surface border border-edge">
                      <span className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                      <span className="text-sm text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
        {tab === "summary" && !meeting.summary && <p className="text-sm text-hint text-center py-20">No summary available.</p>}

        {tab === "qa" && (
          <div className="max-w-2xl space-y-3">
            {qaCount === 0 && <p className="text-sm text-hint text-center py-20">No questions were asked during this meeting.</p>}
            {meeting.qa_history?.map((entry, i) => (
              <div key={i} className="p-4 rounded-xl bg-surface border border-edge">
                <p className="text-xs font-semibold text-primary mb-2">Q: {entry.question}</p>
                <p className="text-sm text-foreground leading-relaxed">{entry.answer}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
