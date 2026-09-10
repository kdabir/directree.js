import fs from 'fs'
import { dirname, join, relative, resolve, sep } from 'path'
import type { Tree } from './types.js'
import { DirtreeError, lstatOrNull } from './utils.js'

export type Options = {
  root?: string
  overwrite?: boolean
  dryRun?: boolean
}

export type WritePlan = {
  created: string[]
  skipped: string[]
  dirs: string[]
}

const normalizeOpts = (opts?: Options | string): Required<Options> => {
  if (typeof opts === 'string') return { root: opts, overwrite: false, dryRun: false }
  if (opts && typeof opts === 'object') {
    return { root: opts.root ?? '.', overwrite: opts.overwrite ?? false, dryRun: opts.dryRun ?? false }
  }
  return { root: '.', overwrite: false, dryRun: false }
}

// Rejects any resolved path that would land outside the boundary (the
// original call's root) - guards against '../' in tree keys (zip-slip).
const assertWithinBoundary = (path: string, boundary: string): void => {
  const rel = relative(boundary, path)
  if (rel === '..' || rel.startsWith(`..${sep}`)) {
    throw new DirtreeError(`directree: "${path}" resolves outside root "${boundary}"`)
  }
}

const rejectArrays = (value: unknown, at: string): void => {
  if (Array.isArray(value)) {
    throw new DirtreeError(`directree: arrays are not supported as tree nodes (at "${at}")`)
  }
}

const emptyPlan: WritePlan = { created: [], skipped: [], dirs: [] }

const mergePlans = (a: WritePlan, b: WritePlan): WritePlan => ({
  created: [...a.created, ...b.created],
  skipped: [...a.skipped, ...b.skipped],
  dirs: [...a.dirs, ...b.dirs],
})

// A WritePlan with exactly one entry in one bucket - the shape every
// terminal step (a file created, a file skipped, a directory touched)
// produces before entryPlans get folded together by mergePlans.
const planWith = (bucket: keyof WritePlan, path: string): WritePlan => ({
  ...emptyPlan,
  [bucket]: [path],
})

// overwrite, dryRun, and relOf never change across a recursive write() -
// they, plus the write boundary, are a single unit of "how/where this
// call is allowed to write", not four independent parameters.
type WriteContext = {
  boundary: string
  overwrite: boolean
  dryRun: boolean
  relOf: (p: string) => string
}

const writeFile = (path: string, content: string, ctx: WriteContext): WritePlan => {
  // lstat (not stat/existsSync) so a symlink is detected as-is rather than
  // resolved through - existsSync on a dangling symlink returns false and
  // would let writeFileSync silently create the file at the link's target.
  const existing = lstatOrNull(path)

  if (existing?.isSymbolicLink()) {
    throw new DirtreeError(`directree: refusing to write through a symlink at "${path}"`)
  }
  if (existing?.isDirectory()) {
    throw new DirtreeError(`directree: cannot create file "${path}" - a directory already exists there`)
  }
  if (existing && !ctx.overwrite) {
    return planWith('skipped', ctx.relOf(path))
  }

  if (!ctx.dryRun) {
    fs.mkdirSync(dirname(path), { recursive: true }) // for non-existent paths as keys, e.g. 'some/path/to/file'; a no-op if `existing`
    fs.writeFileSync(path, content, existing ? undefined : { flag: 'wx' })
  }
  return planWith('created', ctx.relOf(path))
}

// Validates root can become a directory - not blocked by a file already
// there, not resolving outside the write boundary.
const assertCanBeDir = (root: string, boundary: string): void => {
  assertWithinBoundary(root, boundary)
  const existing = lstatOrNull(root)
  if (existing && !existing.isDirectory()) {
    throw new DirtreeError(`directree: cannot create directory "${root}" - a file already exists at that path`)
  }
}

// One tree entry: a string/null value writes a file, an object value
// recurses as a subdirectory, anything else (number, boolean, ...) is
// silently skipped.
const writeEntry = (path: string, value: Tree[string], ctx: WriteContext): WritePlan => {
  assertWithinBoundary(path, ctx.boundary)
  rejectArrays(value, path)

  if (value === null || typeof value === 'string') {
    return writeFile(path, value ?? '', ctx)
  }
  if (typeof value === 'object') {
    return write(value, path, ctx)
  }
  return emptyPlan
}

const write = (tree: Tree, root: string, ctx: WriteContext): WritePlan => {
  assertCanBeDir(root, ctx.boundary)
  if (!ctx.dryRun) fs.mkdirSync(root, { recursive: true })

  const rootPlan = planWith('dirs', ctx.relOf(root))

  if (tree === null || typeof tree !== 'object') return rootPlan
  rejectArrays(tree, root)

  const entryPlans = Object.entries(tree).map(([name, value]) =>
    writeEntry(resolve(join(root, name)), value, ctx),
  )

  return entryPlans.reduce(mergePlans, rootPlan)
}

export default function directree(tree: Tree, opts?: Options | string): WritePlan {
  const { root, overwrite, dryRun } = normalizeOpts(opts)
  const resolvedRoot = resolve(root)
  const cwd = process.cwd()

  const ctx: WriteContext = {
    boundary: resolvedRoot,
    overwrite,
    dryRun,
    relOf: (p: string) => relative(cwd, p) || '.',
  }

  return write(tree, resolvedRoot, ctx)
}
