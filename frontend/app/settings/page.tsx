"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Loader2, BarChart3, DollarSign } from "lucide-react";
import { getUsage, type UsageStats } from "@/lib/api";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  useEffect(() => {
    setMounted(true);
    getUsage().then(setUsage).catch(() => {}).finally(() => setLoadingUsage(false));
  }, []);

  const themes = [
    { key: "dark", label: "Dark", icon: Moon, desc: "Easy on the eyes" },
    { key: "light", label: "Light", icon: Sun, desc: "Classic bright theme" },
  ];

  return (
    <div className="px-10 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1">Settings</h1>
      <p className="text-sm text-secondary mb-10">Manage your preferences and view usage</p>

      {/* ── Appearance ── */}
      <section className="mb-12">
        <h2 className="text-xs font-semibold text-hint uppercase tracking-wider mb-4">Appearance</h2>
        <div className="grid grid-cols-2 gap-3">
          {mounted && themes.map((t) => {
            const Icon = t.icon;
            const active = theme === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTheme(t.key)}
                className={`flex items-center gap-3.5 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  active
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-edge bg-surface hover:border-edge-strong"
                }`}
              >
                <span className={`grid place-items-center w-10 h-10 rounded-lg ${active ? "bg-primary text-primary-fg" : "bg-raised text-hint"}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="text-left">
                  <span className="block text-sm font-semibold text-foreground">{t.label}</span>
                  <span className="block text-xs text-hint">{t.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Usage ── */}
      <section>
        <h2 className="text-xs font-semibold text-hint uppercase tracking-wider mb-4">API Usage &amp; Cost</h2>

        {loadingUsage && <div className="grid place-items-center py-12"><Loader2 className="w-5 h-5 animate-spin text-hint" /></div>}

        {!loadingUsage && usage && (
          <div className="space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-5 rounded-xl bg-surface border border-edge">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-hint" />
                  <span className="text-xs text-hint">Total API Calls</span>
                </div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{usage.total_api_calls.toLocaleString()}</p>
              </div>
              <div className="p-5 rounded-xl bg-surface border border-edge">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-hint" />
                  <span className="text-xs text-hint">Estimated Cost</span>
                </div>
                <p className="text-2xl font-bold text-foreground tabular-nums">${usage.total_cost_usd.toFixed(4)}</p>
              </div>
            </div>

            {/* Table */}
            {Object.keys(usage.models).length > 0 && (
              <div className="rounded-xl bg-surface border border-edge overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-edge bg-raised/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-hint uppercase tracking-wider">Model</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-hint uppercase tracking-wider">Calls</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-hint uppercase tracking-wider">Tokens</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-hint uppercase tracking-wider">Audio</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-hint uppercase tracking-wider">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(usage.models).map(([model, m]) => (
                      <tr key={model} className="border-b last:border-b-0 border-edge">
                        <td className="px-4 py-3 font-mono text-xs text-foreground">{model}</td>
                        <td className="px-4 py-3 text-right text-secondary tabular-nums">{m.calls}</td>
                        <td className="px-4 py-3 text-right text-secondary tabular-nums">{m.total_tokens.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-secondary tabular-nums">{m.audio_seconds > 0 ? `${Math.round(m.audio_seconds)}s` : "-"}</td>
                        <td className="px-4 py-3 text-right font-medium text-foreground tabular-nums">${m.cost_usd.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {Object.keys(usage.models).length === 0 && (
              <p className="text-sm text-hint text-center py-10">No API usage recorded yet.</p>
            )}
          </div>
        )}

        {!loadingUsage && !usage && (
          <p className="text-sm text-hint text-center py-10">Could not load usage data. Is the backend running?</p>
        )}
      </section>
    </div>
  );
}
