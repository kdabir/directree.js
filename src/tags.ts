// Opt-in tagged-template helpers so editors (WebStorm's built-in language
// injection, VS Code extensions matching on tag identifier) can
// syntax-highlight file content authored inline as tree values.
//
// Plain strings keep working unchanged: `directree({'x.html': html`<div/>`})`
// is sugar over `directree({'x.html': '<div/>'})`.

export type Tag = (strings: TemplateStringsArray, ...values: unknown[]) => string

const interpolate = (strings: TemplateStringsArray, values: unknown[]): string =>
  strings.reduce((acc, s, i) => acc + s + (i < values.length ? String(values[i]) : ''), '')

const leadingWhitespaceLength = (line: string): number => line.match(/^[ \t]*/)?.[0].length ?? 0

// Strips the common leading whitespace from every line, so a template
// written indented to match the surrounding source (the natural way to
// write it) renders with a clean left margin in the file it produces.
// Relative indentation between lines is preserved - only the shared
// margin is removed. A single leading/trailing blank line (from opening
// or closing the backtick on its own line) is dropped first.
const dedent = (text: string): string => {
  const lines = text.split('\n')

  if (lines.length > 1 && lines[0].trim() === '') lines.shift()
  if (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop()

  const indents = lines.filter((line) => line.trim() !== '').map(leadingWhitespaceLength)

  const minIndent = indents.length > 0 ? Math.min(...indents) : 0

  return lines.map((line) => line.slice(minIndent)).join('\n')
}

// Escape hatch: interpolates like the tags below, but skips dedent, for
// the rare case where source-level whitespace must be preserved exactly.
export const raw: Tag = (strings, ...values) => interpolate(strings, values)

const tag: Tag = (strings, ...values) => dedent(interpolate(strings, values))

export const js: Tag = tag
export const ts: Tag = tag
export const jsx: Tag = tag
export const tsx: Tag = tag

export const html: Tag = tag
export const css: Tag = tag

// json() also accepts a plain object/array/value (any call that isn't a
// real tagged-template invocation, detected via the `raw` property the JS
// engine always attaches to a genuine TemplateStringsArray) and serializes
// it with JSON.stringify - real object-literal syntax and type-checking
// beat hand-typing JSON text for anything beyond the trivial case.
const isTemplateStringsArray = (x: unknown): x is TemplateStringsArray =>
  Array.isArray(x) && Array.isArray((x as { raw?: unknown }).raw)

export function json(strings: TemplateStringsArray, ...values: unknown[]): string
export function json(data: unknown): string
export function json(first: TemplateStringsArray | unknown, ...rest: unknown[]): string {
  if (isTemplateStringsArray(first)) return tag(first, ...rest)
  return JSON.stringify(first, null, 2)
}

export const yaml: Tag = tag
export const csv: Tag = tag
export const toml: Tag = tag
export const xml: Tag = tag

export const md: Tag = tag
export const text: Tag = tag

export const sql: Tag = tag

// makefile also converts each recipe line's leading whitespace to a tab:
// `make` requires an actual tab before every recipe line (including
// continuation lines), no exceptions, so after dedent any remaining
// leading whitespace is almost certainly meant to be a recipe line - a
// real Makefile doesn't indent anything else. Only the shared "this line
// is a recipe" marker becomes a tab; any deeper indentation is kept as
// spaces, so nested shell structure within a recipe still reads clearly.
const toTabs = (text: string): string => {
  const lines = text.split('\n')

  const indents = lines.map(leadingWhitespaceLength).filter((n) => n > 0)

  if (indents.length === 0) return text

  const recipeIndent = Math.min(...indents)

  return lines
    .map((line) => (leadingWhitespaceLength(line) === 0 ? line : '\t' + line.slice(recipeIndent)))
    .join('\n')
}

// Note: a trailing `\` for Make's own recipe line-continuation needs to be
// written as `\\` in the template - a lone `\` immediately before the
// template literal's own newline is consumed by JS's line-continuation
// parsing before this function ever sees the string. This is standard JS
// template-literal behavior, not specific to this tag, but it's the one
// place in this list where writers are likely to hit it.
export const makefile: Tag = (strings, ...values) => toTabs(tag(strings, ...values))
