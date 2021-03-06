const directree = require("../index");

const mockfs = require('mock-fs');
const fs = require('fs');

const isFile = (path) => fs.lstatSync(path).isFile();
const isEmptyFile = (file) => fs.readFileSync(file, 'utf8').length === 0;
const contentsOf = (file) => fs.readFileSync(file, 'utf8');
const isDir = (path) => fs.lstatSync(path).isDirectory();
const childrenOf = (dir) => fs.readdirSync(dir);


beforeEach(() => {
  mockfs({
    'root': {
      'existing.file': 'original content',
      'some-dir': {}
    },
    'a/new/root': {}
  });
});

afterEach(mockfs.restore); // func reference

it('mock should setup dir structure', () => {
  expect(isDir('root')).toBe(true)
  expect(isDir('a/new/root')).toBe(true)
  expect(contentsOf('root/existing.file')).toEqual('original content')
  expect(childrenOf('root')).toEqual(['existing.file', 'some-dir'])
  expect(childrenOf('root/some-dir')).toEqual([])

});


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
