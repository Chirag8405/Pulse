import { config as loadEnv } from "dotenv";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });
loadEnv();

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local");
}

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();

async function seedDemoData(): Promise<void> {
  const nowMs = Date.now();
  const now = Timestamp.fromMillis(nowMs);
  const thirtyMinutesAgo = Timestamp.fromMillis(nowMs - 30 * 60 * 1000);
  const twoMinutesAgo = Timestamp.fromMillis(nowMs - 2 * 60 * 1000);
  const eightMinutesFromNow = Timestamp.fromMillis(nowMs + 8 * 60 * 1000);

  const eventId = "demo-event-001";
  const challengeId = "demo-challenge-001";

  const teamDocs = [
    {
      id: "team-north-wolves",
      name: "North Stand Wolves",
      emoji: "🐺",
      colorHex: "#2563EB",
      sectionIds: ["A", "B", "C"],
      totalChallengesWon: 3,
    },
    {
      id: "team-south-lions",
      name: "South Stand Lions",
      emoji: "🦁",
      colorHex: "#DC2626",
      sectionIds: ["D", "E", "F"],
      totalChallengesWon: 2,
    },
    {
      id: "team-east-eagles",
      name: "East Stand Eagles",
      emoji: "🦅",
      colorHex: "#059669",
      sectionIds: ["G", "H", "I"],
      totalChallengesWon: 4,
    },
    {
      id: "team-west-rhinos",
      name: "West Stand Rhinos",
      emoji: "🦏",
      colorHex: "#7C3AED",
      sectionIds: ["J", "K", "L"],
      totalChallengesWon: 1,
    },
    {
      id: "team-north-bears",
      name: "North Concourse Bears",
      emoji: "🐻",
      colorHex: "#D97706",
      sectionIds: ["M", "N", "O"],
      totalChallengesWon: 1,
    },
    {
      id: "team-south-tigers",
      name: "South Concourse Tigers",
      emoji: "🐯",
      colorHex: "#DB2777",
      sectionIds: ["P", "Q", "R"],
      totalChallengesWon: 1,
    },
    {
      id: "team-main-wolves",
      name: "Main Entry Wolves",
      emoji: "🐺",
      colorHex: "#0891B2",
      sectionIds: ["S", "T", "U"],
      totalChallengesWon: 1,
    },
    {
      id: "team-general",
      name: "General Stand Crew",
      emoji: "🏟️",
      colorHex: "#374151",
      sectionIds: ["V", "W", "X", "Y", "Z"],
      totalChallengesWon: 0,
    },
  ];

  const teamProgressDocs = [
    {
      teamId: "team-north-wolves",
      challengeId,
      spreadScore: 45,
      activeZones: ["zone-north", "zone-east", "zone-concourse-n"],
      completedAt: null,
      isCompleted: false,
      memberCount: 23,
    },
    {
      teamId: "team-south-lions",
      challengeId,
      spreadScore: 72,
      activeZones: [
        "zone-south",
        "zone-west",
        "zone-concourse-s",
        "zone-entry-main",
        "zone-entry-sec",
      ],
      completedAt: null,
      isCompleted: false,
      memberCount: 31,
    },
    {
      teamId: "team-east-eagles",
      challengeId,
      spreadScore: 80,
      activeZones: [
        "zone-east",
        "zone-north",
        "zone-west",
        "zone-concourse-n",
        "zone-entry-main",
      ],
      completedAt: now,
      isCompleted: true,
      memberCount: 28,
    },
    {
      teamId: "team-west-rhinos",
      challengeId,
      spreadScore: 31,
      activeZones: ["zone-west", "zone-entry-sec"],
      completedAt: null,
      isCompleted: false,
      memberCount: 17,
    },
  ];

  const northMemberLocations = [
    { userId: "demo-user-001", zoneId: "zone-north" },
    { userId: "demo-user-002", zoneId: "zone-east" },
    { userId: "demo-user-003", zoneId: "zone-concourse-n" },
    { userId: "demo-user-004", zoneId: "zone-west" },
    { userId: "demo-user-005", zoneId: "zone-entry-main" },
    { userId: "demo-user-006", zoneId: "zone-concourse-s" },
  ];

  const batch = db.batch();

  batch.set(db.doc(`events/${eventId}`), {
    id: eventId,
    venueName: "Wankhede Stadium",
    venueCity: "Mumbai",
    homeTeam: "Mumbai Indians",
    awayTeam: "Chennai Super Kings",
    startTime: thirtyMinutesAgo,
    status: "live",
    currentChallengeId: null,
    matchDay: "IPL 2025 - Match 28",
  });

  batch.set(db.doc(`challenges/${challengeId}`), {
    id: challengeId,
    eventId,
    title: "Halftime Spread Challenge",
    description: "Spread your team across 4 zones before the break ends!",
    targetSpreadPercentage: 75,
    targetZoneCount: 4,
    durationMinutes: 10,
    startTime: twoMinutesAgo,
    endTime: eightMinutesFromNow,
    status: "active",
    reward: {
      type: "Early Entry",
      description: "Get priority entry gates for the next home match",
      unlockedAt: null,
    },
    participatingTeamIds: [
      "team-north-wolves",
      "team-south-lions",
      "team-east-eagles",
      "team-west-rhinos",
    ],
  });

  for (const team of teamDocs) {
    batch.set(db.doc(`teams/${team.id}`), {
      id: team.id,
      name: team.name,
      emoji: team.emoji,
      colorHex: team.colorHex,
      venueId: "wankhede",
      eventId,
      memberIds: [],
      currentSpreadScore: 0,
      lastCalculatedAt: now,
      totalChallengesWon: team.totalChallengesWon,
      sectionIds: team.sectionIds,
    });
  }

  for (const progress of teamProgressDocs) {
    batch.set(
      db.doc(`challenges/${challengeId}/teamProgress/${progress.teamId}`),
      progress
    );
  }

  for (const location of northMemberLocations) {
    batch.set(
      db.doc(`teams/team-north-wolves/memberLocations/${location.userId}`),
      {
        userId: location.userId,
        teamId: "team-north-wolves",
        zoneId: location.zoneId,
        timestamp: now,
        isActive: true,
      }
    );
  }

  await batch.commit();

  console.log("✅ Demo data seeded successfully");
}

void seedDemoData().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown seed error";
  console.error(`Failed to seed demo data: ${message}`);
  process.exitCode = 1;
});
