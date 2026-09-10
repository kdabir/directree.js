# Contributing

## Local development

```
git clone https://github.com/kdabir/directree.js.git
cd directree.js
pnpm install
pnpm test    # vitest, runs against src/ directly - no build needed first
pnpm run build   # compiles src/ to dist/ via tsc
```

`packageManager` in `package.json` pins the exact pnpm version this repo
uses.

Source layout:

```
src/
  index.ts   # public barrel - re-exports everything below
  types.ts   # Tree - the one type shared between write and read
  utils.ts   # DirtreeError, lstatOrNull - cross-cutting fs helpers
  write.ts   # directree(): Options, WritePlan, the write/writeEntry/writeFile chain
  read/
    index.ts   # read(): ReadOptions, wires the pieces below together
    limits.ts  # ReadLimits, defaultReadLimits, assertWithinReadLimits
    binary.ts  # isBinaryFile
    tree.ts    # readTree - the actual recursive content-building walk
  tags.ts    # html/css/sql/... template tags, dedent, raw
```

`spec/*.spec.ts` import from `../src` (or `../src/index`) directly, not
`../dist` - Vitest transforms TS on the fly, so `pnpm test` doesn't
require a prior build. `example/simple.js` imports from `../dist/index.js`
instead, since it's meant to demonstrate the published package's actual
entry point - run `pnpm run build` before it.

## Releasing

Publishing happens via `.github/workflows/release.yaml`, triggered by
pushing a `v*.*.*` git tag, authenticated to npm via Trusted Publishing
(no stored token). `npm version` handles the local half - it bumps
`package.json`, commits, and creates the matching git tag in one step:

```
pnpm run release:major        # x.y.z -> (x+1).0.0
pnpm run release:minor        # x.y.z -> x.(y+1).0
pnpm run release:patch        # x.y.z -> x.y.(z+1)
pnpm run release:premajor     # x.y.z -> (x+1).0.0-beta.0, or -beta.N -> -beta.(N+1) if already prerelease
pnpm run release:preminor     # x.y.z -> x.(y+1).0-beta.0, or -beta.N -> -beta.(N+1) if already prerelease
```

There's deliberately no unqualified `release` alias - releasing always
means naming the bump level explicitly, so a stray keystroke or muscle
memory can't trigger a major (breaking-version) bump by mistake. No
`release:patch`-level prerelease either - a patch is too small to
warrant a beta cycle.

Each pushes the tag too (`git push --follow-tags`), which is what
actually triggers the workflow - the branch itself still needs to already
be on GitHub first. The workflow publishes prereleases under an npm
dist-tag matching the prerelease identifier (`1.0.0-beta.0` → the `beta`
tag) rather than `latest`, so `npm install directree.js` keeps resolving
to the last stable release. To promote a prerelease line to stable, run
`release:major` (or `:minor`, matching the line) - semver defines
`1.0.0-beta.N < 1.0.0`, so bumping major from `1.0.0-beta.3` correctly
lands on `1.0.0` itself rather than jumping to `2.0.0`.

**Gotcha**: `release:premajor`/`release:preminor` check only "is a
prerelease currently active," not which level it's for - so they're safe
to run repeatedly for the *same* line (each call just increments the
beta counter, `-beta.0` → `-beta.1` → ...), but running the other one
while a line is active doesn't switch lines. `release:preminor` called
while a major prerelease is in flight will just keep incrementing the
major line, silently, since only one prerelease can be active at a time
(the single `version` field in `package.json`). Finish or abandon one
line before starting another.

**If a release goes bad**, roughly in order of how drastic:
1. **Point `latest` back at the last good version**: `npm dist-tag add
   directree.js@<last-good-version> latest`. Immediate, fully reversible,
   doesn't touch the bad version at all - just stops new `npm install
   directree.js` calls from resolving to it.
2. **Mark it clearly bad**: `npm deprecate directree.js@<bad-version>
   "<why, and what to use instead>"` - anyone who does end up resolving
   to it (e.g. via an existing lockfile) sees a warning.
3. **Ship the real fix** as a new version and publish normally - npm
   versions are immutable, so there's no "undo," only "supersede."
4. **`npm unpublish`, only as a last resort** (leaked secrets, actively
   broken/malicious content) - npm only allows it within 72 hours of
   publishing, it can break other projects' builds if anyone already
   depends on that exact version, and it's a manual `npm` CLI action, not
   something in `release.yaml` - deliberately not automated.
