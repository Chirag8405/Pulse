import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ZONES } from "@/constants"
import { TEAM_MAPPINGS } from "@/constants/teams"

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

export function getNearestZone(coords: Coordinates) {
  const nearestZone = ZONES.toSorted((left, right) => {
    const leftDistance = haversineDistance(coords, {
      lat: left.lat,
      lng: left.lng,
    })
    const rightDistance = haversineDistance(coords, {
      lat: right.lat,
      lng: right.lng,
    })

    return leftDistance - rightDistance
  })[0]

  return nearestZone ?? ZONES[0]
}

export function formatCountdown(totalSeconds: number): string {
  const clampedSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(clampedSeconds / 60)
    .toString()
  const seconds = (clampedSeconds % 60)
    .toString()
    .padStart(2, "0")

  return `${minutes}:${seconds}`
}

export function seatToTeam(seat: string) {
  const normalized = seat.trim().toUpperCase()

  if (normalized.length === 0) {
    throw new Error("Seat is required")
  }

  const section = normalized.split("-")[0] ?? ""

  if (!section) {
    return null
  }

  // Strict helper mapping for validation scenarios used by tests/admin tools.
  if (!/^[A-P]{1,2}$/.test(section)) {
    return null
  }

  return (
    TEAM_MAPPINGS.find((team) => team.sectionPattern.test(section)) ?? null
  )
}
