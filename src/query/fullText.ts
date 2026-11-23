// Full-text search modelled on Contentful's `query=` / `[match]` semantics:
// - case insensitive, HTML tags stripped, text tokenized on non-alphanumerics
// - every search term gets a wildcard suffix (left-anchored prefix match)
// - terms shorter than 2 characters are ignored
// - all terms must match, in any order, across any field / locale
// - "quoted phrases" must match consecutive tokens, in order, within one value

const MIN_TERM_LENGTH = 2

export interface ParsedSearch {
  terms: string[]
  phrases: string[][]
}

function tokenize(text: string): string[] {
  return text
    .replace(/<[^>]*>/g, ' ')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
}

export function parseSearch(input: string): ParsedSearch {
  const phrases: string[][] = []
  const rest = input.replace(/"([^"]*)"/g, (_, phrase: string) => {
    const tokens = tokenize(phrase).filter((t) => t.length >= MIN_TERM_LENGTH)
    if (tokens.length > 0) phrases.push(tokens)
    return ' '
  })
  const terms = tokenize(rest).filter((t) => t.length >= MIN_TERM_LENGTH)
  return { terms, phrases }
}

export function isEmptySearch(search: ParsedSearch): boolean {
  return search.terms.length === 0 && search.phrases.length === 0
}

// Collect searchable text from a field value: plain strings, arrays of strings
// and the text nodes of Rich Text documents. Links, locations and other objects
// are not searchable.
function collectText(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value)
  } else if (Array.isArray(value)) {
    for (const v of value) collectText(v, out)
  } else if (value !== null && typeof value === 'object' && 'nodeType' in value) {
    const node = value as { nodeType: unknown; value?: unknown; content?: unknown }
    if (node.nodeType === 'text' && typeof node.value === 'string') out.push(node.value)
    if (Array.isArray(node.content)) for (const c of node.content) collectText(c, out)
  }
}

// Returns the tokenized text of every value in every locale of every field.
export function searchableValues(fields: Record<string, unknown>): string[][] {
  const texts: string[] = []
  for (const localized of Object.values(fields)) {
    if (localized === null || typeof localized !== 'object') continue
    for (const value of Object.values(localized as Record<string, unknown>)) {
      collectText(value, texts)
    }
  }
  return texts.map(tokenize)
}

function countTerm(values: string[][], term: string): number {
  let count = 0
  for (const tokens of values) for (const t of tokens) if (t.startsWith(term)) count++
  return count
}

function countPhrase(values: string[][], phrase: string[]): number {
  let count = 0
  for (const tokens of values) {
    for (let i = 0; i + phrase.length <= tokens.length; i++) {
      if (phrase.every((p, j) => tokens[i + j].startsWith(p))) count++
    }
  }
  return count
}

// Relevance score of a document for a search: 0 when it does not match,
// otherwise the number of matching term / phrase occurrences.
export function scoreSearch(values: string[][], search: ParsedSearch): number {
  let score = 0
  for (const term of search.terms) {
    const n = countTerm(values, term)
    if (n === 0) return 0
    score += n
  }
  for (const phrase of search.phrases) {
    const n = countPhrase(values, phrase)
    if (n === 0) return 0
    score += n * phrase.length
  }
  return score
}
