/* ══════════════════════════════════════════════════════════════════
   AI Note Taker — Plain JS SPA
   ══════════════════════════════════════════════════════════════════ */

// ── API helpers ──────────────────────────────────────────────────

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── SVG Icons (inline) ──────────────────────────────────────────

// ── Toast Notifications ─────────────────────────────────────────

function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toasts");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = type === "error" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>'
    : type === "success" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
  toast.innerHTML = `${icon}<span>${esc(message)}</span>`;
  container.appendChild(toast);
  if (duration > 0) {
    setTimeout(() => {
      toast.classList.add("removing");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
  return toast;
}

function removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.classList.add("removing");
  setTimeout(() => toast.remove(), 300);
}

const ICONS = {
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>',
  hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
  monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/></svg>',
  square: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="5" y="5" rx="2"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>',
  fileText: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
  listChecks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>',
  messageSquare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  podcast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 11.7C17 15 14.8 17.8 12 17.8s-5-2.8-5-6.1"/><circle cx="12" cy="7" r="4"/><path d="M12 17.8V22"/><path d="M7 22h10"/><path d="M2 10a10 10 0 0 0 20 0"/></svg>',
  barChart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
  dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  loader: '<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
  lightbulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  refreshCw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>',
};

// ── Speaker Colors ───────────────────────────────────────────────

const COLORS = ["#d04a02","#e0301e","#2d8c3c","#ffb600","#a32020","#e87722","#d93954","#b5560f"];
function spkColor(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return COLORS[h % COLORS.length];
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateLong(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Theme ────────────────────────────────────────────────────────

function getTheme() { return localStorage.getItem("theme") || "dark"; }

function setTheme(t) {
  localStorage.setItem("theme", t);
  document.documentElement.setAttribute("data-theme", t);
}

// Init theme
(function() {
  const t = getTheme();
  if (t === "light") document.documentElement.setAttribute("data-theme", "light");
})();

// ── Keyboard Shortcuts ───────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && chatOpen) toggleChat();
});

// ── Router ───────────────────────────────────────────────────────

let currentRoute = "";

function navigate(path) {
  // Route guard: warn if recording is active
  if (recState.status === "recording" && !path.startsWith("/record")) {
    if (!confirm("Recording is in progress. Leave this page?")) return;
  }
  window.location.hash = path;
}

function getRoute() {
  const h = window.location.hash.slice(1) || "/";
  return h;
}

function updateNav(route) {
  document.querySelectorAll(".nav-link").forEach(el => el.classList.remove("active"));
  if (route === "/") document.getElementById("nav-meetings")?.classList.add("active");
  else if (route === "/record") document.getElementById("nav-record")?.classList.add("active");
  else if (route === "/settings") document.getElementById("nav-settings")?.classList.add("active");
}

// Warn before closing browser tab during recording
window.addEventListener("beforeunload", (e) => {
  if (recState.status === "recording") {
    e.preventDefault();
    e.returnValue = "";
  }
});

window.addEventListener("hashchange", () => route());
window.addEventListener("load", () => route());

function route() {
  const r = getRoute();
  if (r === currentRoute) return;
  currentRoute = r;
  updateNav(r);

  const app = document.getElementById("app");

  if (r === "/") return renderMeetings(app);
  if (r === "/record") return renderRecordSetup(app);
  if (r === "/settings") return renderSettings(app);
  if (r.startsWith("/meetings/")) {
    const id = r.replace("/meetings/", "");
    return renderMeetingDetail(app, id);
  }

  app.innerHTML = `<div class="page-container text-center" style="padding-top:120px">
    <h1 style="font-size:48px;font-weight:700;margin-bottom:8px">404</h1>
    <p style="color:var(--c-fg2);margin-bottom:24px">Page not found</p>
    <a href="#/" style="color:var(--c-primary)">Back to Meetings</a>
  </div>`;
}

// ── Chat Panel ───────────────────────────────────────────────────

let chatOpen = false;
let chatHistory = [];
let chatAsking = false;
let currentConversationId = null;

function toggleChat() {
  chatOpen = !chatOpen;
  document.getElementById("chatBackdrop").classList.toggle("open", chatOpen);
  document.getElementById("chatPanel").classList.toggle("open", chatOpen);
  if (chatOpen) switchChatTab("chat");
}

function switchChatTab(tab) {
  document.querySelectorAll(".chat-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  document.getElementById("chatTabChat").classList.toggle("active", tab === "chat");
  document.getElementById("chatTabHistory").classList.toggle("active", tab === "history");
  if (tab === "history") loadConversationsList();
}

async function loadConversationsList() {
  const list = document.getElementById("chatHistoryList");
  list.innerHTML = `<div class="chat-thinking">Loading...</div>`;
  try {
    const resp = await fetch("/api/conversations");
    const convos = await resp.json();
    if (convos.length === 0) {
      list.innerHTML = `<div class="chat-empty"><p>No saved conversations yet.</p></div>`;
      return;
    }
    list.innerHTML = convos.map(c => `
      <div class="conv-item" onclick="loadConversation('${c.id}')">
        <div class="conv-item-title">${esc(c.title)}</div>
        <div class="conv-item-meta">${c.message_count} messages &middot; ${new Date(c.created_at).toLocaleDateString()}</div>
        <button class="conv-item-delete" onclick="event.stopPropagation(); deleteConversation('${c.id}')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    `).join("");
  } catch {
    list.innerHTML = `<div class="chat-empty"><p>Failed to load conversations.</p></div>`;
  }
}

async function loadConversation(convId) {
  try {
    const resp = await fetch(`/api/conversations/${convId}`);
    const data = await resp.json();
    currentConversationId = convId;
    chatHistory = [];
    const msgs = document.getElementById("chatMessages");
    msgs.innerHTML = "";
    for (const m of data.messages) {
      const div = document.createElement("div");
      div.className = m.role === "user" ? "chat-bubble-q" : "chat-bubble-a";
      if (m.role === "assistant") {
        div.innerHTML = renderChatMarkdown(m.content);
      } else {
        div.textContent = m.content;
      }
      msgs.appendChild(div);
      if (m.role === "user") {
        chatHistory.push({ question: m.content, answer: "" });
      } else if (chatHistory.length > 0) {
        chatHistory[chatHistory.length - 1].answer = m.content;
      }
    }
    switchChatTab("chat");
    msgs.scrollTop = msgs.scrollHeight;
  } catch {
    alert("Failed to load conversation.");
  }
}

async function deleteConversation(convId) {
  if (!confirm("Delete this conversation?")) return;
  await fetch(`/api/conversations/${convId}`, { method: "DELETE" });
  if (currentConversationId === convId) startNewConversation();
  loadConversationsList();
}

async function saveCurrentConversation() {
  if (chatHistory.length === 0) return;
  const messages = chatHistory.flatMap(h => [
    { role: "user", content: h.question },
    { role: "assistant", content: h.answer },
  ]);
  const title = chatHistory[0].question.slice(0, 60) + (chatHistory[0].question.length > 60 ? "..." : "");
  const resp = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: currentConversationId, title, messages }),
  });
  const data = await resp.json();
  currentConversationId = data.id;
}

function startNewConversation() {
  chatHistory = [];
  currentConversationId = null;
  const msgs = document.getElementById("chatMessages");
  msgs.innerHTML = `<div class="chat-empty">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287Z"/></svg>
    <p>Ask a question about any of your meetings.</p>
  </div>`;
}

async function sendChatMessage() {
  const input = document.getElementById("chatInput");
  const q = input.value.trim();
  if (!q || chatAsking) return;

  chatAsking = true;
  input.value = "";
  input.disabled = true;

  const msgs = document.getElementById("chatMessages");
  // Clear empty state
  const empty = msgs.querySelector(".chat-empty");
  if (empty) empty.remove();

  // Add question bubble
  const qDiv = document.createElement("div");
  qDiv.className = "chat-bubble-q";
  qDiv.textContent = q;
  msgs.appendChild(qDiv);

  // Add thinking indicator
  const thinking = document.createElement("div");
  thinking.className = "chat-thinking";
  thinking.innerHTML = `${ICONS.loader} Thinking...`;
  msgs.appendChild(thinking);
  msgs.scrollTop = msgs.scrollHeight;

  try {
    // Check if chat model supports streaming (only vertex_ai)
    const modelsResp = await fetch("/api/models");
    const modelsData = await modelsResp.json();
    const chatModel = modelsData.active?.chat || "";
    const useStreaming = chatModel.startsWith("vertex_ai");

    const aDiv = document.createElement("div");
    aDiv.className = "chat-bubble-a";
    const textSpan = document.createElement("span");
    aDiv.appendChild(textSpan);

    // Build conversation history for context
    const history = chatHistory.map(h => [
      { role: "user", content: h.question },
      { role: "assistant", content: h.answer },
    ]).flat();

    let fullAnswer = "";
    let sources = [];

    if (useStreaming) {
      const resp = await fetch("/api/ask-global/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      if (!resp.ok) throw new Error(resp.statusText);

      thinking.remove();
      msgs.appendChild(aDiv);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const chunk = JSON.parse(payload);
            if (chunk.type === "sources") {
              sources = chunk.sources || [];
            } else if (chunk.type === "token") {
              fullAnswer += chunk.token;
              textSpan.textContent = fullAnswer;
              msgs.scrollTop = msgs.scrollHeight;
            }
          } catch {}
        }
      }

      // Render markdown after stream completes
      textSpan.innerHTML = renderChatMarkdown(fullAnswer);

      if (sources.length > 0) {
        const src = document.createElement("div");
        src.className = "chat-sources";
        src.innerHTML = "Sources: " + sources.map(s =>
          `<a href="javascript:void(0)" class="chat-source-link" onclick="toggleChat(); navigate('/meetings/${s.id}')">${esc(s.name)}</a>`
        ).join(", ");
        aDiv.appendChild(src);
      }
    } else {
      const resp = await fetch("/api/ask-global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      if (!resp.ok) throw new Error(resp.statusText);

      thinking.remove();
      const data = await resp.json();
      fullAnswer = data.answer;
      sources = data.sources || [];
      textSpan.innerHTML = renderChatMarkdown(fullAnswer);
      msgs.appendChild(aDiv);

      if (sources.length > 0) {
        const src = document.createElement("div");
        src.className = "chat-sources";
        src.innerHTML = "Sources: " + sources.map(s =>
          `<a href="javascript:void(0)" class="chat-source-link" onclick="toggleChat(); navigate('/meetings/${s.id}')">${esc(s.name)}</a>`
        ).join(", ");
        aDiv.appendChild(src);
      }
    }

    chatHistory.push({ question: q, answer: fullAnswer, sources });
    saveCurrentConversation();
  } catch (e) {
    thinking.remove();
    const aDiv = document.createElement("div");
    aDiv.className = "chat-bubble-a";
    aDiv.textContent = "Failed to get answer.";
    msgs.appendChild(aDiv);
  }

  chatAsking = false;
  input.disabled = false;
  input.focus();
  msgs.scrollTop = msgs.scrollHeight;
}

