function normalizeWithOffsets(value) {
  let normalized = ''
  const starts = []
  const ends = []
  let sourceOffset = 0
  let previousWasSpace = true

  for (const originalChar of String(value || '')) {
    const start = sourceOffset
    sourceOffset += originalChar.length
    const folded = originalChar.normalize('NFKD').toLowerCase().replace(/đ/g, 'd')

    for (const char of folded) {
      if (/\p{M}/u.test(char)) continue
      const output = /\s/u.test(char) ? ' ' : char
      if (output === ' ' && previousWasSpace) continue

      normalized += output
      for (let index = 0; index < output.length; index += 1) {
        starts.push(start)
        ends.push(sourceOffset)
      }
      previousWasSpace = output === ' '
    }
  }

  if (normalized.endsWith(' ')) {
    normalized = normalized.slice(0, -1)
    starts.pop()
    ends.pop()
  }
  return { normalized, starts, ends }
}

function findUniqueOccurrence(text, query) {
  const index = text.indexOf(query)
  if (index < 0 || text.indexOf(query, index + 1) >= 0) return -1
  return index
}

function toOriginalRange(offsets, start, length) {
  const last = start + length - 1
  return {
    start: offsets.starts[start],
    end: offsets.ends[last],
  }
}

export function findQuoteRange(text, quote) {
  if (!text || !quote) return null

  const source = normalizeWithOffsets(text)
  const target = normalizeWithOffsets(quote).normalized
  if (!source.normalized || !target) return null

  const exactIndex = findUniqueOccurrence(source.normalized, target)
  if (exactIndex >= 0) return toOriginalRange(source, exactIndex, target.length)

  const minLength = 100
  const maxLength = Math.min(300, target.length - 1)
  for (let length = maxLength; length >= minLength; length -= 20) {
    const step = Math.max(20, Math.floor(length / 4))
    for (let start = 0; start + length <= target.length; start += step) {
      const excerpt = target.slice(start, start + length)
      const index = findUniqueOccurrence(source.normalized, excerpt)
      if (index >= 0) return toOriginalRange(source, index, length)
    }
  }

  return null
}
