# Saathi feature rollout

Source: [the user's shared 35-feature conversation](https://chatgpt.com/share/6aa9633f-e0d8-83ee-ad3c-3e6180fd257d), read September 15, 2026. The user selected **voice features 15–20 as the first batch**. Implemented does not mean validated on physical hardware.

## Batch 1 — voice implementation

| #   | Feature                   | Scope (physical-device QA pending)                                                                                                 |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 15  | Voice-note transcription  | Foreground capture, English/Hindi Whisper, editable transcript, encrypted text history. Raw audio is not saved.                    |
| 16  | Live dictation            | Updates after pauses or ~8 seconds of speech, token updates, bounded queue, finish/cancel. Device-dependent latency.               |
| 17  | Meeting summary / actions | Up to 10-minute clips, whole-transcript chunking, validated summaries/action drafts, review before planner writes. No diarization. |
| 18  | Read articles aloud       | Pasted text, notebook notes or saved transcripts; downloaded English/Hindi Kokoro voices; speed and stop. No URL fetch.            |
| 19  | Detect speech / silence   | FSMN detector, microphone levels, processed speech duration, detection-only mode. No speaker identification.                       |
| 20  | Offline voice assistant   | Tap → speak → finish → Whisper → Qwen → Kokoro. One question per turn; sequential model lifetimes. No wake word.                   |

See [voice architecture, limits and tests](VOICE.md). Device Health graphs distinguish listening, transcribing and speaking.

## Remaining batches

| #   | Feature                        | Status / prerequisite                                                   |
| --- | ------------------------------ | ----------------------------------------------------------------------- |
| 1   | Private AI chatbot             | Existing note-grounded questions; general multi-turn chat remains.      |
| 2   | Notes summarizer               | Meeting summaries implemented; general notebook summarizer remains.     |
| 3   | Grammar correction / rewriting | Existing short rewriting; dedicated grammar review remains.             |
| 4   | Email, caption, message drafts | Planned; sending is separate.                                           |
| 5   | Text translation               | Planned; language-specific quality evaluation.                          |
| 6   | Quiz / flashcard generator     | Planned; structured output and answer review.                           |
| 7   | NPC dialogue / game hints      | Planned; playable scenario and game rules needed.                       |
| 8   | Natural-language commands      | Task extraction with review exists; broader allowlisted actions remain. |
| 9   | Semantic notes search          | Planned; embeddings and encrypted index. Current search uses keywords.  |
| 10  | Chat with documents            | Planned; file/PDF import, extraction and citations.                     |
| 11  | Similar-photo search           | Planned; user-selected gallery assets and image embeddings.             |
| 12  | Text-to-photo search           | Planned; aligned text/image encoders.                                   |
| 13  | Saved-content recommendations  | Planned; ranking and feedback.                                          |
| 14  | Group notes/documents          | Planned; embeddings and editable clusters.                              |
| 21  | Photo-to-text scanner          | Planned; camera/import and OCR.                                         |
| 22  | Receipt / invoice extraction   | Planned; OCR and typed amount/field review.                             |
| 23  | Image categories               | Planned; classification and supported labels.                           |
| 24  | Detect/count objects           | Planned; detection overlays. Video tracking is separate.                |
| 25  | Background cutout/blur         | Planned; segmentation, mask rendering and export.                       |
| 26  | Fitness rep counter            | Planned; pose model, exercise rules and camera validation.              |
| 27  | Artistic photo filters         | Planned; style models and export.                                       |
| 28  | Explain a photo                | Planned; vision-language model and image input.                         |
| 29  | Text-to-image                  | Planned; device/model memory and thermal evaluation first.              |
| 30  | Sensitive-text detection       | Planned; privacy model, review and measured coverage.                   |
| 31  | Live-information assistant     | Planned; choose search/live data providers and backend contract.        |
| 32  | Customer support               | Planned; requires FAQ/order data and escalation destination.            |
| 33  | Booking / external actions     | Planned; requires provider/authentication and action review.            |
| 34  | Shared knowledge               | Planned; backend identity, permissions and sync.                        |
| 35  | Adaptive local/cloud AI        | Planned; backend provider, routing and consent for data transfer.       |

Next order: text tools (1–8), knowledge/search (9–14), vision (21–30), then online integrations (31–35). New native dependencies and model packs are added with their batch. Every batch requires TypeScript/tests/bundles, both native builds, and physical-device accuracy, offline, interruption, accessibility and thermal acceptance checks.