// ══════════════════════════════════════════════════════════════════
//  PAGE: Meetings List
// ══════════════════════════════════════════════════════════════════

// ── Podcast Generator ─────────────────────────────────────────────
let _podcastMeetings = [];

async function openPodcastModal() {
  // Fetch meetings list
  try {
    const data = await api("/api/meetings");
    _podcastMeetings = data.meetings || [];
  } catch (e) {
    console.error("Failed to fetch meetings for podcast:", e);
    showToast("Failed to load meetings: " + e.message, "error");
    _podcastMeetings = [];
    return;
  }

  if (_podcastMeetings.length === 0) {
    showToast("No meetings available — record or upload a meeting first", "error");
    return;
  }

  // Create modal
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.id = "podcastModal";
  modal.innerHTML = `
    <div class="modal-content podcast-modal">
      <div class="modal-header">
        <h2>${ICONS.podcast} Generate Podcast</h2>
        <button class="btn-icon" onclick="closePodcastModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <label class="modal-label">Select Meetings</label>
        <div class="podcast-meeting-list">
          ${_podcastMeetings.map(m => `
            <label class="podcast-meeting-item">
              <input type="checkbox" value="${m.session_id}" />
              <span>${esc(m.name)}</span>
              <small>${fmtDate(m.created_at)}</small>
            </label>
          `).join("")}
        </div>

        <div class="podcast-options">
          <div class="podcast-option">
            <label class="modal-label">Duration (minutes)</label>
            <input type="range" id="podcastDuration" min="1" max="15" value="5" oninput="document.getElementById('podcastDurVal').textContent=this.value" />
            <span id="podcastDurVal" class="podcast-range-val">5</span>
          </div>
          <div class="podcast-option">
            <label class="modal-label">Speakers</label>
            <input type="range" id="podcastSpeakers" min="1" max="4" value="2" oninput="document.getElementById('podcastSpkVal').textContent=this.value" />
            <span id="podcastSpkVal" class="podcast-range-val">2</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closePodcastModal()">Cancel</button>
        <button class="btn-primary" id="podcastGenBtn" onclick="startPodcastGeneration()">Generate Podcast</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function closePodcastModal() {
  const modal = document.getElementById("podcastModal");
  if (modal) modal.remove();
}

async function startPodcastGeneration() {
  const checks = document.querySelectorAll("#podcastModal .podcast-meeting-item input:checked");
  const meetingIds = Array.from(checks).map(c => c.value);
  if (meetingIds.length === 0) {
    showToast("Select at least one meeting", "error");
    return;
  }

  const duration = parseInt(document.getElementById("podcastDuration").value);
  const speakers = parseInt(document.getElementById("podcastSpeakers").value);

  const btn = document.getElementById("podcastGenBtn");
  btn.disabled = true;
  btn.innerHTML = `${ICONS.loader} Generating...`;

  try {
    const resp = await fetch("/api/podcast/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting_ids: meetingIds, duration_minutes: duration, num_speakers: speakers }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || resp.statusText);
    }
    const data = await resp.json();
    closePodcastModal();
    showPodcastPlayer(data);
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = "Generate Podcast";
    showToast(`Podcast failed: ${e.message}`, "error");
  }
}

function showPodcastPlayer(data) {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.id = "podcastPlayerModal";

  const scriptHtml = (data.script || []).map(t =>
    `<div class="podcast-turn"><strong class="podcast-speaker">${esc(t.speaker)}:</strong> ${esc(t.text)}</div>`
  ).join("");

  modal.innerHTML = `
    <div class="modal-content podcast-modal">
      <div class="modal-header">
        <h2>${ICONS.podcast} Your Podcast</h2>
        <button class="btn-icon" onclick="document.getElementById('podcastPlayerModal').remove()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="podcast-player-info">
          <span>Meetings: ${(data.meetings || []).map(n => esc(n)).join(", ")}</span>
        </div>
        <audio controls src="/api/podcast/${data.podcast_id}" style="width:100%;margin:12px 0"></audio>
        <a href="/api/podcast/${data.podcast_id}" download class="btn-secondary" style="display:inline-flex;align-items:center;gap:6px;margin-bottom:12px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          Download MP3
        </a>
        <details class="podcast-script-details">
          <summary>View Script</summary>
          <div class="podcast-script">${scriptHtml}</div>
        </details>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ── Transcript Upload ────────────────────────────────────────────
async function handleTranscriptUpload(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = "";

  const toast = showToast("Uploading and processing transcript...", "info", 0);
  try {
    const form = new FormData();
    form.append("file", file);
    const resp = await fetch("/api/meetings/upload", { method: "POST", body: form });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || resp.statusText);
    }
    const data = await resp.json();
    removeToast(toast);
    showToast(`Transcript uploaded: ${data.total_segments} segments`, "success");
    navigate(`/meetings/${data.meeting_id}`);
  } catch (e) {
    removeToast(toast);
    showToast(`Upload failed: ${e.message}`, "error");
  }
}

