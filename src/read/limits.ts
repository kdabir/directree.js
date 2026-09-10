import fs from 'fs'
import { join } from 'path'
import { DirtreeError } from '../utils.js'
import { isBinaryFile } from './binary.js'

export type ReadOptions = {
  // Called for every entry before it's read or recursed into; return true
  // to exclude it (and, for a directory, everything under it) entirely.
  ignore?: (name: string, path: string, isDirectory: boolean) => boolean
  maxDepth?: number // default 3
  maxFiles?: number // default 15
  maxSize?: number // default 10,240 (10 KB), total bytes across all files
}

export type ReadLimits = Required<ReadOptions>

// Deliberately tiny: read() is for scaffold/test-fixture-sized directories,
// not general-purpose directory walking. Anything bigger has to opt in
// explicitly, rather than the defaults being generous enough to make it
// easy to accidentally point read() at something huge.
export const defaultReadLimits: ReadLimits = {
  ignore: () => false,
  maxDepth: 3,
  maxFiles: 15,
  maxSize: 10240,
}

// Walks metadata only (readdir + stat, no file content) to confirm the
// tree read() is about to build stays within limits, so pointing read()
// at something huge or deeply nested (node_modules, say) fails fast with
// a clear message instead of read() hanging or exhausting memory reading
// every file in it. Binary files (see binary.ts) don't count toward the
// limits at all, since they're excluded from the result either way.
export const assertWithinReadLimits = (dir: string, limits: ReadLimits): void => {
  let filesSeen = 0
  let bytesSeen = 0

  const walk = (current: string, depth: number): void => {
    if (depth > limits.maxDepth) {
      throw new DirtreeError(
        `directree: read() aborted - "${current}" is more than ${limits.maxDepth} levels deep under "${dir}". Pass a higher maxDepth if this is intentional.`,
      )
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = join(current, entry.name)
      if (limits.ignore(entry.name, entryPath, entry.isDirectory())) continue

      if (entry.isDirectory()) {
        walk(entryPath, depth + 1)
      } else if (entry.isFile() && !isBinaryFile(entryPath)) {
        filesSeen++
        if (filesSeen > limits.maxFiles) {
          throw new DirtreeError(
            `directree: read() aborted after finding more than ${limits.maxFiles} files under "${dir}". Pass a higher maxFiles or an ignore option if this is intentional.`,
          )
        }

        bytesSeen += fs.statSync(entryPath).size
        if (bytesSeen > limits.maxSize) {
          throw new DirtreeError(
            `directree: read() aborted - total file content under "${dir}" exceeds ${limits.maxSize} bytes. Pass a higher maxSize or an ignore option if this is intentional.`,
          )
        }
      }
    }
  }

  walk(dir, 0)
}
