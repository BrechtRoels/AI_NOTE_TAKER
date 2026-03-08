"""Transcript assembly and searchable Q&A."""

import re
import asyncio
import logging
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from genai_client import get_embeddings, llm_complete

logger = logging.getLogger(__name__)


class TranscriptStore:
    def __init__(self):
        self.segments: list[dict] = []  # {"start", "end", "speaker", "text", "batch_idx"}
        self.embeddings: list[list[float]] = []
        self._batch_counter = 0

    def add_segment(self, start: float, end: float, speaker: str, text: str):
        self.segments.append({
            "start": start,
            "end": end,
            "speaker": speaker,
            "text": text,
            "batch_idx": self._batch_counter,
        })

    def increment_batch(self):
        self._batch_counter += 1

    @staticmethod
    def _fmt_ts(seconds: float) -> str:
        m, s = divmod(int(seconds), 60)
        return f"{m:02d}:{s:02d}"

    def get_full_transcript(self) -> str:
        lines = []
        for seg in self.segments:
            timestamp = f"[{self._fmt_ts(seg['start'])} - {self._fmt_ts(seg['end'])}]"
            lines.append(f"{timestamp} {seg['speaker']}: {seg['text']}")
        return "\n".join(lines)

    def get_recent_transcript(self, last_n_batches: int = 5) -> str:
        min_batch = max(0, self._batch_counter - last_n_batches)
        recent = [s for s in self.segments if s["batch_idx"] >= min_batch]
        lines = []
        for seg in recent:
            timestamp = f"[{self._fmt_ts(seg['start'])} - {self._fmt_ts(seg['end'])}]"
            lines.append(f"{timestamp} {seg['speaker']}: {seg['text']}")
        return "\n".join(lines)

    async def build_embeddings(self):
        """Build embeddings for all segments that don't have them yet."""
        if len(self.embeddings) >= len(self.segments):
            return
        new_texts = [s["text"] for s in self.segments[len(self.embeddings):]]
        if not new_texts:
            return
        new_embs = await get_embeddings(new_texts)
        self.embeddings.extend(new_embs)

    async def search(self, query: str, top_k: int = 5) -> list[dict]:
        """Find the most relevant transcript segments for a query."""
        await self.build_embeddings()
        if not self.embeddings:
            return []

        query_emb = await get_embeddings([query])
        query_vec = np.array(query_emb[0]).reshape(1, -1)
        seg_vecs = np.array(self.embeddings)

        sims = cosine_similarity(query_vec, seg_vecs)[0]
        top_indices = np.argsort(sims)[-top_k:][::-1]

        results = []
        for idx in top_indices:
            if sims[idx] > 0:
                results.append({**self.segments[idx], "score": float(sims[idx])})
        return results

    async def ask_question(self, question: str) -> str:
        """Answer a question using the transcript as context."""
        relevant = await self.search(question, top_k=8)
        if not relevant:
            return "No transcript data available yet."

        context = "\n".join(
            f"[{self._fmt_ts(s['start'])}] {s['speaker']}: {s['text']}" for s in relevant
        )

        prompt = f"""You are a meeting assistant. Based on the following transcript excerpts, answer the question.
If the answer is not in the transcript, say so. Use UK English.

TRANSCRIPT CONTEXT:
{context}

QUESTION: {question}

ANSWER:"""
        return await llm_complete(prompt)

    async def generate_summary(self, notes: str = "") -> dict:
        """Generate meeting summary using a multi-agent pipeline.

        Pipeline:
        1. Extract structured agenda, summary, decisions, action items
        2. Validation agent — validates against transcript
        3. Gap agent — finds missing discussion points
        4. Critical agent — reviews decisions and action items
        5. Refinement — incorporates all feedback into final output

        All output is in UK English.
        """
        transcript = self.get_full_transcript()
        if not transcript:
            return {"summary": "No transcript.", "action_items": [], "decisions": [], "agenda": []}

        # Condense long transcripts via chunked summarisation
        max_chars = 12000
        if len(transcript) > max_chars:
            transcript_text = await self._condense_transcript(transcript, max_chars)
        else:
            transcript_text = transcript

        # Step 1: Extract structured content
        initial = await self._extract_structured(transcript_text, notes=notes)
        logger.info("Step 1 complete: structured extraction")

        # Build review text for agents
        review_text = _format_for_review(initial)

        # Combine transcript and notes for validation context
        full_context = transcript_text
        if notes:
            full_context += f"\n\nUSER NOTES:\n{notes}"

        # Step 2: Run validation, gap, and critical agents in parallel
        validation, gaps, critical = await asyncio.gather(
            self._validation_agent(full_context, review_text),
            self._gap_agent(full_context, review_text),
            self._critical_agent(full_context, initial),
        )
        logger.info("Step 2 complete: agent reviews")

        # Step 3: Refine based on all agent feedback
        final = await self._refine_with_feedback(initial, validation, gaps, critical)
        logger.info("Step 3 complete: final refinement")

        return final

    async def _condense_transcript(self, transcript: str, max_chars: int) -> str:
        """Condense a long transcript via chunked summarisation."""
        lines = transcript.split("\n")
        chunks = []
        current_chunk: list[str] = []
        current_len = 0
        for line in lines:
            if current_len + len(line) > max_chars and current_chunk:
                chunks.append("\n".join(current_chunk))
                current_chunk = []
                current_len = 0
            current_chunk.append(line)
            current_len += len(line) + 1
        if current_chunk:
            chunks.append("\n".join(current_chunk))

        chunk_summaries = []
        for i, chunk in enumerate(chunks):
            prompt = f"""Summarise this portion ({i+1}/{len(chunks)}) of a meeting transcript.
Preserve all discussion topics, decisions, and action items mentioned.
Use UK English.

TRANSCRIPT:
{chunk}"""
            result = await llm_complete(prompt)
            chunk_summaries.append(result)

        return "\n\n---\n\n".join(chunk_summaries)

    async def _extract_structured(self, transcript_text: str, notes: str = "") -> dict:
        """Step 1: Extract structured agenda, summary, decisions, and action items."""
        notes_section = ""
        if notes:
            notes_section = f"""

IMPORTANT - USER NOTES:
The meeting organiser wrote these notes during the meeting. They MUST be incorporated into the summary.
Treat these notes as high-priority context - they may highlight key points, decisions, or action items
that should definitely appear in the output.

NOTES:
{notes}
"""

        prompt = f"""Analyse the following meeting transcript and produce a structured summary.
Use UK English throughout.

CRITICAL RULES - READ CAREFULLY:
- ONLY include information that is EXPLICITLY stated in the transcript. Do NOT infer, assume, or fabricate any content.
- If the transcript is very short or contains minimal content (e.g. just greetings), reflect that honestly. A short meeting gets a short summary.
- If a section has no relevant content, write "None" or leave it empty. Do NOT invent filler content.
- Every claim in the summary MUST be directly traceable to specific words in the transcript.
- Do NOT speculate about what "might have been discussed" or add generic business topics that are not in the transcript.
{notes_section}
Provide the following sections:

AGENDA:
List the main discussion topics as numbered points (e.g. 1. Topic name).
Only list topics that were ACTUALLY discussed. If only greetings were exchanged, write "1. Greetings" - do not invent topics.

SUMMARY:
For each numbered agenda point, provide concise bullet-point answers.
Combine related points into a single bullet - aim for 1-3 bullets per topic, not one per sentence.
Each bullet point must not exceed 2 sentences.
Each bullet point MUST start with a timestamp in [MM:SS] format showing when this was discussed.
Use the timestamps from the transcript to determine the correct time.
Use the format:
1. [Topic name]
  - [MM:SS] [Concise combined bullet point, max 2 sentences]
2. [Topic name]
  - [MM:SS] [Bullet point]

DECISIONS:
- [Each decision explicitly made or agreed upon during the meeting]
Only include decisions that were clearly stated or agreed to by participants. Do NOT invent or suggest decisions. If none, write "None".

ACTION ITEMS:
- [Each action item explicitly assigned or volunteered during the meeting, with the responsible person if mentioned]
Only include action items that participants explicitly committed to or were assigned. Do NOT suggest or infer action items that were not discussed. If none, write "None".

TRANSCRIPT:
{transcript_text}"""
        response = await llm_complete(prompt)
        return _parse_structured_response(response)

    async def _validation_agent(self, transcript: str, summary_text: str) -> str:
        """Validation agent: check summary accuracy against the transcript."""
        prompt = f"""You are a strict validation agent. Your task is to compare the following meeting summary
against the original transcript (and user notes, if present) and identify any inaccuracies, misrepresentations,
hallucinations, or statements not supported by the transcript or notes.
Use UK English.

Pay special attention to:
- Topics or agenda items mentioned in the summary that do NOT appear in the transcript or user notes (hallucinations)
- Claims about decisions or action items that were never discussed
- Any content that seems fabricated or generic rather than based on what was actually said
- If the transcript is short/simple but the summary contains elaborate content, flag this as hallucination
- Content from user notes IS valid and should NOT be flagged as hallucination

MEETING SUMMARY:
{summary_text}

ORIGINAL TRANSCRIPT AND NOTES:
{transcript}

List any issues found. For each issue, quote the problematic summary text AND explain why it is not supported by the transcript or notes.
If the summary is accurate, state "No issues found.\""""
        return await llm_complete(prompt)

    async def _gap_agent(self, transcript: str, summary_text: str) -> str:
        """Gap agent: identify missing discussion points."""
        prompt = f"""You are a gap analysis agent. Your task is to compare the following meeting summary
against the original transcript and identify any discussion points, topics, or important
information from the transcript that are missing from the summary.
Use UK English.

MEETING SUMMARY:
{summary_text}

ORIGINAL TRANSCRIPT:
{transcript}

List any missing points that should be included. If the summary is comprehensive,
state "No gaps found." Be specific about what is missing."""
        return await llm_complete(prompt)

    async def _critical_agent(self, transcript: str, data: dict) -> str:
        """Critical agent: review decisions and action items."""
        decisions_text = "\n".join(f"- {d}" for d in data.get("decisions", [])) or "None"
        actions_text = "\n".join(f"- {a}" for a in data.get("action_items", [])) or "None"

        prompt = f"""You are a critical review agent. Your task is to critically review the following
decisions and action items extracted from a meeting against the original transcript.
Use UK English.

For each item, assess:
1. Was it EXPLICITLY stated, agreed upon, or assigned in the transcript? If not, it must be REMOVED.
2. Is it clear and specific?
3. Is it actionable with clear ownership (for action items)?

IMPORTANT: Remove any decisions or action items that were NOT explicitly discussed or agreed to
by participants. Do NOT keep items that appear to be suggestions or inferences by the summariser
rather than actual agreements from the meeting.

DECISIONS:
{decisions_text}

ACTION ITEMS:
{actions_text}

TRANSCRIPT (for context):
{transcript}

Provide your critical review. Remove items not supported by the transcript.
For items that are valid but need improvement, suggest a revised version.
If all items are satisfactory, state "All items are clear and well-defined."

Format any suggested revisions as:

REVISED DECISIONS:
- [Revised decision]

REVISED ACTION ITEMS:
- [Revised action item]"""
        return await llm_complete(prompt)

    async def _refine_with_feedback(self, initial: dict, validation: str, gaps: str, critical: str) -> dict:
        """Final step: refine the summary incorporating all agent feedback."""
        initial_text = _format_for_review(initial)

        prompt = f"""You are producing the final refined version of a meeting summary.
Incorporate the feedback from the validation, gap analysis, and critical review agents.
Use UK English throughout.

INITIAL SUMMARY:
{initial_text}

VALIDATION FEEDBACK:
{validation}

GAP ANALYSIS:
{gaps}

CRITICAL REVIEW:
{critical}

Produce the final version in this exact format:

AGENDA:
1. [Topic]
2. [Topic]

SUMMARY:
1. [Topic]
  - [MM:SS] [Bullet point, max 2 sentences]
2. [Topic]
  - [MM:SS] [Bullet point, max 2 sentences]

DECISIONS:
- [Decision]

ACTION ITEMS:
- [Action item with responsible person]

Rules:
- REMOVE any content flagged as hallucinated or not supported by the transcript by the validation agent. This is the highest priority.
- Fix any other inaccuracies identified by the validation agent.
- Add any missing points identified by the gap agent, but ONLY if they are genuinely present in the transcript.
- Use improved versions of decisions and action items from the critical review where appropriate.
- REMOVE any decisions or action items that the critical review identified as not explicitly agreed upon in the meeting. Do NOT invent or suggest new ones.
- If no decisions or action items were explicitly agreed, write "None" for those sections.
- Combine related summary bullets into fewer, more concise points. Aim for 1-3 bullets per topic.
- Each summary bullet point must not exceed 2 sentences.
- Each summary bullet point MUST start with a [MM:SS] timestamp showing when this was discussed. Preserve timestamps from the initial summary.
- Use UK English spelling and grammar throughout.
- If the meeting was very short or had minimal content, the summary should reflect that - do NOT pad it with fabricated content."""
        response = await llm_complete(prompt)
        return _parse_structured_response(response)


