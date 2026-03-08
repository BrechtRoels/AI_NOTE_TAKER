const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Types ───────────────────────────────────────────────────────────

export type Segment = {
  start: number;
  end: number;
  speaker: string;
  text: string;
};

export type Summary = {
  summary: string;
  action_items: string[];
  decisions: string[];
};

export type MeetingListItem = {
  session_id: string;
  name: string;
  status: string;
  created_at: string;
  total_segments: number;
  tags: string[];
};

export type MeetingDetail = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  segments: Segment[];
  transcript: string;
  total_segments: number;
  summary: Summary;
  qa_history: Array<{ question: string; answer: string }>;
  tags: string[];
};

export type UsageModel = {
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  audio_seconds: number;
  cost_usd: number;
};

export type UsageStats = {
  models: Record<string, UsageModel>;
  total_cost_usd: number;
  total_api_calls: number;
};

// ── Meetings ────────────────────────────────────────────────────────

export async function listMeetings(): Promise<{ meetings: MeetingListItem[] }> {
  return request("/api/meetings");
}

export async function getMeeting(id: string): Promise<MeetingDetail> {
  return request(`/api/meetings/${id}`);
}

export async function deleteMeeting(id: string): Promise<void> {
  return request(`/api/meetings/${id}`, { method: "DELETE" });
}

export async function updateMeeting(
  id: string,
  updates: { name?: string; tags?: string[] }
): Promise<{ status: string; name: string; tags: string[] }> {
  return request(`/api/meetings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

// ── Sessions ────────────────────────────────────────────────────────

export async function createSession(config: {
  name: string;
  record_screen: boolean;
  record_mic: boolean;
  tags?: string[];
}): Promise<{ session_id: string; status: string; name: string }> {
  return request("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

export async function getSuggestions(
  sessionId: string
): Promise<{ suggestions: string[]; related_meetings: Array<{ id: string; name: string }> }> {
  return request(`/api/sessions/${sessionId}/suggestions`);
}

export async function uploadAudioChunk(
  sessionId: string,
  audioBlob: Blob
): Promise<{ batch_index: number; segments_added: number; transcript_preview: string }> {
  const form = new FormData();
  form.append("audio", audioBlob, "chunk.webm");
  return request(`/api/sessions/${sessionId}/audio`, { method: "POST", body: form });
}

export async function getTranscript(
  sessionId: string,
  recent = false
): Promise<{ transcript: string; segments: Segment[]; total_segments: number }> {
  return request(`/api/sessions/${sessionId}/transcript?recent=${recent}`);
}

export async function askQuestion(
  sessionId: string,
  question: string
): Promise<{ answer: string; relevant_segments: Array<Record<string, unknown>> }> {
  return request(`/api/sessions/${sessionId}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

export async function finishSession(sessionId: string): Promise<{ summary: Summary }> {
  return request(`/api/sessions/${sessionId}/finish`, { method: "POST" });
}

export async function askGlobal(
  question: string
): Promise<{ answer: string; sources: string[] }> {
  return request("/api/ask-global", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

export async function startSystemCapture(sessionId: string): Promise<{ status: string }> {
  return request(`/api/sessions/${sessionId}/start-system-capture`, { method: "POST" });
}

export async function stopSystemCapture(sessionId: string): Promise<{ status: string }> {
  return request(`/api/sessions/${sessionId}/stop-system-capture`, { method: "POST" });
}

export async function getUsage(): Promise<UsageStats> {
  return request("/api/usage");
}
