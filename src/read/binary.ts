import fs from 'fs'

// A file is treated as binary if a NUL byte appears in its first 8000
// bytes - the same heuristic git uses to decide whether to diff a file
// as text. Binary content decoded as utf8 would just be garbage inlined
// into the Tree, so these files are excluded entirely rather than read.
const SNIFF_BYTES = 8000

export const isBinaryFile = (path: string): boolean => {
  const fd = fs.openSync(path, 'r')
  try {
    const buffer = Buffer.alloc(SNIFF_BYTES)
    const bytesRead = fs.readSync(fd, buffer, 0, SNIFF_BYTES, 0)
    return buffer.subarray(0, bytesRead).includes(0)
  } finally {
    fs.closeSync(fd)
  }
}
