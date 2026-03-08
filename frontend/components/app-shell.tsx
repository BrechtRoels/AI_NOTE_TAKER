"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { ChatPanel } from "./chat-panel";

export function AppShell({ children }: { children: ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <Sidebar onOpenChat={() => setChatOpen(true)} />
      <main className="ml-60 min-h-screen bg-page">{children}</main>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