async function renderMeetings(app) {
  app.innerHTML = `<div class="page-container">
    <header class="page-header">
      <div>
        <h1>Meetings</h1>
        <p>Your recorded meetings and transcriptions</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" onclick="document.getElementById('uploadTranscript').click()">${ICONS.plus} Upload Transcript</button>
        <input type="file" id="uploadTranscript" accept=".pdf,.docx,.doc" style="display:none" onchange="handleTranscriptUpload(this)" />
        <a href="#/record" class="btn-primary">${ICONS.plus} New Recording</a>
      </div>
    </header>
    <div class="loading-center">${ICONS.loader}</div>
  </div>`;

  try {
    const data = await api("/api/meetings");
    const container = app.querySelector(".page-container");
    const loader = container.querySelector(".loading-center");
    loader.remove();

    if (data.meetings.length === 0) {
      container.insertAdjacentHTML("beforeend", `
        <div class="empty-state">
          <div class="empty-state-icon">${ICONS.mic}</div>
          <h3>No meetings yet</h3>
          <p>Start a recording to create your first meeting.</p>
          <a href="#/record" class="btn-primary">${ICONS.mic} Start Recording</a>
        </div>`);
      return;
    }

    // Collect all unique tags
    const allTags = new Set();
    data.meetings.forEach(m => (m.tags || []).forEach(t => allTags.add(t)));
    let activeTagFilter = null;

    // Tag filter bar
    if (allTags.size > 0) {
      container.insertAdjacentHTML("beforeend", `<div class="tag-filter-bar" id="tagFilterBar"></div>`);
    }

    function renderTagFilter() {
      const bar = document.getElementById("tagFilterBar");
      if (!bar) return;
      bar.innerHTML = `${ICONS.tag} ${Array.from(allTags).sort().map(tag =>
        `<button class="tag-filter-btn${activeTagFilter === tag ? " active" : ""}" data-tag="${esc(tag)}">${esc(tag)}${activeTagFilter === tag ? " " + ICONS.x : ""}</button>`
      ).join("")}`;
      bar.querySelectorAll(".tag-filter-btn").forEach(btn => {
        btn.onclick = () => {
          const t = btn.dataset.tag;
          activeTagFilter = activeTagFilter === t ? null : t;
          renderTagFilter();
          filterMeetingCards();
        };
      });
    }

    function filterMeetingCards() {
      const searchVal = document.getElementById("meetingSearch")?.value.toLowerCase() || "";
      document.querySelectorAll(".meeting-card").forEach(card => {
        const name = card.querySelector("h3")?.textContent.toLowerCase() || "";
        const cardTags = JSON.parse(card.dataset.tags || "[]");
        const matchSearch = !searchVal || name.includes(searchVal);
        const matchTag = !activeTagFilter || cardTags.includes(activeTagFilter);
        card.style.display = (matchSearch && matchTag) ? "" : "none";
      });
    }

    // Search bar
    if (data.meetings.length > 1) {
      container.insertAdjacentHTML("beforeend", `
        <div class="search-bar">
          ${ICONS.search}
          <input type="text" id="meetingSearch" placeholder="Search meetings..." />
        </div>`);
      document.getElementById("meetingSearch").oninput = () => filterMeetingCards();
    }

    if (allTags.size > 0) renderTagFilter();

    const list = document.createElement("div");
    list.className = "meeting-list";
    data.meetings.forEach(m => {
      const card = document.createElement("article");
      card.className = "meeting-card";
      card.dataset.tags = JSON.stringify(m.tags || []);
      card.onclick = () => navigate(`/meetings/${m.session_id}`);
      const tagPills = (m.tags || []).length > 0
        ? `<div class="meeting-card-tags">${m.tags.map(t => `<span class="tag-pill-sm">${esc(t)}</span>`).join("")}</div>`
        : "";
      card.innerHTML = `
        <div class="meeting-card-icon">${ICONS.mic}</div>
        <div class="meeting-card-body">
          <h3>${esc(m.name)}</h3>
          <div class="meeting-card-meta">
            <span>${ICONS.calendar} ${fmtDate(m.created_at)}</span>
            <span>${ICONS.hash} ${m.total_segments} segments</span>
          </div>
          ${tagPills}
        </div>
        <button class="btn-delete" title="Delete">${ICONS.trash}</button>`;

      // Double-click to rename
      const nameEl = card.querySelector("h3");
      nameEl.ondblclick = (e) => {
        e.stopPropagation();
        const input = document.createElement("input");
        input.type = "text";
        input.value = m.name;
        input.className = "edit-name-input";
        input.style.fontSize = "14px";
        nameEl.replaceWith(input);
        input.focus();
        input.select();

        async function saveInline() {
          const newName = input.value.trim();
          if (newName && newName !== m.name) {
            try {
              await api(`/api/meetings/${m.session_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName }),
              });
              m.name = newName;
              showToast("Meeting renamed", "success", 2000);
            } catch (err) { showToast("Rename failed: " + err.message, "error"); }
          }
          const h3 = document.createElement("h3");
          h3.textContent = m.name;
          h3.ondblclick = nameEl.ondblclick;
          input.replaceWith(h3);
        }

        input.onkeydown = (ev) => {
          if (ev.key === "Enter") saveInline();
          if (ev.key === "Escape") { const h3 = document.createElement("h3"); h3.textContent = m.name; h3.ondblclick = nameEl.ondblclick; input.replaceWith(h3); }
        };
        input.onblur = () => setTimeout(saveInline, 150);
      };

      card.querySelector(".btn-delete").onclick = async (e) => {
        e.stopPropagation();
        if (!confirm("Delete this meeting?")) return;
        try {
          await api(`/api/meetings/${m.session_id}`, { method: "DELETE" });
          card.classList.add("removing");
          setTimeout(() => card.remove(), 300);
          showToast("Meeting deleted", "success", 2000);
        } catch (err) {
          showToast("Failed to delete: " + err.message, "error");
        }
      };
      list.appendChild(card);
    });
    container.appendChild(list);
  } catch (e) {
    app.querySelector(".loading-center").innerHTML = `<p style="color:var(--c-danger)">${esc(e.message)}</p>`;
  }
}

// ══════════════════════════════════════════════════════════════════
//  PAGE: Record Setup
// ══════════════════════════════════════════════════════════════════

let recState = {
  configured: false,
  name: "",
  mic: true,
  screen: false,
  sysAudio: true,
  micId: "",
  devices: [],
  // active recording
  sessionId: null,
  status: "idle",
  segments: [],
  notes: [],
  qa: [],
  summary: null,
  error: null,
  askBusy: false,
  // recorder
  mediaRecorder: null,
  archivalRecorder: null,
  archivalChunks: [],
  streams: [],
  audioCtx: null,
  chunkInterval: null,
  pendingUploads: 0,
  pollInterval: null,
  timerInterval: null,
  startTime: null,
  // realtime mode
  mode: "batch",           // "realtime" or "batch"
  realtimeWs: null,        // WebSocket to backend
  realtimeWorklet: null,   // AudioWorkletNode
  realtimeFailed: false,   // set true if realtime disconnects mid-recording
  pendingText: "",          // partial transcript from delta events
};

function resetRecState() {
  if (recState.chunkInterval) clearInterval(recState.chunkInterval);
  if (recState.pollInterval) clearInterval(recState.pollInterval);
  if (recState.timerInterval) clearInterval(recState.timerInterval);
  if (recState.suggestionsInterval) clearInterval(recState.suggestionsInterval);
  if (recState.suggestionsTimeout) clearTimeout(recState.suggestionsTimeout);
  if (recState.mediaRecorder && recState.mediaRecorder.state !== "inactive") recState.mediaRecorder.stop();
  recState.streams.forEach(s => s.getTracks().forEach(t => t.stop()));
  if (recState.audioCtx) { try { recState.audioCtx.close(); } catch {} }

  if (recState.realtimeWs) { try { recState.realtimeWs.close(); } catch {} }

  recState = {
    configured: false, name: "", mic: true, screen: false, sysAudio: true, micId: "",
    devices: [], tags: [], tagInput: "", existingTags: [], sessionId: null, status: "idle", segments: [], notes: [], qa: [], summary: null,
    suggestions: [], suggestionsLoading: false, suggestionsInterval: null, suggestionsTimeout: null,
    error: null, askBusy: false, mediaRecorder: null, archivalRecorder: null, archivalChunks: [],
    archivalSaving: false, archivalSaveInterval: null,
    streams: [], audioCtx: null,
    chunkInterval: null, pendingUploads: 0, pollInterval: null, timerInterval: null, startTime: null,
    mode: "batch", realtimeWs: null, realtimeWorklet: null, realtimeFailed: false, pendingText: "",
  };
}

function fmtElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${m}:${String(s).padStart(2,"0")}`;
}

async function renderRecordSetup(app) {
  resetRecState();

  // Fetch existing tags from past meetings
  try {
    const resp = await api("/api/meetings");
    const meetings = resp.meetings || resp;
    const tagSet = new Set();
    meetings.forEach(m => (m.tags || []).forEach(t => tagSet.add(t)));
    recState.existingTags = [...tagSet].sort();
  } catch { recState.existingTags = []; }

  // Enumerate mic devices
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach(t => t.stop());
  } catch {}
  const devs = await navigator.mediaDevices.enumerateDevices();
  recState.devices = devs.filter(d => d.kind === "audioinput").map(d => ({
    deviceId: d.deviceId,
    label: d.label || `Mic ${d.deviceId.slice(0, 8)}`,
  }));
  if (recState.devices.length) recState.micId = recState.devices[0].deviceId;

  renderSetupForm(app);
}

function renderSetupForm(app) {
  const micOptions = recState.devices.map(d =>
    `<option value="${d.deviceId}"${d.deviceId === recState.micId ? " selected" : ""}>${esc(d.label)}</option>`
  ).join("");

  app.innerHTML = `<div class="setup-page">
    <button class="back-link" onclick="navigate('/')">${ICONS.arrowLeft} Back</button>
    <h1 style="font-size:24px;font-weight:700;color:var(--c-fg);margin-bottom:4px">New Recording</h1>
    <p style="font-size:14px;color:var(--c-fg2);margin-bottom:32px">Configure audio sources and start.</p>

    <div class="form-group">
      <label class="form-label">Meeting Name</label>
      <input class="form-input" id="recName" type="text" placeholder="e.g. Sprint Planning Q1" value="${esc(recState.name)}" />
    </div>

    <div class="form-group">
      <label class="form-label">Tags</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">
        ${recState.tags.map((t, i) => `<span class="tag-pill">${esc(t)} <button class="tag-remove" onclick="recState.tags.splice(${i},1);renderSetupForm(document.getElementById('app'))">&times;</button></span>`).join("")}
        <div style="display:flex;gap:6px;align-items:center">
          <input class="form-input" id="recTagInput" type="text" placeholder="Add new tag..." style="width:180px;padding:8px 12px" value="${esc(recState.tagInput)}" />
          <button class="btn-secondary" style="padding:8px;min-width:auto" onclick="addRecTag()">${ICONS.tag}</button>
        </div>
      </div>
      ${(recState.existingTags || []).filter(t => !recState.tags.includes(t)).length > 0 ? `
      <div style="margin-top:4px">
        <span style="font-size:12px;color:var(--c-fg2);margin-right:8px">Past tags:</span>
        <div style="display:inline-flex;flex-wrap:wrap;gap:6px">
          ${(recState.existingTags || []).filter(t => !recState.tags.includes(t)).map(t =>
            `<button class="tag-pill-sm tag-suggestion-btn" onclick="recState.tags.push('${esc(t).replace(/'/g, "\\'")}');renderSetupForm(document.getElementById('app'))">${esc(t)} ${ICONS.plus}</button>`
          ).join("")}
        </div>
      </div>` : ""}
    </div>

    <div class="form-group">
      <label class="form-label">Audio Sources</label>
      <div class="source-list">
        <label class="source-toggle${recState.mic ? " active" : ""}" id="togMic">
          <span class="source-toggle-icon">${ICONS.mic}</span>
          <span class="source-toggle-body"><span class="label">Microphone</span></span>
          <span class="check">${ICONS.check}</span>
        </label>
        <label class="source-toggle${recState.screen ? " active" : ""}" id="togScreen">
          <span class="source-toggle-icon">${ICONS.monitor}</span>
          <span class="source-toggle-body"><span class="label">Screen audio</span><span class="sub">Browser tab only</span></span>
          <span class="check">${ICONS.check}</span>
        </label>
        <label class="source-toggle${recState.sysAudio ? " active" : ""}" id="togSys">
          <span class="source-toggle-icon">${ICONS.volume}</span>
          <span class="source-toggle-body"><span class="label">System audio</span><span class="sub">Teams, Zoom, etc.</span></span>
          <span class="check">${ICONS.check}</span>
        </label>
      </div>
    </div>

    ${recState.mic && recState.devices.length > 1 ? `
    <div class="form-group">
      <label class="form-label">Microphone Device</label>
      <select class="form-select" id="recMicSelect">${micOptions}</select>
    </div>` : ""}

    <button class="btn-primary w-full" id="btnStartRec" style="justify-content:center;padding:14px" ${!recState.mic && !recState.screen && !recState.sysAudio ? "disabled" : ""}>
      Start Recording
    </button>
  </div>`;

  // Bind toggles
  document.getElementById("togMic").onclick = () => { recState.mic = !recState.mic; renderSetupForm(app); };
  document.getElementById("togScreen").onclick = () => { recState.screen = !recState.screen; renderSetupForm(app); };
  document.getElementById("togSys").onclick = () => { recState.sysAudio = !recState.sysAudio; renderSetupForm(app); };

  document.getElementById("recName").oninput = (e) => recState.name = e.target.value;
  const tagInput = document.getElementById("recTagInput");
  if (tagInput) {
    tagInput.oninput = (e) => recState.tagInput = e.target.value;
    tagInput.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addRecTag(); } };
  }
  if (document.getElementById("recMicSelect")) {
    document.getElementById("recMicSelect").onchange = (e) => recState.micId = e.target.value;
  }

  document.getElementById("btnStartRec").onclick = () => startRecording(app);
}

function addRecTag() {
  const raw = (recState.tagInput || "").trim();
  if (!raw) return;
  // Support comma-separated tags
  const newTags = raw.split(",").map(t => t.trim()).filter(t => t && !recState.tags.includes(t));
  recState.tags.push(...newTags);
  recState.tagInput = "";
  renderSetupForm(document.getElementById("app"));
}

// ── Start Recording ──────────────────────────────────────────────

async function startRecording(app) {
  recState.error = null;
  recState.segments = [];
  recState.qa = [];
  recState.summary = null;

  try {
    const session = await api("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: recState.name || "Untitled Meeting",
        record_screen: recState.screen,
        record_mic: recState.mic,
        tags: recState.tags,
      }),
    });

    recState.sessionId = session.session_id;
    recState.status = "recording";
    recState.configured = true;
    recState.startTime = Date.now();

    // Start browser audio capture
    if (recState.mic || recState.screen) {
      await startBrowserRecorder();
    }

    // Start system audio
    if (recState.sysAudio) {
      try {
        await api(`/api/sessions/${recState.sessionId}/start-system-capture`, { method: "POST" });
      } catch (e) {
        showToast("System audio failed: " + e.message, "error", 6000);
      }
    }

    // No live transcript polling — transcripts are processed in 5-min chunks

    // Live suggestions: first fetch after 60s, then every 2 min
    if (recState.tags.length > 0) {
      recState.suggestionsTimeout = setTimeout(() => {
        fetchSuggestions();
        recState.suggestionsInterval = setInterval(fetchSuggestions, 120000);
      }, 60000);
    }

    renderActiveRecording(app);
    updateRealtimeStatusUI();
    updateTranscriptUI();
  } catch (e) {
    showToast(e.message, "error");
    renderSetupForm(app);
  }
}

async function startBrowserRecorder() {
  // Use 24kHz for realtime API compatibility (also fine for batch)
  const audioCtx = new AudioContext({ sampleRate: 24000 });
  recState.audioCtx = audioCtx;
  const destination = audioCtx.createMediaStreamDestination();
  let hasAudio = false;

  if (recState.screen) {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    recState.streams.push(displayStream);
    const audioTracks = displayStream.getAudioTracks();
    if (audioTracks.length > 0) {
      audioCtx.createMediaStreamSource(new MediaStream(audioTracks)).connect(destination);
      hasAudio = true;
    }
  }

  if (recState.mic) {
    const constraints = { echoCancellation: true, noiseSuppression: true };
    if (recState.micId) constraints.deviceId = { exact: recState.micId };
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
    recState.streams.push(micStream);
    audioCtx.createMediaStreamSource(micStream).connect(destination);
    hasAudio = true;
  }

  if (!hasAudio) throw new Error("No audio source available.");

  // ── Archival recorder (always runs — safety net for fallback) ──
  const archival = new MediaRecorder(destination.stream, {
    mimeType: "audio/webm;codecs=opus",
    audioBitsPerSecond: 16000,
  });
  recState.archivalChunks = [];
  recState.archivalSaving = false;
  archival.ondataavailable = (e) => {
    if (e.data.size > 0) recState.archivalChunks.push(e.data);
  };
  archival.start(30000); // buffer every 30s
  recState.archivalRecorder = archival;

  // Save audio to server every 5 minutes
  recState.archivalSaveInterval = setInterval(async () => {
    if (recState.archivalSaving || !recState.sessionId || recState.archivalChunks.length === 0) return;
    recState.archivalSaving = true;
    try {
      const blob = new Blob(recState.archivalChunks, { type: "audio/webm" });
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      await fetch(`/api/sessions/${recState.sessionId}/upload-audio`, { method: "POST", body: form });
    } catch (e) {
      console.warn("Periodic audio save failed:", e);
    }
    recState.archivalSaving = false;
  }, 300000);

  // ── Try realtime mode first ────────────────────────────────────
  try {
    const ws = await connectRealtimeWs();
    recState.realtimeWs = ws;
    recState.mode = "realtime";

    // Set up AudioWorklet for PCM streaming
    await audioCtx.audioWorklet.addModule("/static/pcm-processor.js");
    const workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");
    recState.realtimeWorklet = workletNode;

    // Connect all audio sources to the worklet
    // (re-create sources since they're already connected to destination)
    for (const stream of recState.streams) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioCtx.createMediaStreamSource(new MediaStream(audioTracks)).connect(workletNode);
      }
    }

    // Send PCM data from worklet to backend via WebSocket
    workletNode.port.onmessage = (e) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(e.data); // binary ArrayBuffer
      }
    };

    // Handle transcript events from backend
    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        handleRealtimeEvent(event);
      } catch {}
    };

    ws.onclose = () => {
      if (recState.status === "recording" && !recState.realtimeFailed) {
        recState.realtimeFailed = true;
        showToast("Realtime transcription disconnected. Audio will be re-transcribed when you stop.", "error", 8000);
        updateRealtimeStatusUI();
      }
    };

    showToast("Live transcription active", "success", 3000);
    updateRealtimeStatusUI();

  } catch (e) {
    // ── Fall back to batch mode ────────────────────────────────
    console.warn("Realtime unavailable, using batch mode:", e);
    recState.mode = "batch";
    showToast("Using batch transcription (5-min chunks)", "info", 3000);

    setupBatchRecorder(destination);
  }

  // Stop if screen share ends
  if (recState.screen && recState.streams[0]) {
    const videoTrack = recState.streams[0].getVideoTracks()[0];
    if (videoTrack) videoTrack.onended = () => stopRecording();
  }
}

