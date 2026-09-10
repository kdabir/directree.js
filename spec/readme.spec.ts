import { describe, expect, it } from 'vitest'
import fs from 'fs'
import { fileURLToPath } from 'url'

const readmePath = fileURLToPath(new URL('../README.md', import.meta.url))

// Regression test for a real bug: an editor/formatter mangled a fenced code
// block in README.md (split `skipped: [...]` across three lines with a
// dangling `:`), and it went unnoticed because nothing ever parses the
// README's code samples. This does.
const isSyntacticallyValidJs = (code: string): boolean => {
  // strip import lines - `new Function` bodies can't contain them, and we
  // only care about catching structural syntax errors like the one above
  const withoutImports = code
    .split('\n')
    .filter((line) => !/^\s*import\b/.test(line))
    .join('\n')
    .trim()

  // a snippet that's just a bare object literal (e.g. `{ a: 1 }`) parses as
  // a block statement with labels instead, unless wrapped as an expression
  const wrapped = withoutImports.startsWith('{') ? `(${withoutImports})` : withoutImports

  try {
    new Function(wrapped)
    return true
  } catch {
    return false
  }
}

// The actual historical bug: an object key ended up alone on its own line,
// with the colon pushed onto the line after it (`skipped\n:\n[...]`). This
// is valid JS - key:value whitespace is insignificant to the parser - so
// isSyntacticallyValidJs() above does NOT catch it; confirmed by testing it
// against the exact broken snippet before writing this check. It's a
// formatting defect, not a syntax one, so it needs its own pattern check.
const hasKeySplitFromColon = (code: string): boolean =>
  /^[ \t]*[A-Za-z_$][\w$]*[ \t]*\n[ \t]*:[ \t]*$/m.test(code)

describe("README code samples", () => {

  it("every javascript code block is syntactically valid", () => {
    const readme = fs.readFileSync(readmePath, 'utf8')
    const blocks = [...readme.matchAll(/```javascript\n([\s\S]*?)```/g)].map((m) => m[1]);

    expect(blocks.length).toBeGreaterThan(0); // sanity: the regex actually matched something

    for (const block of blocks) {
      if (!isSyntacticallyValidJs(block)) {
        throw new Error(`Invalid JS syntax in a README code block:\n\n${block}`);
      }
    }
  });

  it("no object key is split from its colon onto the next line", () => {
    const readme = fs.readFileSync(readmePath, 'utf8')
    const blocks = [...readme.matchAll(/```javascript\n([\s\S]*?)```/g)].map((m) => m[1]);

    for (const block of blocks) {
      if (hasKeySplitFromColon(block)) {
        throw new Error(`A key is split from its colon in a README code block:\n\n${block}`);
      }
    }
  });

});
