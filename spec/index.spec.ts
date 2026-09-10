import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import directree, { html, json, read } from '../src/index'

const isFile = (p: string) => fs.lstatSync(p).isFile()
const isEmptyFile = (file: string) => fs.readFileSync(file, 'utf8').length === 0
const contentsOf = (file: string) => fs.readFileSync(file, 'utf8')
const isDir = (p: string) => fs.lstatSync(p).isDirectory()
const childrenOf = (dir: string) => fs.readdirSync(dir).sort()

const originalCwd = process.cwd()
let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'directree-'))
  process.chdir(tmpDir)

  // fixture: mirrors the tree the old mock-fs setup provided
  fs.mkdirSync('root/some-dir', { recursive: true })
  fs.writeFileSync('root/existing.file', 'original content')
  fs.mkdirSync('a/new/root', { recursive: true })
})

afterEach(() => {
  process.chdir(originalCwd)
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

it('fixture should set up dir structure', () => {
  expect(isDir('root')).toBe(true)
  expect(isDir('a/new/root')).toBe(true)
  expect(contentsOf('root/existing.file')).toEqual('original content')
  expect(childrenOf('root')).toEqual(['existing.file', 'some-dir'])
  expect(childrenOf('root/some-dir')).toEqual([])
})


describe("directree on blank dir", () => {

  it("should be able to specify root dir", () => {
    directree({
      'new.file': 'original content',
      'some-dir': {
        'empty.file': '',
        'nested-dir': {}
      },
      'empty-dir': {},

    }, "a/new/root");

    expect(isDir('a/new/root')).toBe(true);
    expect(isFile('a/new/root/new.file')).toBe(true);
    expect(isDir('a/new/root/some-dir')).toBe(true);
    expect(isEmptyFile('a/new/root/some-dir/empty.file')).toBe(true);
    expect(isDir('a/new/root/some-dir/nested-dir')).toBe(true);
    expect(childrenOf('a/new/root/some-dir/nested-dir')).toEqual([]);
    expect(childrenOf('a/new/root/empty-dir')).toEqual([]);

  });

  it("can specify path at top level", () => {
    directree({
      'some/path/to/dir': {'file': 'content'},
      'some/path/to/file': 'text'
    });

    expect(isDir('some/path/to/dir')).toBe(true);
    expect(isFile('some/path/to/dir/file')).toBe(true);
    expect(contentsOf('some/path/to/dir/file')).toBe('content');
    expect(isFile('some/path/to/file')).toBe(true);
    expect(contentsOf('some/path/to/file')).toBe('text');
  });

});

describe("merging directree on existing tree", () => {

  beforeEach(() => {
    directree({
      'root': {
        'existing.file': 'overwritten content',
        'new.file': 'new content',
        'some-dir': {},
        'other-dir': {
          'more.file': "",
        }
      }
    });
  });

  it("should not overwrite existing file", () => {
    expect(contentsOf('root/existing.file')).toEqual('original content');
  });

  it("should write only new files", () => {
    expect(isFile('root/new.file')).toBe(true);
    expect(isFile('root/existing.file')).toBe(true);
    expect(contentsOf('root/new.file')).toEqual('new content');
  });

});

describe("merge with overwrite flag", () => {

  it("should overwrite existing file", () => {
    directree({
      'root': {
        'existing.file': 'overwritten content',
      }
    }, {overwrite: true});

    expect(contentsOf('root/existing.file')).toEqual('overwritten content');
  });

})

describe("bug fixes", () => {

  it("rejects tree entries that resolve outside root (path traversal / zip-slip)", () => {
    expect(() => directree({ '../escaped.txt': 'nope' }, 'sandbox')).toThrow(/outside root/);
    expect(fs.existsSync('escaped.txt')).toBe(false);
  });

  it("treats a null value as an empty file instead of crashing", () => {
    directree({ 'empty.txt': null }, 'out');
    expect(isFile('out/empty.txt')).toBe(true);
    expect(isEmptyFile('out/empty.txt')).toBe(true);
  });

  it("rejects arrays as tree nodes instead of silently creating index-named dirs", () => {
    expect(() => directree({ 'arr': ['x', 'y'] }, 'out')).toThrow(/array/i);
  });

  it("refuses to write through a symlink instead of following it to its target", () => {
    fs.mkdirSync('out', { recursive: true });
    const outsideTarget = path.join(tmpDir, 'outside-target.txt');
    fs.symlinkSync(outsideTarget, 'out/link'); // dangling symlink pointing outside 'out'

    expect(() => directree({ 'link': 'via symlink' }, 'out')).toThrow(/symlink/i);
    expect(fs.existsSync(outsideTarget)).toBe(false);
  });

  it("throws a clear error on file/dir collision instead of a raw EEXIST", () => {
    fs.mkdirSync('out', { recursive: true });
    fs.writeFileSync('out/collide', 'i am a file');

    expect(() => directree({ 'collide': { 'x': 'y' } }, 'out')).toThrow(/file already exists/);
  });

  it("treats opts=null the same as no opts instead of crashing", () => {
    // @ts-expect-error - exercising a caller passing null at runtime
    directree({ 'x.txt': 'y' }, null);
    expect(contentsOf('x.txt')).toEqual('y');
  });

  it("supports deep nesting when opts is passed as a plain string root", () => {
    // regression for the old `{...opts}` spread, which spread a string
    // root into character-indexed keys instead of treating it as a root
    directree({ 'a': { 'b': { 'c': { 'd.txt': 'deep' } } } }, 'out');
    expect(contentsOf('out/a/b/c/d.txt')).toEqual('deep');
  });

});

describe("write plan return value", () => {

  it("reports created files and dirs, relative to cwd", () => {
    const plan = directree({
      'new.file': 'content',
      'some-dir': { 'nested.file': 'x' },
    }, 'out');

    expect(plan.created.sort()).toEqual([
      path.join('out', 'new.file'),
      path.join('out', 'some-dir', 'nested.file'),
    ].sort());
    expect(plan.dirs.sort()).toEqual([
      'out',
      path.join('out', 'some-dir'),
    ].sort());
    expect(plan.skipped).toEqual([]);
  });

  it("reports pre-existing, non-overwritten files as skipped rather than created", () => {
    const plan = directree({
      'root': { 'existing.file': 'new content' },
    });

    expect(plan.skipped).toEqual([path.join('root', 'existing.file')]);
    expect(plan.created).toEqual([]);
    expect(contentsOf('root/existing.file')).toEqual('original content'); // unchanged
  });

  it("reports overwritten files as created, not skipped", () => {
    const plan = directree({
      'root': { 'existing.file': 'new content' },
    }, { overwrite: true });

    expect(plan.created).toEqual([path.join('root', 'existing.file')]);
    expect(plan.skipped).toEqual([]);
  });

});

describe("dryRun option", () => {

  it("reports what would happen without touching disk", () => {
    const plan = directree({
      'new.file': 'content',
      'some-dir': { 'nested.file': 'x' },
    }, { root: 'out', dryRun: true });

    expect(plan.created.sort()).toEqual([
      path.join('out', 'new.file'),
      path.join('out', 'some-dir', 'nested.file'),
    ].sort());

    expect(fs.existsSync('out')).toBe(false);
  });

  it("still throws on a real collision even without writing", () => {
    fs.mkdirSync('out', { recursive: true });
    fs.writeFileSync('out/collide', 'i am a file');

    expect(() => directree({ 'collide': { 'x': 'y' } }, { root: 'out', dryRun: true })).toThrow(/file already exists/);
  });

});

describe("read()", () => {

  it("reads a directory back into a Tree object", () => {
    fs.mkdirSync('out/dir', { recursive: true });
    fs.writeFileSync('out/a.txt', 'A');
    fs.writeFileSync('out/dir/b.txt', 'B');

    expect(read('out')).toEqual({
      'a.txt': 'A',
      'dir': { 'b.txt': 'B' },
    });
  });

});

describe("round trip: write then read", () => {

  it("a simple flat tree matches after write then read", () => {
    const tree = { 'a.txt': 'A', 'b.txt': 'B', 'c.txt': 'C' };
    directree(tree, 'out');

    expect(read('out')).toEqual(tree);
  });

  it("nested directories, including an empty one, match after write then read", () => {
    const tree = {
      'a.txt': 'A',
      'dir': {
        'b.txt': 'B',
        'nested': {
          'c.txt': 'C',
        },
        'empty-dir': {},
      },
    };
    directree(tree, 'out');

    expect(read('out')).toEqual(tree);
  });

  it("an empty file (empty string or null) round-trips as an empty string", () => {
    directree({ 'empty.txt': '', 'also-empty.txt': null }, 'out');

    expect(read('out')).toEqual({ 'empty.txt': '', 'also-empty.txt': '' });
  });

  it("content with unicode, newlines, and quotes round-trips byte-for-byte", () => {
    const tricky = 'line one\nline "two" with \'quotes\'\ncafé 日本語 🎉\n';
    directree({ 'tricky.txt': tricky }, 'out');

    expect(read('out')).toEqual({ 'tricky.txt': tricky });
  });

  it("content written via template tags (dedented/serialized) matches the tag's own output", () => {
    const tree = {
      'index.html': html`
        <!doctype html>
        <h1>Hi</h1>
      `,
      'config.json': json({ name: 'x', nested: { a: 1 } }),
    };
    directree(tree, 'out');

    expect(read('out')).toEqual(tree);
  });

});

describe("read() safety limits (deliberately tiny defaults)", () => {

  it("the default maxFiles (15) throws on a directory past it; an explicit override still works", () => {
    const tree: Record<string, string> = {};
    for (let i = 0; i < 20; i++) tree[`file${i}.txt`] = 'x';
    directree(tree, 'out');

    expect(() => read('out')).toThrow(/more than 15 files/);
    expect(read('out', { maxFiles: 20 })).toBeTruthy();
  });

  it("the default maxSize (10KB) throws on content past it; an explicit override still works", () => {
    directree({ 'big.txt': 'x'.repeat(20_000) }, 'out');

    expect(() => read('out')).toThrow(/exceeds 10240 bytes/);
    expect(read('out', { maxSize: 100_000 })).toBeTruthy();
  });

  it("the default maxDepth (3) throws on nesting past it; an explicit override still works", () => {
    directree({ a: { b: { c: { d: { e: 'deep' } } } } }, 'out');

    expect(() => read('out')).toThrow(/more than 3 levels deep/);
    expect(read('out', { maxDepth: 10 })).toBeTruthy();
  });

  it("ignore excludes a subtree from both the result and the limit check", () => {
    const heavy: Record<string, string> = {};
    for (let i = 0; i < 20; i++) heavy[`file${i}.txt`] = 'x';
    directree({ 'keep.txt': 'kept', 'node_modules': heavy }, 'out');

    // no maxFiles override - the default (15) would trip on node_modules'
    // 20 files if ignore didn't fully exclude that subtree
    const result = read('out', {
      ignore: (name) => name === 'node_modules',
    });

    expect(result).toEqual({ 'keep.txt': 'kept' });
  });

  it("excludes binary files from the result instead of inlining garbled content", () => {
    directree({ 'readme.txt': 'text content' }, 'out');
    fs.writeFileSync('out/photo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]));

    expect(read('out')).toEqual({ 'readme.txt': 'text content' });
  });

  it("a binary file doesn't count toward maxFiles or maxSize", () => {
    fs.mkdirSync('out2', { recursive: true });
    // a NUL byte plus 20,000 bytes of content - would trip the default
    // maxSize (10KB) on its own if it counted
    fs.writeFileSync('out2/big.bin', Buffer.concat([Buffer.from([0x00]), Buffer.alloc(20_000, 'x')]));
    fs.writeFileSync('out2/small.txt', 'kept');

    expect(read('out2')).toEqual({ 'small.txt': 'kept' });
  });

});
