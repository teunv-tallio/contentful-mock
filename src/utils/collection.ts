export interface Collection<T> {
  sys: { type: 'Array' }
  total: number
  skip: number
  limit: number
  items: T[]
}

export function makeCollection<T>(
  items: T[],
  total: number,
  skip: number,
  limit: number,
): Collection<T> {
  return {
    sys: { type: 'Array' },
    total,
    skip,
    limit,
    items,
  }
}
