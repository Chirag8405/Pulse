"use client";

import type { User as FirebaseUser } from "firebase/auth";
import type { Event } from "@/types/firebase";

interface AdminApiErrorPayload {
  error?: string;
  requestId?: string;
}

export interface CreateAdminEventPayload {
  homeTeam: string;
  awayTeam: string;
  startTimeIso: string;
  matchDay: string;
}

export interface UpdateAdminEventStatusPayload {
  eventId: string;
  status: Event["status"];
}

export interface CreateAdminChallengePayload {
  eventId: string;
  title: string;
  description: string;
  targetSpreadPercentage: number;
  targetZoneCount: number;
  durationMinutes: number;
  rewardType: string;
  rewardDescription: string;
}

export interface SetAdminChallengeLivePayload {
  challengeId: string;
  eventId: string;
  durationMinutes: number;
}

export interface CompleteAdminChallengePayload {
  challengeId: string;
}

async function callAdminApi<TResponse>(
  firebaseUser: FirebaseUser,
  path: string,
  method: "POST" | "PATCH",
  payload: unknown
): Promise<TResponse> {
  const token = await firebaseUser.getIdToken(true);

  const response = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const responseBody = (await response.json().catch(() => null)) as
    | (TResponse & AdminApiErrorPayload)
    | null;

  if (!response.ok) {
    const errorMessage = responseBody?.error ?? "Request failed";
    const reference = responseBody?.requestId
      ? ` (reference: ${responseBody.requestId})`
      : "";

    throw new Error(`${errorMessage}${reference}`);
  }

  return (responseBody ?? ({} as TResponse)) as TResponse;
}

export async function createAdminEvent(
  firebaseUser: FirebaseUser,
  payload: CreateAdminEventPayload
): Promise<{ id: string }> {
  return callAdminApi<{ id: string }>(
    firebaseUser,
    "/api/admin/events",
    "POST",
    payload
  );
}

export async function updateAdminEventStatus(
  firebaseUser: FirebaseUser,
  payload: UpdateAdminEventStatusPayload
): Promise<{ success: true }> {
  return callAdminApi<{ success: true }>(
    firebaseUser,
    "/api/admin/events",
    "PATCH",
    payload
  );
}

export async function createAdminChallenge(
  firebaseUser: FirebaseUser,
  payload: CreateAdminChallengePayload
): Promise<{ id: string }> {
  return callAdminApi<{ id: string }>(
    firebaseUser,
    "/api/admin/challenges",
    "POST",
    payload
  );
}

export async function setAdminChallengeLive(
  firebaseUser: FirebaseUser,
  payload: SetAdminChallengeLivePayload
): Promise<{ success: true }> {
  return callAdminApi<{ success: true }>(
    firebaseUser,
    "/api/admin/challenges",
    "PATCH",
    {
      action: "setLive",
      ...payload,
    }
  );
}

export async function completeAdminChallenge(
  firebaseUser: FirebaseUser,
  payload: CompleteAdminChallengePayload
): Promise<{ success: true }> {
  return callAdminApi<{ success: true }>(
    firebaseUser,
    "/api/admin/challenges",
    "PATCH",
    {
      action: "complete",
      ...payload,
    }
  );
}
