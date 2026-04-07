/**
 * drank — error message pools
 *
 * pickError(pool) returns a message from the pool, cycling through them in a
 * shuffled order so the same message is never shown twice in a row. Each pool
 * maintains its own cursor so errors stay varied across repeated submissions
 * and across different rankings in the same session.
 */

type ErrorPool = readonly string[]

// Per-pool state: shuffled order + current cursor
const poolState = new WeakMap<ErrorPool, { order: number[]; cursor: number }>()

function getShuffled(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i)
  // Fisher-Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function pickError(pool: ErrorPool): string {
  if (pool.length === 0) return ""
  if (pool.length === 1) return pool[0]

  let state = poolState.get(pool)
  if (!state) {
    state = { order: getShuffled(pool.length), cursor: 0 }
    poolState.set(pool, state)
  }

  const msg = pool[state.order[state.cursor]]
  state.cursor = (state.cursor + 1) % pool.length

  // Reshuffle when we've exhausted the deck, but avoid repeating the last message
  if (state.cursor === 0) {
    const lastIndex = state.order[pool.length - 1]
    state.order = getShuffled(pool.length)
    // Swap the first card away from the last-shown one
    if (state.order[0] === lastIndex && pool.length > 1) {
      const swapWith = Math.floor(Math.random() * (pool.length - 1)) + 1
      ;[state.order[0], state.order[swapWith]] = [state.order[swapWith], state.order[0]]
    }
  }

  return msg
}

// ─── Pools ────────────────────────────────────────────────────────────────────

export const ERRORS = {
  // Fallback for any required field without a specific pool
  generic: [
    "this one's required.",
    "can't leave this blank",
    "still waiting on this one",
    "don't ghost this field",
  ] as const,

  // Rank field
  rating: [
    "a score would be nice",
    "how'd it taste though?",
    "even a 0 is a rating",
  ] as const,

  // Rating out of 0–10 range
  ratingRange: [
    "0.0 to 10.0 only",
    "that's not on the scale",
    "the scale goes up to 10.0",
  ] as const,

  // Cafe / Spot
  cafeName: [
    "where'd you get this?",
    "the spot deserves a mention",
    "nameless drinks are suspicious",
  ] as const,

  // Beverage name
  drinkName: [
    "what were you drinking?",
    "she has a name",
    "the drink wants to be remembered",
  ] as const,

  // Date (required)
  date: ["when did this happen?"] as const,

  // Date in the future
  dateFuture: [
    "time travel ranking not supported",
    "that date hasn't happened",
  ] as const,

  // Time (required)
  time: [
    "what time was it?",
    "the hour matters",
  ] as const,

  // Upload — wrong file type
  fileType: [
    "needs to be an image file",
    "that's not a photo",
    "maybe screenshot it?",
  ] as const,

  // Upload — file too large
  fileSize: [
    "that file's too big",
    "try a smaller photo",
    "compress it a little",
    "maybe screenshot it?",
  ] as const,

  // Upload — generic read failure
  uploadFailed: [
    "something went wrong with the upload",
    "couldn't read that file",
    "try again?",
  ] as const,

  // Background removal failure
  bgRemovalFailed: [
    "couldn't isolate the drink",
    "background removal didn't work on this one",
    "try re-selecting the drink",
  ] as const,

  // Selection modal — confirmed with no box drawn
  noSelection: [
    "draw a box around the drink first",
    "select an area to continue",
  ] as const,
} satisfies Record<string, ErrorPool>