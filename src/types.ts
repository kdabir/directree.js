// Shared between the write side (directree) and the read side (read) -
// both build/consume this same shape.
export type Tree = { [name: string]: string | null | Tree }
