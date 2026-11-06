// Counts for a piece of plain text (the editor adds its own counts for lists, images and so on from the document).
// Pure and browser-safe so it can be tested.

export type TextStats = {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  spaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingMinutes: number;
  speakingMinutes: number;
  avgWordsPerSentence: number;
  longestWord: number;
};

const READ_WPM = 200;
const SPEAK_WPM = 130;

/** `text` is the note's text with a newline between blocks. */
export function textStats(text: string): TextStats {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const characters = text.replace(/\n/g, "").length;
  const spaces = (text.match(/[ \t ]/g) ?? []).length;
  const sentences = trimmed ? trimmed.split(/(?<=[.!?…])["')\]]*\s+|\n+/).filter((s) => /[\p{L}\p{N}]/u.test(s)).length : 0;
  const lines = text.split("\n").filter((l) => l.trim()).length;
  const minutes = (wpm: number) => (words === 0 ? 0 : Math.max(1, Math.round(words / wpm)));
  const longestWord = trimmed ? Math.max(...trimmed.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, "").length)) : 0;
  return {
    words,
    characters,
    charactersNoSpaces: characters - spaces,
    spaces,
    sentences,
    paragraphs: lines,
    lines,
    readingMinutes: minutes(READ_WPM),
    speakingMinutes: minutes(SPEAK_WPM),
    avgWordsPerSentence: sentences ? Math.round((words / sentences) * 10) / 10 : 0,
    longestWord,
  };
}