function connectRealtimeWs() {
  return new Promise((resolve, reject) => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws/${recState.sessionId}/realtime`);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Realtime connection timeout"));
    }, 10000);

    ws.binaryType = "arraybuffer";

    const origOnMessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === "realtime_connected") {
          clearTimeout(timeout);
          ws.onmessage = null; // clear setup handler
          resolve(ws);
        } else if (event.type === "error") {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(event.message || "Realtime error"));
        }
      } catch {}
    };
    ws.onmessage = origOnMessage;

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket connection failed"));
    };

    ws.onclose = () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket closed before ready"));
    };
  });
}

function handleRealtimeEvent(event) {
  if (event.type === "final") {
    // Add completed segment
    const now = recState.startTime ? (Date.now() - recState.startTime) / 1000 : 0;
    recState.segments.push({
      start: Math.max(0, now - 5),
      end: now,
      speaker: "Speaker",
      text: event.text,
    });
    recState.pendingText = "";
    updateTranscriptUI();
  } else if (event.type === "delta") {
    // Partial transcript — show live
    recState.pendingText += event.text;
    updatePendingTextUI();
  } else if (event.type === "speech_started") {
    updatePendingTextUI("...");
  } else if (event.type === "error") {
    console.error("Realtime error:", event.message);
  }
}

function updatePendingTextUI(override) {
  const el = document.getElementById("pendingText");
  if (!el) return;
  const text = override || recState.pendingText;
  el.textContent = text || "";
  el.style.display = text ? "" : "none";
  if (text) {
    const anchor = document.getElementById("scrollAnchor");
    if (anchor) anchor.scrollIntoView({ behavior: "smooth" });
  }
}

function updateRealtimeStatusUI() {
  const el = document.getElementById("realtimeStatus");
  if (!el) return;
  if (recState.mode === "realtime" && !recState.realtimeFailed) {
    el.innerHTML = `<span style="color:var(--c-success);font-size:12px">● Live transcription</span>`;
  } else if (recState.realtimeFailed) {
    el.innerHTML = `<span style="color:var(--c-danger);font-size:12px">● Realtime disconnected — will re-transcribe on stop</span>`;
  } else {
    el.innerHTML = `<span style="color:var(--c-fg3);font-size:12px">● Batch mode (5-min chunks)</span>`;
  }
}

function setupBatchRecorder(destination) {
  const recorder = new MediaRecorder(destination.stream, { mimeType: "audio/webm;codecs=opus" });
  let chunks = [];

  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: "audio/webm" });
    chunks = [];
    if (blob.size > 0) {
      recState.pendingUploads++;
      uploadChunk(blob, true);
    }
  };

  recorder.start();
  recState.mediaRecorder = recorder;

  recState.chunkInterval = setInterval(() => {
    if (recorder.state === "recording") {
      recorder.stop();
      recorder.start();
    }
  }, 300000); // 5 minutes
}

async function uploadChunk(blob, alreadyCounted = false) {
  if (!recState.sessionId) return;
  if (!alreadyCounted) recState.pendingUploads++;
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const form = new FormData();
      form.append("audio", blob, "chunk.webm");
      await api(`/api/sessions/${recState.sessionId}/audio`, { method: "POST", body: form });
      const data = await api(`/api/sessions/${recState.sessionId}/transcript`);
      recState.segments = data.segments;
      updateTranscriptUI();
      break;
    } catch (e) {
      if (!String(e).includes("not recording")) {
        if (attempt < maxRetries) {
          console.warn(`Chunk upload attempt ${attempt + 1} failed, retrying...`);
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        } else {
          showToast("Audio chunk failed to upload — transcript may have a gap", "error");
        }
      } else {
        break;
      }
    }
  }
  recState.pendingUploads--;
}

async function stopRecording() {
  // Stop realtime WebSocket and worklet
  if (recState.realtimeWs) {
    try { recState.realtimeWs.close(); } catch {}
    recState.realtimeWs = null;
  }
  if (recState.realtimeWorklet) {
    try { recState.realtimeWorklet.disconnect(); } catch {}
    recState.realtimeWorklet = null;
  }

  // Stop all recorders and intervals immediately
  if (recState.chunkInterval) { clearInterval(recState.chunkInterval); recState.chunkInterval = null; }
  if (recState.archivalSaveInterval) { clearInterval(recState.archivalSaveInterval); recState.archivalSaveInterval = null; }
  if (recState.mediaRecorder && recState.mediaRecorder.state !== "inactive") recState.mediaRecorder.stop();
  if (recState.archivalRecorder && recState.archivalRecorder.state !== "inactive") {
    recState.archivalRecorder.stop();
  }
  await new Promise(r => setTimeout(r, 300)); // wait for final ondataavailable

  // Stop all audio streams
  recState.streams.forEach(s => s.getTracks().forEach(t => t.stop()));
  recState.streams = [];
  if (recState.audioCtx) { try { recState.audioCtx.close(); } catch {} recState.audioCtx = null; }

  // Stop system audio
  if (recState.sysAudio && recState.sessionId) {
    try { await api(`/api/sessions/${recState.sessionId}/stop-system-capture`, { method: "POST" }); } catch {}
  }

  recState.status = "processing";
  if (recState.timerInterval) { clearInterval(recState.timerInterval); recState.timerInterval = null; }
  if (recState.suggestionsInterval) { clearInterval(recState.suggestionsInterval); recState.suggestionsInterval = null; }
  if (recState.suggestionsTimeout) { clearTimeout(recState.suggestionsTimeout); recState.suggestionsTimeout = null; }
  updateRecHeaderUI();
  showToast("Saving audio and processing transcript...", "info", 8000);

  // Save complete audio FIRST
  if (recState.archivalChunks.length > 0 && recState.sessionId) {
    const fullBlob = new Blob(recState.archivalChunks, { type: "audio/webm" });
    const form = new FormData();
    form.append("audio", fullBlob, "recording.webm");
    try {
      await fetch(`/api/sessions/${recState.sessionId}/upload-audio`, { method: "POST", body: form });
      showToast("Audio saved successfully", "success");
    } catch (e) {
      console.error("Failed to upload audio:", e);
      showToast("Failed to save audio", "error");
    }
  }
  recState.archivalChunks = [];

  // Wait for any pending STT chunk uploads (batch mode only)
  while (recState.pendingUploads > 0) await new Promise(r => setTimeout(r, 200));

  // Finish session (generates summary)
  try {
    const notes = recState.notes.map(n => `[${fmtTime(n.time)}] ${n.text}`).join("\n");
    const result = await api(`/api/sessions/${recState.sessionId}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    recState.summary = result.summary;
    recState.status = "finished";
  } catch (e) {
    showToast(e.message, "error");
    recState.status = "finished";
  }

  updateRecHeaderUI();
  updateSummaryUI();

  // ── Fallback: if realtime failed, re-transcribe from saved audio ──
  if (recState.realtimeFailed && recState.sessionId) {
    showToast("Re-transcribing from saved audio (realtime had failures)...", "info", 15000);
    try {
      const res = await fetch(`/api/meetings/${recState.sessionId}/retranscribe`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        showToast(`Re-transcription complete: ${data.total_segments} segments`, "success");
        navigate(`/meetings/${recState.sessionId}`);
      } else {
        showToast("Re-transcription failed — you can retry from the meeting page", "error");
      }
    } catch (e) {
      showToast("Re-transcription failed: " + e.message, "error");
    }
  }
}

