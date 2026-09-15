import { z } from 'zod';

export const VOICE_SAMPLE_RATE = 16000;
export const MAX_VOICE_SECONDS = 600;
export const MAX_TRANSCRIPT_LENGTH = 24000;
export const MAX_VOICE_NOTES = 50;
export type VoiceLanguage = 'en' | 'hi';
export type VoiceMode = 'note' | 'dictation' | 'meeting' | 'activity' | 'assistant';
export type VoicePack = 'speech' | 'en' | 'hi';
export const voiceNoteSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(100),
  transcript: z.string().trim().min(1).max(MAX_TRANSCRIPT_LENGTH),
  summary: z.string().max(3000).default(''),
  language: z.enum(['en', 'hi']),
  durationSeconds: z.number().finite().min(0).max(MAX_VOICE_SECONDS),
  createdAt: z.string().datetime(),
});
export type VoiceNote = z.infer<typeof voiceNoteSchema>;

export function joinAudio(chunks: readonly Float32Array[]): Float32Array {
  const output = new Float32Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

/** Byte-for-byte source coverage: long transcripts are never silently truncated. */
export function splitTranscript(text: string, limit = 2000): string[] {
  if (limit < 1) throw new Error('Chunk size must be positive.');
  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(text.length, offset + limit);
    if (end < text.length) {
      const boundary = text.lastIndexOf(' ', end - 1);
      if (boundary > offset + limit / 2) end = boundary + 1;
      // Keep a surrogate pair together at a hard boundary.
      if (end > offset && /[\uD800-\uDBFF]/.test(text[end - 1]!)) end--;
    }
    if (end === offset) end = Math.min(text.length, offset + 2);
    chunks.push(text.slice(offset, end)); offset = end;
  }
  return chunks;
}
