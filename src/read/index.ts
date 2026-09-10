import { resolve } from 'path'
import type { Tree } from '../types.js'
import { assertWithinReadLimits, defaultReadLimits } from './limits.js'
import type { ReadLimits, ReadOptions } from './limits.js'
import { readTree } from './tree.js'

export type { ReadOptions } from './limits.js'

// The inverse of directree(): reads a directory back into a Tree object.
// Guarded by maxDepth/maxFiles/maxSize (see limits.ts) against being
// pointed at something huge, like node_modules, by accident.
export function read(dir: string, opts?: ReadOptions): Tree {
  const limits: ReadLimits = { ...defaultReadLimits, ...opts }
  const resolvedDir = resolve(dir)

  assertWithinReadLimits(resolvedDir, limits)
  return readTree(resolvedDir, limits.ignore)
}
