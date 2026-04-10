import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface Coordinates {
  lat: number
  lng: number
}

export function haversineDistance(
  from: Coordinates,
  to: Coordinates
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const earthRadiusMeters = 6371_000

  const deltaLat = toRadians(to.lat - from.lat)
  const deltaLng = toRadians(to.lng - from.lng)

  const fromLatRad = toRadians(from.lat)
  const toLatRad = toRadians(to.lat)

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLatRad) * Math.cos(toLatRad) * Math.sin(deltaLng / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusMeters * c
}
