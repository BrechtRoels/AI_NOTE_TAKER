"use client";

import { useState } from "react";
import { X, Send, Loader2, Sparkles } from "lucide-react";
import { askGlobal } from "@/lib/api";

type ChatEntry = { question: string; answer: string; sources: string[] };

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  const handleAsk = async () => {
    if (!question.trim() || asking) return;
    const q = question;
    setAsking(true);
    setQuestion("");
    try {
      const res = await askGlobal(q);
      setHistory((p) => [...p, { question: q, answer: res.answer, sources: res.sources }]);
    } catch {
      setHistory((p) => [...p, { question: q, answer: "Failed to get answer.", sources: [] }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />}

      {/* Panel */}
      <section
        className={`fixed top-0 right-0 h-full w-[400px] bg-surface border-l border-edge z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-edge">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Ask AI</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid place-items-center w-7 h-7 rounded-md hover:bg-raised text-hint hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {history.length === 0 && !asking && (
            <div className="text-center py-16">
              <Sparkles className="w-8 h-8 text-hint mx-auto mb-3" />
              <p className="text-sm text-hint">Ask a question about any of your meetings.</p>
            </div>
          )}

          {history.map((e, i) => (
            <div key={i} className="space-y-2.5">
              <div className="flex justify-end">
                <p className="bg-primary text-primary-fg text-sm px-3.5 py-2 rounded-2xl rounded-br-md max-w-[85%] leading-relaxed">
                  {e.question}
                </p>
              </div>
              <div className="flex justify-start">
                <div className="bg-raised text-foreground text-sm px-3.5 py-2.5 rounded-2xl rounded-bl-md max-w-[85%] leading-relaxed">
                  <p className="whitespace-pre-wrap">{e.answer}</p>
                  {e.sources.length > 0 && (
                    <p className="text-xs text-hint mt-2 pt-2 border-t border-edge">
                      Sources: {e.sources.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {asking && (
            <div className="flex justify-start">
              <div className="bg-raised text-hint text-sm px-3.5 py-2 rounded-2xl rounded-bl-md inline-flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <footer className="px-4 py-3 border-t border-edge">
          <div className="flex gap-2 items-center bg-raised border border-edge rounded-xl px-3 focus-within:border-primary transition-colors">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="Ask about your meetings..."
              disabled={asking}
              className="flex-1 py-2.5 text-sm text-foreground bg-transparent outline-none placeholder:text-hint disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleAsk}
              disabled={!question.trim() || asking}
              className="grid place-items-center w-8 h-8 rounded-lg bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-0 cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </footer>
      </section>
    </>
  );
}
