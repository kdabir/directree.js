import fs from 'fs'

export class DirtreeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DirtreeError'
  }
}

export const lstatOrNull = (path: string): fs.Stats | null => {
  try {
    return fs.lstatSync(path)
  } catch {
    return null
  }
}
