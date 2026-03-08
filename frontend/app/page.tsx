"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, Trash2, Calendar, Hash, Loader2, Plus, Tag, X } from "lucide-react";
import { listMeetings, deleteMeeting, type MeetingListItem } from "@/lib/api";

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    listMeetings()
      .then((d) => setMeetings(d.meetings))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this meeting?")) return;
    await deleteMeeting(id);
    setMeetings((p) => p.filter((m) => m.session_id !== id));
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    meetings.forEach((m) => (m.tags || []).forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [meetings]);

  const filtered = activeTag
    ? meetings.filter((m) => (m.tags || []).includes(activeTag))
    : meetings;

  return (
    <div className="px-10 py-10 max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Meetings</h1>
          <p className="text-sm text-secondary mt-1">Your recorded meetings and transcriptions</p>
        </div>
        <Link
          href="/record"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-fg text-sm font-medium hover:bg-primary-hover transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Recording
        </Link>
      </header>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Tag className="w-3.5 h-3.5 text-hint shrink-0" />
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border-0 cursor-pointer ${
                activeTag === tag
                  ? "bg-primary text-primary-fg"
                  : "bg-raised text-secondary hover:text-foreground"
              }`}
            >
              {tag}
              {activeTag === tag && <X className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-5 h-5 animate-spin text-hint" />
        </div>
      )}

      {/* Empty */}
      {!loading && meetings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl border-2 border-dashed border-edge">
          <div className="grid place-items-center w-14 h-14 rounded-2xl bg-raised mb-5">
            <Mic className="w-7 h-7 text-hint" />
          </div>
          <p className="text-foreground font-semibold mb-1">No meetings yet</p>
          <p className="text-sm text-secondary mb-5">Start a recording to create your first meeting.</p>
          <Link
            href="/record"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-fg text-sm font-medium hover:bg-primary-hover transition-colors shadow-sm"
          >
            <Mic className="w-4 h-4" />
            Start Recording
          </Link>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {filtered.map((m) => (
          <article
            key={m.session_id}
            onClick={() => router.push(`/meetings/${m.session_id}`)}
            className="group flex items-center gap-4 p-4 rounded-xl bg-surface border border-edge hover:border-edge-strong cursor-pointer transition-all"
          >
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-raised shrink-0">
              <Mic className="w-4 h-4 text-hint" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{m.name}</h3>
              <div className="flex items-center gap-4 mt-1 text-xs text-secondary">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {fmtDate(m.created_at)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {m.total_segments} segments
                </span>
              </div>
              {(m.tags || []).length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  {m.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full bg-raised text-[11px] text-secondary font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => handleDelete(m.session_id, e)}
              className="grid place-items-center w-8 h-8 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-danger/10 text-hint hover:text-danger transition-all bg-transparent border-0 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
