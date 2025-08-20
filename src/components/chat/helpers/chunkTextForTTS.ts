//src/components/chat/helpers/chunkTextForTTS.ts
//
// Controls to define when we shoudl break up tts audio into more than one chunk

export function chunkTextForTTS(text: string): [string, string?] {
  if (text.length <= 80) return [text];

  const sentenceEndRegex = /(?<=[.!?])\s+/;
  const sentences = text.split(sentenceEndRegex).filter(Boolean);
  const first = sentences[0] ?? "";
  const second = sentences[1] ?? "";
  const introChunk =
    first.length >= 30 ? first : [first, second].join(" ").trim();
  const remainder = text.slice(introChunk.length).trim();
  return [introChunk, remainder || undefined];
}
