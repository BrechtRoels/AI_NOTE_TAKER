"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, LayoutList, Settings, MessageSquare } from "lucide-react";

const NAV = [
  { href: "/", label: "Meetings", icon: LayoutList },
  { href: "/record", label: "New Recording", icon: Mic },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ onOpenChat }: { onOpenChat: () => void }) {
  const path = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-surface border-r border-edge flex flex-col z-40">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 px-5 py-5">
        <span className="grid place-items-center w-8 h-8 rounded-lg bg-primary text-primary-fg">
          <Mic className="w-4 h-4" />
        </span>
        <span className="text-sm font-semibold text-foreground tracking-tight">
          AI Note Taker
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-secondary hover:bg-raised hover:text-foreground"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Ask AI */}
      <div className="p-3 border-t border-edge">
        <button
          type="button"
          onClick={onOpenChat}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium bg-raised text-secondary hover:text-foreground hover:bg-overlay cursor-pointer transition-colors border border-edge"
        >
          <MessageSquare className="w-[18px] h-[18px]" />
          Ask across meetings
        </button>
      </div>
    </aside>
  );
}
