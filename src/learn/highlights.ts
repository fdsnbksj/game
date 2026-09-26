// Getting highlights in: a Kindle "My Clippings.txt", or text pasted from anywhere
// (Apple Books, Google Play Books, notes typed by hand). Everything stays on the device.

export interface Highlight {
  book: string;
  text: string;
}

/** Shorter than this and there's nothing to blank out and learn. */
const MIN_WORDS = 4;

const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();
const wordCount = (text: string) => text.split(' ').filter(Boolean).length;

/**
 * A Kindle's My Clippings.txt: entries split by a row of `=`, each a title line
 * ("Title (Author)"), a line of details starting "- " (highlight, note or bookmark, in
 * the device's language), a blank line, then the text. Bookmarks have no text and drop out.
 */
export function parseClippings(file: string): Highlight[] {
  const found: Highlight[] = [];
  for (const entry of file.replace(/^﻿/, '').split(/^=+\s*$/m)) {
    const lines = entry.split(/\r?\n/).map((line) => line.trim());
    while (lines.length > 0 && lines[0] === '') lines.shift();
    if (lines.length < 3 || !lines[1].startsWith('-')) continue;
    const book = tidy(lines[0].replace(/^﻿/, '').replace(/\s*\([^()]*\)\s*$/, '')) || 'Untitled';
    const text = tidy(lines.slice(2).join(' '));
    if (wordCount(text) >= MIN_WORDS) found.push({ book, text });
  }
  return dedupe(found);
}

/** Pasted text: one highlight per paragraph, or per line if there are no blank lines. */
export function parsePasted(text: string, book: string): Highlight[] {
  const blocks = /\n\s*\n/.test(text) ? text.split(/\n\s*\n/) : text.split(/\n/);
  const title = tidy(book) || 'Untitled';
  return dedupe(blocks.map(tidy).filter((block) => wordCount(block) >= MIN_WORDS).map((block) => ({ book: title, text: block })));
}

export function looksLikeClippings(file: string): boolean {
  return /^={5,}\s*$/m.test(file);
}

/** The same book and words; a Kindle re-exports every highlight each time. */
export const highlightKey = (h: Highlight) => `${h.book.toLowerCase()}\n${h.text.toLowerCase()}`;

function dedupe(list: Highlight[]): Highlight[] {
  const seen = new Set<string>();
  return list.filter((h) => {
    const key = highlightKey(h);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
