import { Timestamp } from "firebase/firestore";

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  teamId: string | null;
  venueId: string;
  joinedAt: Timestamp;
  totalPoints: number;
  totalChallengesCompleted: number;
  isAdmin: boolean;
}

export interface Team {
  id: string;
  name: string;
  colorHex: string;
  emoji: string;
  venueId: string;
  eventId: string;
  memberIds: string[];
  currentSpreadScore: number;
  lastCalculatedAt: Timestamp;
  totalChallengesWon: number;
  sectionIds: string[];
}

export interface Event {
  id: string;
  title?: string;
  venueName: string;
  venueCity: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Timestamp;
  status: "upcoming" | "live" | "halftime" | "completed";
  currentChallengeId: string | null;
  matchDay: string;
}

export interface Challenge {
  id: string;
  eventId: string;
  title: string;
  description: string;
  targetSpreadPercentage: number;
  targetZoneCount: number;
  durationMinutes: number;
  startTime: Timestamp;
  endTime: Timestamp;
  status: "pending" | "active" | "completed";
  reward: {
    type: string;
    description: string;
    unlockedAt: Timestamp | null;
  };
  participatingTeamIds: string[];
}

export interface MemberLocation {
  userId: string;
  teamId: string;
  zoneId: string;
  timestamp: Timestamp;
  isActive: boolean;
}

export interface ChallengeTeamProgress {
  teamId: string;
  challengeId: string;
  spreadScore: number;
  activeZones: string[];
  completedAt: Timestamp | null;
  isCompleted: boolean;
  memberCount: number;
}
