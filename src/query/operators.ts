import Fuse from 'fuse.js'
import { isPointWithinRadius, getDistance } from 'geolib'

export function opEq(fieldValue: unknown, queryValue: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return String(fieldValue) === queryValue || (fieldValue as any) == queryValue
}

export function opNe(fieldValue: unknown, queryValue: string): boolean {
  return !opEq(fieldValue, queryValue)
}

export function opLt(fieldValue: unknown, queryValue: string): boolean {
  const a = Number(fieldValue)
  const b = Number(queryValue)
  if (!isNaN(a) && !isNaN(b)) return a < b
  // date comparison
  return String(fieldValue) < queryValue
}

export function opLte(fieldValue: unknown, queryValue: string): boolean {
  const a = Number(fieldValue)
  const b = Number(queryValue)
  if (!isNaN(a) && !isNaN(b)) return a <= b
  return String(fieldValue) <= queryValue
}

export function opGt(fieldValue: unknown, queryValue: string): boolean {
  const a = Number(fieldValue)
  const b = Number(queryValue)
  if (!isNaN(a) && !isNaN(b)) return a > b
  return String(fieldValue) > queryValue
}

export function opGte(fieldValue: unknown, queryValue: string): boolean {
  const a = Number(fieldValue)
  const b = Number(queryValue)
  if (!isNaN(a) && !isNaN(b)) return a >= b
  return String(fieldValue) >= queryValue
}

export function opExists(fieldValue: unknown, queryValue: string): boolean {
  const exists = fieldValue !== undefined && fieldValue !== null
  return queryValue === 'true' ? exists : !exists
}

export function opIn(fieldValue: unknown, queryValue: string): boolean {
  const values = queryValue.split(',')
  if (Array.isArray(fieldValue)) {
    return fieldValue.some((v) => values.includes(String(v)))
  }
  return values.includes(String(fieldValue))
}

export function opNin(fieldValue: unknown, queryValue: string): boolean {
  return !opIn(fieldValue, queryValue)
}

export function opMatch(fieldValue: unknown, queryValue: string): boolean {
  if (fieldValue === undefined || fieldValue === null) return false
  const text = String(fieldValue)
  const fuse = new Fuse([{ text }], {
    keys: ['text'],
    threshold: 0.4,
    includeScore: true,
  })
  const results = fuse.search(queryValue)
  return results.length > 0
}

interface GeoPoint {
  lat: number
  lon: number
}

function parseGeoPoint(value: unknown): GeoPoint | null {
  if (typeof value === 'object' && value !== null) {
    const v = value as Record<string, unknown>
    if (typeof v['lat'] === 'number' && typeof v['lon'] === 'number') {
      return { lat: v['lat'] as number, lon: v['lon'] as number }
    }
  }
  return null
}

// queryValue: "lat,lon,maxDistanceKm"
export function opNear(fieldValue: unknown, queryValue: string): boolean {
  const point = parseGeoPoint(fieldValue)
  if (!point) return false
  const parts = queryValue.split(',')
  if (parts.length < 3) return false
  const [lat, lon, maxDist] = parts.map(Number)
  if (isNaN(lat) || isNaN(lon) || isNaN(maxDist)) return false
  const distanceMeters = getDistance(
    { latitude: point.lat, longitude: point.lon },
    { latitude: lat, longitude: lon },
  )
  return distanceMeters <= maxDist * 1000
}

// queryValue: "lat1,lon1,lat2,lon2" (bounding box, top-left / bottom-right)
export function opWithin(fieldValue: unknown, queryValue: string): boolean {
  const point = parseGeoPoint(fieldValue)
  if (!point) return false
  const parts = queryValue.split(',')
  if (parts.length !== 4) return false
  const [lat1, lon1, lat2, lon2] = parts.map(Number)
  if ([lat1, lon1, lat2, lon2].some(isNaN)) return false
  const minLat = Math.min(lat1, lat2)
  const maxLat = Math.max(lat1, lat2)
  const minLon = Math.min(lon1, lon2)
  const maxLon = Math.max(lon1, lon2)
  return point.lat >= minLat && point.lat <= maxLat && point.lon >= minLon && point.lon <= maxLon
}

// uses geolib isPointWithinRadius as cross-check – same logic re-exported for tests
export { isPointWithinRadius }
