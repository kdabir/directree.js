import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import directree from '../src'
import { css, csv, html, js, json, jsx, makefile, md, raw, sql, text, toml, ts, tsx, xml, yaml } from '../src'

const tags = { html, css, sql, yaml, md, xml, json, tsx, ts, jsx, js, csv, toml, text, makefile }

describe("template tags", () => {

  for (const [name, tag] of Object.entries(tags)) {
    it(`${name} interpolates values and returns a plain string`, () => {
      const value = 21
      const result = tag`<x n="${value * 2}">plain text</x>`;

      expect(result).toBe('<x n="42">plain text</x>');
      expect(typeof result).toBe('string');
    });
  }

  it("with no interpolation, behaves as a plain passthrough", () => {
    expect(html`<div></div>`).toBe('<div></div>');
  });

  it("output round-trips through directree() exactly like a plain string", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'directree-tags-'));
    const originalCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      directree({
        'index.html': html`<div>${'hi'}</div>`,
        'style.css': css`body { color: red; }`,
      }, 'out');

      expect(fs.readFileSync('out/index.html', 'utf8')).toBe('<div>hi</div>');
      expect(fs.readFileSync('out/style.css', 'utf8')).toBe('body { color: red; }');
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("dedents multi-line content to its minimum indentation, dropping the leading/trailing blank line", () => {
    const result = html`
      <!doctype html>
      <h1>Hi</h1>
    `;

    expect(result).toBe('<!doctype html>\n<h1>Hi</h1>');
  });

  it("preserves relative indentation between lines while dedenting the shared margin", () => {
    const result = html`
      <div>
        <span>x</span>
      </div>
    `;

    expect(result).toBe('<div>\n  <span>x</span>\n</div>');
  });

  it("dedent is a no-op for single-line content (nothing to strip)", () => {
    expect(html`<div></div>`).toBe('<div></div>');
  });

  it("raw interpolates like the other tags but skips dedent entirely", () => {
    const value = 21;
    expect(raw`<x n="${value * 2}"></x>`).toBe('<x n="42"></x>');

    const indented = raw`
      kept verbatim
    `;
    expect(indented).toBe('\n      kept verbatim\n    ');
  });

});

describe("makefile converts recipe-line indentation to tabs", () => {

  it("converts a recipe line's leading indentation to a single tab", () => {
    const result = makefile`
      build:
        gcc -o out main.c
    `;

    expect(result).toBe('build:\n\tgcc -o out main.c');
  });

  it("preserves deeper indentation within a recipe as spaces after the tab", () => {
    const result = makefile`
      build:
        echo start
          echo nested
        echo end
    `;

    expect(result).toBe('build:\n\techo start\n\t  echo nested\n\techo end');
  });

  it("leaves unindented lines (targets, variables) untouched", () => {
    const result = makefile`
      CC = gcc
      build:
        $(CC) -o out main.c
    `;

    expect(result).toBe('CC = gcc\nbuild:\n\t$(CC) -o out main.c');
  });

});

describe("json() also accepts a plain value to serialize", () => {

  it("serializes a plain object with JSON.stringify's 2-space indent", () => {
    const data = { name: 'x', tags: ['a', 'b'] };
    expect(json(data)).toBe(JSON.stringify(data, null, 2));
  });

  it("still works as a tagged template, unaffected by the object overload", () => {
    expect(json`{"a": 1}`).toBe('{"a": 1}');
  });

  it("round-trips a serialized object through directree() and JSON.parse", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'directree-json-'));
    const originalCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      const data = { name: 'my-project', private: true, scripts: { build: 'tsc' } };
      directree({ 'package.json': json(data) }, 'out');

      expect(JSON.parse(fs.readFileSync('out/package.json', 'utf8'))).toEqual(data);
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

});