// ── Meeting Notes ────────────────────────────────────────────────

function addNote() {
  const input = document.getElementById("noteInput");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const elapsed = recState.startTime ? Math.floor((Date.now() - recState.startTime) / 1000) : 0;
  recState.notes.push({ time: elapsed, text });
  input.value = "";
  renderNotesList();
}

function removeNote(idx) {
  recState.notes.splice(idx, 1);
  renderNotesList();
}

function renderNotesList() {
  const list = document.getElementById("notesList");
  if (!list) return;
  if (recState.notes.length === 0) {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = recState.notes.map((n, i) => `
    <div class="rec-note-item">
      <span class="rec-note-time">[${fmtTime(n.time)}]</span>
      <span class="rec-note-text">${esc(n.text)}</span>
      <button class="rec-note-delete" onclick="removeNote(${i})" title="Remove">&times;</button>
    </div>`).join("");
}

// ── Live Suggestions ─────────────────────────────────────────────

async function fetchSuggestions() {
  if (!recState.sessionId || recState.status !== "recording") return;
  recState.suggestionsLoading = true;
  updateSuggestionsUI();
  try {
    const data = await api(`/api/sessions/${recState.sessionId}/suggestions`);
    recState.suggestions = data.suggestions || [];
  } catch {
    // silently ignore
  }
  recState.suggestionsLoading = false;
  updateSuggestionsUI();
}

function updateSuggestionsUI() {
  const panel = document.getElementById("suggestionsPanel");
  if (!panel) return;

  if (recState.suggestionsLoading && recState.suggestions.length === 0) {
    panel.innerHTML = `<div class="suggestions-loading">${ICONS.loader} Generating suggestions...</div>`;
    return;
  }

  if (recState.suggestions.length === 0) {
    panel.innerHTML = `<p class="suggestions-empty">Suggestions will appear here after ~1 min if related meetings exist.</p>`;
    return;
  }

  panel.innerHTML = recState.suggestions.map(s =>
    `<div class="suggestion-item">${ICONS.lightbulb}<span>${esc(s)}</span></div>`
  ).join("");
}

// ── Render Active Recording ──────────────────────────────────────

function renderActiveRecording(app) {
  app.innerHTML = `<div class="rec-layout">
    <header class="rec-header" id="recHeader">
      <div class="rec-header-left">
        <span class="rec-dot" id="recDot"></span>
        <h1>${esc(recState.name || "Untitled Meeting")}</h1>
        <span class="rec-timer" id="recTimer">0:00</span>
        <span class="status-badge" id="recStatusBadge">Recording</span>
      </div>
      <div id="recHeaderActions">
        <button class="btn-danger" id="btnStop" onclick="stopRecording()">${ICONS.square} Stop</button>
      </div>
    </header>

    ${recState.error ? `<div class="error-banner">${esc(recState.error)}</div>` : ""}

    <div class="rec-body">
      <section class="rec-transcript">
        <h2 class="section-title">Transcript <span id="realtimeStatus"></span></h2>
        <div id="transcriptArea">
          <p class="empty-transcript">Connecting to transcription service...</p>
        </div>
        <div id="pendingText" class="pending-text" style="display:none"></div>
        <div id="scrollAnchor"></div>
      </section>

      <aside class="rec-aside">
        ${recState.tags.length > 0 ? `
        <div class="suggestions-box">
          <h2 class="section-title">${ICONS.lightbulb} Live Suggestions</h2>
          <div id="suggestionsPanel">
            <p class="suggestions-empty">Suggestions will appear here after ~1 min if related meetings exist.</p>
          </div>
        </div>` : ""}
        <div class="rec-notes-box">
          <h2 class="section-title">Meeting Notes</h2>
          <div class="qa-input-wrap">
            <input type="text" id="noteInput" placeholder="Add a note..." onkeydown="if(event.key==='Enter')addNote()" />
            <button class="btn-send" onclick="addNote()">${ICONS.plus}</button>
          </div>
          <div class="rec-notes-list" id="notesList"></div>
        </div>
        <div class="qa-input-box">
          <h2 class="section-title">Ask a Question</h2>
          <div class="qa-input-wrap">
            <input type="text" id="qaInput" placeholder="Ask about the meeting..." onkeydown="if(event.key==='Enter')askRecQuestion()" />
            <button class="btn-send" onclick="askRecQuestion()">${ICONS.send}</button>
          </div>
        </div>
        <div class="qa-scroll" id="qaScroll"></div>
      </aside>
    </div>
  </div>`;

  // Start timer
  if (recState.startTime && !recState.timerInterval) {
    recState.timerInterval = setInterval(() => {
      const el = document.getElementById("recTimer");
      if (el && recState.startTime) el.textContent = fmtElapsed(Date.now() - recState.startTime);
    }, 1000);
  }
}

function updateTranscriptUI() {
  const area = document.getElementById("transcriptArea");
  if (!area) return;

  if (recState.segments.length === 0) {
    const msg = recState.mode === "realtime"
      ? "Listening... transcript will appear as people speak."
      : "Transcript is processed in 5-minute chunks. Text will appear after the first chunk.";
    area.innerHTML = `<p class="empty-transcript">${msg}</p>`;
    return;
  }

  area.innerHTML = recState.segments.map(seg => `
    <div class="segment-row">
      <span class="seg-time">${fmtTime(seg.start)}</span>
      <span class="seg-speaker" style="color:${spkColor(seg.speaker)}">${esc(seg.speaker)}</span>
      <span class="seg-text">${esc(seg.text)}</span>
    </div>`).join("");

  const anchor = document.getElementById("scrollAnchor");
  if (anchor) anchor.scrollIntoView({ behavior: "smooth" });
}

function updateRecHeaderUI() {
  const badge = document.getElementById("recStatusBadge");
  const dot = document.getElementById("recDot");
  const actions = document.getElementById("recHeaderActions");
  const timer = document.getElementById("recTimer");
  if (!badge) return;

  if (recState.status === "recording") {
    badge.textContent = "Recording";
    if (dot) dot.style.display = "";
  } else if (recState.status === "processing") {
    badge.textContent = "Processing";
    if (dot) dot.style.display = "none";
    if (timer) timer.style.color = "var(--c-fg3)";
    if (actions) actions.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;font-size:14px;color:var(--c-fg3)">${ICONS.loader} Generating summary...</span>`;
  } else {
    badge.textContent = "Finished";
    if (dot) dot.style.display = "none";
    if (timer) timer.style.color = "var(--c-fg3)";
    if (actions) actions.innerHTML = `<button class="btn-secondary" onclick="navigate('/')">Back to Meetings</button>`;
    showToast("Meeting saved successfully", "success", 3000);
  }
}

function updateSummaryUI() {
  const scroll = document.getElementById("qaScroll");
  if (!scroll || !recState.summary) return;

  let html = `<div class="summary-section">
    <h2 class="section-title">Meeting Summary</h2>
    <div class="summary-box">
      ${recState.summary.summary.split("\n").filter(Boolean).map(p => `<p>${esc(p)}</p>`).join("")}
    </div>`;

  if (recState.summary.action_items && recState.summary.action_items.length > 0) {
    html += `<div><h3 class="section-title">Action Items</h3><ul class="summary-list">
      ${recState.summary.action_items.map(it => `<li><span class="dot dot-primary"></span>${esc(it)}</li>`).join("")}
    </ul></div>`;
  }

  if (recState.summary.decisions && recState.summary.decisions.length > 0) {
    html += `<div><h3 class="section-title">Decisions</h3><ul class="summary-list">
      ${recState.summary.decisions.map(it => `<li><span class="dot dot-success"></span>${esc(it)}</li>`).join("")}
    </ul></div>`;
  }

  html += `</div>`;
  scroll.insertAdjacentHTML("beforeend", html);
}

async function askRecQuestion() {
  const input = document.getElementById("qaInput");
  const q = input.value.trim();
  if (!q || !recState.sessionId || recState.askBusy) return;

  recState.askBusy = true;
  input.value = "";
  input.disabled = true;

  try {
    const res = await api(`/api/sessions/${recState.sessionId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });

    recState.qa.push({ question: q, answer: res.answer });
    const scroll = document.getElementById("qaScroll");
    if (scroll) {
      const item = document.createElement("div");
      item.className = "qa-item";
      item.innerHTML = `<p class="q">Q: ${esc(q)}</p><p class="a">${esc(res.answer)}</p>`;
      scroll.appendChild(item);
    }
  } catch (e) {
    showToast(e.message, "error");
  }

  recState.askBusy = false;
  input.disabled = false;
  input.focus();
}

// ══════════════════════════════════════════════════════════════════
//  PAGE: Meeting Detail
// ══════════════════════════════════════════════════════════════════

function startEditName(meetingId, meeting, rerender) {
  const h1 = document.getElementById("detailName");
  const btn = document.getElementById("btnEditName");
  if (!h1 || !btn) return;

  const oldName = meeting.name;
  const input = document.createElement("input");
  input.type = "text";
  input.value = oldName;
  input.className = "edit-name-input";

  h1.replaceWith(input);
  input.focus();
  input.select();

  // Replace pencil with check
  btn.innerHTML = ICONS.check;
  btn.title = "Save";

  async function save() {
    const newName = input.value.trim();
    if (!newName || newName === oldName) {
      meeting.name = oldName;
      rerender();
      return;
    }
    try {
      await api(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      meeting.name = newName;
      showToast("Meeting renamed", "success", 2000);
    } catch (e) {
      showToast("Rename failed: " + e.message, "error");
    }
    rerender();
  }

  btn.onclick = save;
  input.onkeydown = (e) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") { meeting.name = oldName; rerender(); }
  };
  input.onblur = () => setTimeout(save, 150);
}

async function downloadMom(meetingId) {
  const btn = document.getElementById("btnMom");
  if (btn) { btn.disabled = true; btn.innerHTML = `${ICONS.loader} Generating...`; }
  try {
    const res = await fetch(`/api/meetings/${meetingId}/mom`);
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    a.download = match ? match[1] : "Minutes_of_Meeting.docx";
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Minutes of Meeting downloaded", "success");
  } catch (e) {
    showToast("Failed to generate MoM: " + e.message, "error");
  }
  if (btn) { btn.disabled = false; btn.innerHTML = `${ICONS.download} Minutes of Meeting`; }
}

async function downloadSummaryPdf(meetingId) {
  const btn = document.getElementById("btnPdf");
  if (btn) { btn.disabled = true; btn.innerHTML = `${ICONS.loader} Generating...`; }
  try {
    const res = await fetch(`/api/meetings/${meetingId}/summary-pdf`);
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    a.download = match ? match[1] : "Meeting_Summary.pdf";
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Summary PDF downloaded", "success");
  } catch (e) {
    showToast("Failed to generate PDF: " + e.message, "error");
  }
  if (btn) { btn.disabled = false; btn.innerHTML = `${ICONS.download} Summary PDF`; }
}

async function regenerateSummary(meetingId) {
  const btn = document.getElementById("btnRegenerate");
  if (btn) { btn.disabled = true; btn.innerHTML = `${ICONS.loader} Regenerating...`; }
  try {
    const res = await fetch(`/api/meetings/${meetingId}/regenerate`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    showToast("Summary regenerated", "success");
    navigate(`/meetings/${meetingId}`);
  } catch (e) {
    showToast("Failed to regenerate: " + e.message, "error");
  }
  if (btn) { btn.disabled = false; btn.innerHTML = `${ICONS.refreshCw} Regenerate Summary`; }
}

async function retranscribeMeeting(meetingId) {
  const btn = document.getElementById("btnRetranscribe");
  if (btn) { btn.disabled = true; btn.innerHTML = `${ICONS.loader} Re-transcribing...`; }
  showToast("Re-transcribing from saved audio — this may take a few minutes...", "info", 10000);
  try {
    const res = await fetch(`/api/meetings/${meetingId}/retranscribe`, { method: "POST" });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    const data = await res.json();
    showToast(`Re-transcription complete: ${data.total_segments} segments`, "success");
    navigate(`/meetings/${meetingId}`);
  } catch (e) {
    showToast("Re-transcription failed: " + e.message, "error");
    if (btn) { btn.disabled = false; btn.innerHTML = `${ICONS.refreshCw} Re-transcribe Audio`; }
  }
}

// ── Audio Player ─────────────────────────────────────────────────

let _audioSegments = []; // meeting segments for highlight sync

function seekAudio(seconds) {
  const audio = document.getElementById("meetingAudio");
  if (!audio || !audio.src || audio.error) return;
  if (audio.readyState < 1) {
    // Metadata not loaded yet — wait for it, then seek
    audio.addEventListener("loadedmetadata", () => {
      audio.currentTime = Math.min(seconds, audio.duration || seconds);
      audio.play().catch(() => {});
    }, { once: true });
    audio.load();
    return;
  }
  try {
    audio.currentTime = Math.min(seconds, audio.duration || seconds);
    if (audio.paused) audio.play().catch(() => {});
  } catch (e) { /* audio not ready */ }
}

function toggleAudioPlay() {
  const audio = document.getElementById("meetingAudio");
  if (!audio) return;
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

function _highlightActiveSegment(currentTime) {
  const rows = document.querySelectorAll(".segment-row");
  if (!rows.length || !_audioSegments.length) return;
  let activeIdx = -1;
  for (let i = 0; i < _audioSegments.length; i++) {
    if (currentTime >= _audioSegments[i].start && currentTime <= _audioSegments[i].end) {
      activeIdx = i;
      break;
    }
  }
  // If between segments, find the last segment before current time
  if (activeIdx === -1) {
    for (let i = _audioSegments.length - 1; i >= 0; i--) {
      if (currentTime >= _audioSegments[i].start) { activeIdx = i; break; }
    }
  }
  rows.forEach((row, i) => {
    if (i === activeIdx) {
      row.classList.add("seg-active");
      if (!row.dataset.scrolled) {
        row.scrollIntoView({ behavior: "smooth", block: "nearest" });
        row.dataset.scrolled = "1";
      }
    } else {
      row.classList.remove("seg-active");
      delete row.dataset.scrolled;
    }
  });
}

function _updateProgress(audio) {
  const fill = document.getElementById("audioProgressFill");
  const thumb = document.getElementById("audioProgressThumb");
  const current = document.getElementById("audioCurrentTime");
  if (!fill || !audio.duration || !isFinite(audio.duration)) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  fill.style.width = pct + "%";
  thumb.style.left = pct + "%";
  if (current) current.textContent = fmtTime(audio.currentTime);
  _highlightActiveSegment(audio.currentTime);
}

function _seekFromBar(e) {
  const audio = document.getElementById("meetingAudio");
  const track = document.getElementById("audioProgressTrack");
  if (!audio || !track || !audio.duration) return;
  const rect = track.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audio.currentTime = pct * audio.duration;
}

function initAudioPlayer(meetingId, segments) {
  const audio = document.getElementById("meetingAudio");
  const bar = document.getElementById("audioPlayerBar");
  if (!audio || !bar) return;
  _audioSegments = segments || [];
  audio.src = `/api/meetings/${meetingId}/audio`;
  audio.load();

  function _showDuration() {
    const d = audio.duration;
    if (d && isFinite(d)) {
      document.getElementById("audioDuration").textContent = fmtTime(d);
    }
  }
  audio.addEventListener("loadedmetadata", () => {
    bar.style.display = "";
    _showDuration();
  });
  audio.addEventListener("durationchange", _showDuration);
  audio.addEventListener("timeupdate", () => {
    _updateProgress(audio);
    _showDuration();
  });
  audio.addEventListener("play", () => {
    bar.classList.add("playing");
    document.getElementById("audioPlayBtn").innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  });
  audio.addEventListener("pause", () => {
    bar.classList.remove("playing");
    document.getElementById("audioPlayBtn").innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  });
  audio.addEventListener("error", () => { bar.style.display = "none"; });

  // Drag-to-seek on progress bar
  const track = document.getElementById("audioProgressTrack");
  if (track) {
    let dragging = false;
    track.addEventListener("mousedown", (e) => { dragging = true; _seekFromBar(e); });
    document.addEventListener("mousemove", (e) => { if (dragging) _seekFromBar(e); });
    document.addEventListener("mouseup", () => { dragging = false; });
    track.addEventListener("touchstart", (e) => { _seekFromBar(e.touches[0]); dragging = true; }, { passive: true });
    document.addEventListener("touchmove", (e) => { if (dragging) _seekFromBar(e.touches[0]); }, { passive: true });
    document.addEventListener("touchend", () => { dragging = false; });
  }
}

function renderTimestampLinks(text) {
  const audio = document.getElementById("meetingAudio");
  const hasAudio = audio && audio.src && !audio.error;
  return esc(text).replace(/\[(\d+:\d{2})\]/g, (_, time) => {
    const parts = time.split(":");
    const seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    if (!hasAudio) {
      return `<span class="ts-badge ts-badge-disabled" title="No audio available">${time}</span>`;
    }
    return `<a class="ts-badge" href="javascript:void(0)" onclick="seekAudio(${seconds})" title="Jump to ${time}">${time}</a>`;
  });
}

async function renderMeetingDetail(app, id) {
  app.innerHTML = `<div class="loading-center" style="height:100vh">${ICONS.loader}</div>`;

  try {
    const m = await api(`/api/meetings/${id}`);
    let activeTab = "transcript";
    const qaCount = m.qa_history ? m.qa_history.length : 0;
    const notesArr = m.notes ? (typeof m.notes === "string" ? m.notes.split("\n").filter(l => l.trim()) : m.notes) : [];
    const notesCount = notesArr.length;

    function renderDetail() {
      const detailTags = m.tags || [];
      app.innerHTML = `<div class="detail-layout">
        <header class="detail-header">
          <button class="btn-icon" onclick="navigate('/')">${ICONS.arrowLeft}</button>
          <div class="detail-header-body">
            <div class="detail-title-row">
              <h1 id="detailName">${esc(m.name)}</h1>
              <button class="btn-icon btn-edit-name" id="btnEditName" title="Rename">${ICONS.pencil}</button>
            </div>
            <div class="detail-meta-row">
              <p class="meta">${fmtDateLong(m.created_at)}</p>
              <div class="detail-tags" id="detailTags">
                ${detailTags.map(t => `<span class="tag-pill">${esc(t)} <button class="tag-remove" data-tag="${esc(t)}">&times;</button></span>`).join("")}
                <button class="tag-add-btn" id="btnAddTag">${ICONS.plus} ${ICONS.tag}</button>
              </div>
            </div>
          </div>
          <button class="btn-secondary" id="btnRetranscribe" onclick="retranscribeMeeting('${id}')">
            ${ICONS.refreshCw} Re-transcribe Audio
          </button>
          <button class="btn-secondary" id="btnRegenerate" onclick="regenerateSummary('${id}')">
            ${ICONS.refreshCw} Regenerate Summary
          </button>
          <button class="btn-secondary" id="btnMom" onclick="downloadMom('${id}')">
            ${ICONS.download} Minutes of Meeting
          </button>
          <button class="btn-primary" id="btnPdf" onclick="downloadSummaryPdf('${id}')">
            ${ICONS.download} Summary PDF
          </button>
          <span class="status-badge">${m.total_segments} segments</span>
        </header>

        <div class="audio-player-bar" id="audioPlayerBar" style="display:none">
          <audio id="meetingAudio" preload="auto"></audio>
          <button class="audio-play-btn" id="audioPlayBtn" onclick="toggleAudioPlay()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          </button>
          <span class="audio-time" id="audioCurrentTime">0:00</span>
          <div class="audio-progress-track" id="audioProgressTrack">
            <div class="audio-progress-fill" id="audioProgressFill"></div>
            <div class="audio-progress-thumb" id="audioProgressThumb"></div>
          </div>
          <span class="audio-time" id="audioDuration">0:00</span>
        </div>

        <nav class="tab-nav">
          <button class="tab-btn${activeTab === "transcript" ? " active" : ""}" data-tab="transcript">${ICONS.fileText} Transcript</button>
          <button class="tab-btn${activeTab === "summary" ? " active" : ""}" data-tab="summary">${ICONS.listChecks} Summary</button>
          <button class="tab-btn${activeTab === "notes" ? " active" : ""}" data-tab="notes">${ICONS.pencil} Notes${notesCount > 0 ? `<span class="tab-badge">${notesCount}</span>` : ""}</button>
          <button class="tab-btn${activeTab === "qa" ? " active" : ""}" data-tab="qa">${ICONS.messageSquare} Q&A${qaCount > 0 ? `<span class="tab-badge">${qaCount}</span>` : ""}</button>
        </nav>

        <div class="detail-content" id="detailContent"></div>
      </div>`;

      // Tab click handlers
      app.querySelectorAll(".tab-btn").forEach(btn => {
        btn.onclick = () => { activeTab = btn.dataset.tab; renderDetail(); };
      });

      // Rename handler
      document.getElementById("btnEditName").onclick = () => startEditName(id, m, renderDetail);

      // Tag handlers
      document.querySelectorAll("#detailTags .tag-remove").forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const tag = btn.dataset.tag;
          m.tags = (m.tags || []).filter(t => t !== tag);
          try { await api(`/api/meetings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: m.tags }) }); } catch {}
          renderDetail();
        };
      });
      document.getElementById("btnAddTag").onclick = (e) => {
        e.stopPropagation();
        const btn = e.currentTarget;
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Tag name";
        input.className = "tag-inline-input";
        btn.replaceWith(input);
        input.focus();
        async function saveTag() {
          const val = input.value.trim();
          if (val && !(m.tags || []).includes(val)) {
            m.tags = [...(m.tags || []), val];
            try { await api(`/api/meetings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: m.tags }) }); } catch {}
          }
          renderDetail();
        }
        input.onkeydown = (ev) => { if (ev.key === "Enter") saveTag(); if (ev.key === "Escape") renderDetail(); };
        input.onblur = () => setTimeout(saveTag, 100);
      };

      // Init audio player with segments for sync
      initAudioPlayer(id, m.segments);

      const content = document.getElementById("detailContent");

      if (activeTab === "transcript") {
        if (m.segments.length === 0) {
          content.innerHTML = `<p class="empty-transcript">No transcript available.</p>`;
        } else {
          content.innerHTML = `<div class="detail-transcript">${m.segments.map((seg, i) => `
            <div class="segment-row" data-seg-idx="${i}" data-start="${seg.start}" data-end="${seg.end}">
              <a class="seg-time" href="javascript:void(0)" onclick="seekAudio(${seg.start})">${fmtTime(seg.start)}</a>
              <span class="seg-speaker" style="color:${spkColor(seg.speaker)}">${esc(seg.speaker)}</span>
              <span class="seg-text">${esc(seg.text)}</span>
            </div>`).join("")}</div>`;
        }
      }

      else if (activeTab === "summary") {
        if (!m.summary) {
          content.innerHTML = `<p class="empty-transcript">No summary available.</p>`;
        } else {
          const stripMd = s => s.replace(/\*\*/g, '').replace(/^#+\s*/, '');
          const summaryLines = m.summary.summary.split("\n");
          let html = `<div class="detail-summary"><div class="summary-card">`;
          for (const line of summaryLines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const topicMatch = trimmed.match(/^(\d+)\.\s*\**(.+?)\**\s*$/);
            if (topicMatch) {
              html += `<div class="summary-topic"><span class="summary-topic-num">${topicMatch[1]}</span><span>${esc(stripMd(topicMatch[2]))}</span></div>`;
            } else if (/^\s*-\s/.test(line)) {
              const bullet = stripMd(trimmed.replace(/^-\s*/, ''));
              html += `<p class="summary-bullet">${renderTimestampLinks(bullet)}</p>`;
            } else {
              html += `<p>${renderTimestampLinks(stripMd(trimmed))}</p>`;
            }
          }
          html += `</div>`;

          const actionItems = (m.summary.action_items || []).filter(it => it.replace(/[-–—]/g,'').trim().length > 3);
          if (actionItems.length > 0) {
            html += `<div class="items-section"><h3>Action Items</h3>
              ${actionItems.map(it => `
                <div class="item-card">
                  <span class="dot dot-primary"></span>
                  <span>${esc(it)}</span>
                </div>`).join("")}
            </div>`;
          }

          const decisions = (m.summary.decisions || []).filter(it => it.replace(/[-–—]/g,'').trim().length > 3);
          if (decisions.length > 0) {
            html += `<div class="items-section"><h3>Decisions</h3>
              ${decisions.map(it => `
                <div class="item-card">
                  <span class="dot dot-success"></span>
                  <span>${esc(it)}</span>
                </div>`).join("")}
            </div>`;
          }

          html += `</div>`;
          content.innerHTML = html;
        }
      }

      else if (activeTab === "notes") {
        if (notesCount === 0) {
          content.innerHTML = `<p class="empty-transcript">No notes were taken during this meeting.</p>`;
        } else {
          content.innerHTML = `<div class="detail-notes">
            ${notesArr.map(n => {
              const match = typeof n === "string" ? n.match(/^\[(\d+:\d+)\]\s*(.*)/) : null;
              if (match) {
                return `<div class="detail-note-item">
                  <span class="detail-note-time">${esc(match[1])}</span>
                  <span class="detail-note-text">${esc(match[2])}</span>
                </div>`;
              }
              return `<div class="detail-note-item">
                <span class="detail-note-text">${esc(typeof n === "string" ? n : JSON.stringify(n))}</span>
              </div>`;
            }).join("")}
          </div>`;
        }
      }

      else if (activeTab === "qa") {
        if (qaCount === 0) {
          content.innerHTML = `<p class="empty-transcript">No questions were asked during this meeting.</p>`;
        } else {
          content.innerHTML = `<div class="detail-qa">
            ${m.qa_history.map(e => `
              <div class="qa-item">
                <p class="q">Q: ${esc(e.question)}</p>
                <p class="a">${esc(e.answer)}</p>
              </div>`).join("")}
          </div>`;
        }
      }
    }

    renderDetail();
  } catch (e) {
    app.innerHTML = `<div class="page-container"><div class="error-banner">${esc(e.message)}</div></div>`;
  }
}

// ══════════════════════════════════════════════════════════════════
//  PAGE: Settings — Model Selector
// ══════════════════════════════════════════════════════════════════

const MODEL_LABELS = { llm: "Summary Model", chat: "Chat Model (Cross-Meeting Search)", stt: "Speech-to-Text", embeddings: "Embeddings" };

function formatModelPrice(m) {
  if (m.price != null) return `$${m.price}/min`;
  const parts = [];
  if (m.input_price != null) parts.push(`$${m.input_price} in`);
  if (m.output_price) parts.push(`$${m.output_price} out`);
  return parts.join(" / ") + " per 1M tokens";
}

async function loadModelsSection() {
  try {
    const data = await api("/api/models");
    document.getElementById("modelsLoader")?.remove();
    const mc = document.getElementById("modelsContent");
    if (!mc) return;
    mc.classList.remove("hidden");

    let html = '<div class="model-selectors">';
    for (const cat of ["llm", "chat", "stt", "embeddings"]) {
      // chat shares the same available model list as llm
      const models = data.available[cat] || data.available["llm"] || [];
      const activeId = data.active[cat];
      const active = models.find(m => m.id === activeId) || models[0];
      html += `
        <div class="model-group">
          <label class="form-label">${MODEL_LABELS[cat]}</label>
          <div class="model-dropdown" id="mdrop-${cat}">
            <button class="model-dropdown-trigger" onclick="toggleModelDropdown('${cat}')">
              <div class="model-dropdown-selected">
                <span class="model-name">${esc(active.name)}</span>
                <span class="model-price">${formatModelPrice(active)}</span>
              </div>
              <svg class="model-dropdown-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div class="model-dropdown-menu">
              ${models.map(m => `
                <button class="model-option${m.id === activeId ? " active" : ""}" onclick="selectModel('${cat}','${m.id}')">
                  <div class="model-option-info">
                    <span class="model-option-name">${esc(m.name)}</span>
                    <span class="model-option-id">${esc(m.id)}</span>
                  </div>
                  <span class="model-option-price">${formatModelPrice(m)}</span>
                  ${m.id === activeId ? '<svg class="model-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>' : ""}
                </button>
              `).join("")}
            </div>
          </div>
        </div>`;
    }
    html += "</div>";

    // Rerank toggle
    const rerankEnabled = data.rerank?.enabled || false;
    html += `
      <div class="rerank-toggle" style="margin-top:24px">
        <label class="form-label">Cross-Meeting Search</label>
        <div class="toggle-row" id="rerankRow">
          <label class="toggle-switch">
            <input type="checkbox" id="rerankCheck" ${rerankEnabled ? "checked" : ""} onchange="toggleRerank()">
            <span class="toggle-slider"></span>
          </label>
          <div class="toggle-info">
            <span class="toggle-label">Rerank results</span>
            <span class="toggle-desc">${esc(data.rerank?.model || "bedrock.cohere.rerank-3-5")} — improves search relevance</span>
          </div>
        </div>
      </div>`;

    mc.innerHTML = html;
  } catch {
    const loader = document.getElementById("modelsLoader");
    if (loader) loader.innerHTML = '<p style="font-size:14px;color:var(--c-fg3)">Could not load model config.</p>';
  }
}

async function toggleRerank() {
  try {
    const res = await api("/api/models/rerank-toggle", { method: "POST" });
    showToast(res.enabled ? "Rerank enabled" : "Rerank disabled", "success");
  } catch (e) {
    showToast("Failed to toggle rerank: " + e.message, "error");
    loadModelsSection();
  }
}

function toggleModelDropdown(cat) {
  const el = document.getElementById(`mdrop-${cat}`);
  const isOpen = el.classList.contains("open");
  // Close all dropdowns first
  document.querySelectorAll(".model-dropdown.open").forEach(d => d.classList.remove("open"));
  if (!isOpen) el.classList.add("open");
}

// Close dropdowns on outside click
document.addEventListener("click", (e) => {
  if (!e.target.closest(".model-dropdown")) {
    document.querySelectorAll(".model-dropdown.open").forEach(d => d.classList.remove("open"));
  }
});

async function selectModel(cat, modelId) {
  document.querySelectorAll(".model-dropdown.open").forEach(d => d.classList.remove("open"));
  try {
    await api("/api/models", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: cat, model_id: modelId }),
    });
    showToast("Model updated", "success");
    loadModelsSection();
  } catch (e) {
    showToast("Failed to update model: " + e.message, "error");
  }
}

// ══════════════════════════════════════════════════════════════════
//  PAGE: Settings
// ══════════════════════════════════════════════════════════════════

async function renderSettings(app) {
  const theme = getTheme();

  app.innerHTML = `<div class="page-container settings-page">
    <h1 style="font-size:24px;font-weight:700;color:var(--c-fg);margin-bottom:4px">Settings</h1>
    <p style="font-size:14px;color:var(--c-fg2);margin-bottom:40px">Manage your preferences and view usage</p>

    <section class="settings-section">
      <h2 class="section-title">Appearance</h2>
      <div class="theme-grid">
        <button class="theme-card${theme === "dark" ? " active" : ""}" onclick="setTheme('dark'); renderSettings(document.getElementById('app'))">
          <span class="theme-card-icon">${ICONS.moon}</span>
          <span><span class="label">Dark</span><span class="desc">Easy on the eyes</span></span>
        </button>
        <button class="theme-card${theme === "light" ? " active" : ""}" onclick="setTheme('light'); renderSettings(document.getElementById('app'))">
          <span class="theme-card-icon">${ICONS.sun}</span>
          <span><span class="label">Light</span><span class="desc">Classic bright theme</span></span>
        </button>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="section-title">Models</h2>
      <div class="loading-center" id="modelsLoader">${ICONS.loader}</div>
      <div id="modelsContent" class="hidden"></div>
    </section>

    <section class="settings-section">
      <h2 class="section-title">API Usage & Cost</h2>
      <div class="loading-center" id="usageLoader">${ICONS.loader}</div>
      <div id="usageContent" class="hidden"></div>
    </section>
  </div>`;

  // Load models config
  loadModelsSection();

  // Load usage
  try {
    const usage = await api("/api/usage");
    document.getElementById("usageLoader")?.remove();
    const uc = document.getElementById("usageContent");
    if (!uc) return;
    uc.classList.remove("hidden");

    let html = `<div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">${ICONS.barChart} Total API Calls</div>
        <div class="stat-value">${usage.total_api_calls.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${ICONS.dollar} Estimated Cost</div>
        <div class="stat-value">$${usage.total_cost_usd.toFixed(4)}</div>
      </div>
    </div>`;

    const models = Object.entries(usage.models || {});
    if (models.length > 0) {
      html += `<div class="usage-table-wrap"><table class="usage-table">
        <thead><tr>
          <th>Model</th>
          <th class="right">Calls</th>
          <th class="right">Tokens</th>
          <th class="right">Audio</th>
          <th class="right">Cost</th>
        </tr></thead>
        <tbody>
          ${models.map(([model, m]) => `<tr>
            <td>${esc(model)}</td>
            <td class="right">${m.calls}</td>
            <td class="right">${m.total_tokens.toLocaleString()}</td>
            <td class="right">${m.audio_seconds > 0 ? Math.round(m.audio_seconds) + "s" : "-"}</td>
            <td class="right bold">$${m.cost_usd.toFixed(4)}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>`;
    } else {
      html += `<p style="font-size:14px;color:var(--c-fg3);text-align:center;padding:40px 0">No API usage recorded yet.</p>`;
    }

    uc.innerHTML = html;
  } catch {
    const loader = document.getElementById("usageLoader");
    if (loader) loader.innerHTML = `<p style="font-size:14px;color:var(--c-fg3)">Could not load usage data. Is the backend running?</p>`;
  }
}

// ── Utility ──────────────────────────────────────────────────────

function esc(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function renderChatMarkdown(text) {
  if (!text) return "";
  let html = esc(text);
  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Bullet lines: "- item" or "• item"
  html = html.replace(/^[\-•]\s+(.+)$/gm, '<div class="chat-bullet">$1</div>');
  // Numbered lines: "1. item"
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<div class="chat-bullet chat-bullet-num">$1</div>');
  // Section headers (lines ending with colon, standalone)
  html = html.replace(/^([A-Z][^\n:]{2,}):$/gm, '<div class="chat-section-header">$1</div>');
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  // Clean up double <br> around block elements
  html = html.replace(/<br>(<div class="chat-)/g, '$1');
  html = html.replace(/(<\/div>)<br>/g, '$1');
  return html;
}
