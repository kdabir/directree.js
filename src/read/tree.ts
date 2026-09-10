import fs from 'fs'
import { join } from 'path'
import type { Tree } from '../types.js'
import { isBinaryFile } from './binary.js'
import type { ReadLimits } from './limits.js'

// Symlinks, binary files, and other non-plain-file/non-directory entries
// (sockets, fifos, ...) are skipped - Tree only models plain text files
// and directories.
const shouldInclude = (entry: fs.Dirent, dir: string, ignore: ReadLimits['ignore']): boolean => {
  if (!entry.isDirectory() && !entry.isFile()) return false

  const entryPath = join(dir, entry.name)
  if (ignore(entry.name, entryPath, entry.isDirectory())) return false
  if (entry.isFile() && isBinaryFile(entryPath)) return false

  return true
}

export const readTree = (dir: string, ignore: ReadLimits['ignore']): Tree => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  return Object.fromEntries(
    entries
      .filter((entry) => shouldInclude(entry, dir, ignore))
      .map((entry): [string, string | Tree] => {
        const entryPath = join(dir, entry.name)
        return [
          entry.name,
          entry.isDirectory() ? readTree(entryPath, ignore) : fs.readFileSync(entryPath, 'utf8'),
        ]
      }),
  )
}