# ── Helpers ──────────────────────────────────────────────────────────


def _strip_markdown(s: str) -> str:
    """Remove markdown formatting like ** and ## from a string."""
    return re.sub(r'[*#]+\s*', '', s).strip()


def _is_section_header(line: str, keyword: str) -> bool:
    """Check if a line is a section header, ignoring markdown formatting."""
    cleaned = _strip_markdown(line).upper()
    return cleaned.startswith(keyword)


def _format_for_review(data: dict) -> str:
    """Format parsed summary data as text for agent review."""
    parts = []
    if data.get("agenda"):
        parts.append("AGENDA:")
        for i, item in enumerate(data["agenda"], 1):
            parts.append(f"{i}. {item}")
    if data.get("summary"):
        parts.append("\nSUMMARY:")
        parts.append(data["summary"])
    if data.get("decisions"):
        parts.append("\nDECISIONS:")
        for d in data["decisions"]:
            parts.append(f"- {d}")
    if data.get("action_items"):
        parts.append("\nACTION ITEMS:")
        for a in data["action_items"]:
            parts.append(f"- {a}")
    return "\n".join(parts)


def _parse_structured_response(response: str) -> dict:
    """Parse structured response with AGENDA, SUMMARY, DECISIONS, ACTION ITEMS."""
    sections = {"agenda": [], "summary": "", "action_items": [], "decisions": []}
    current = None
    summary_lines = []

    for line in response.split("\n"):
        stripped = line.strip()

        if _is_section_header(stripped, "AGENDA"):
            current = "agenda"
            continue
        elif _is_section_header(stripped, "SUMMARY"):
            current = "summary"
            continue
        elif _is_section_header(stripped, "REVISED ACTION") or _is_section_header(stripped, "ACTION ITEM"):
            if _is_section_header(stripped, "REVISED ACTION"):
                sections["action_items"] = []
            current = "action_items"
            continue
        elif _is_section_header(stripped, "REVISED DECISION") or _is_section_header(stripped, "DECISION"):
            if _is_section_header(stripped, "REVISED DECISION"):
                sections["decisions"] = []
            current = "decisions"
            continue

        if not stripped:
            if current == "summary":
                summary_lines.append("")
            continue

        if current == "agenda":
            item = re.sub(r'^\d+[.)]\s*', '', stripped)
            item = _strip_markdown(item)
            if item:
                sections["agenda"].append(item)
        elif current == "summary":
            summary_lines.append(line.rstrip())
        elif current in ("action_items", "decisions"):
            item = re.sub(r'^[-*\u2022]\s*|^\d+[.)]\s*', '', stripped)
            item = _strip_markdown(item)
            if item:
                sections[current].append(item)

    sections["summary"] = "\n".join(summary_lines).strip()

    if not sections["agenda"] and not sections["summary"] and not sections["action_items"] and not sections["decisions"]:
        logger.warning("Structured parsing failed, using raw response")
        sections["summary"] = response.strip()

    return sections
