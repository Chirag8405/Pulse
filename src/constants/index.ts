export const APP_NAME = "PULSE";
export const APP_TAGLINE = "The crowd is not a problem to manage.";
export const VENUE_NAME = "Wankhede Stadium";
export const VENUE_CITY = "Mumbai";
export const VENUE_COORDINATES = { lat: 18.9388, lng: 72.8252 };
export const MAX_TEAM_SIZE = 200;
export const CHALLENGE_DURATION_OPTIONS = [8, 10, 12, 15] as const; // minutes
export const MIN_SPREAD_PERCENTAGE = 75;
export const LOCATION_UPDATE_INTERVAL_MS = 30000;

export const ZONES = [
  {
    id: "zone-north",
    name: "North Stand",
    capacity: 8000,
    lat: 18.9392,
    lng: 72.8252,
    gate: "Gate 1-2",
  },
  {
    id: "zone-south",
    name: "South Stand",
    capacity: 8000,
    lat: 18.9384,
    lng: 72.8252,
    gate: "Gate 5-6",
  },
  {
    id: "zone-east",
    name: "East Stand",
    capacity: 6000,
    lat: 18.9388,
    lng: 72.8258,
    gate: "Gate 3",
  },
  {
    id: "zone-west",
    name: "West Stand (VIP)",
    capacity: 4000,
    lat: 18.9388,
    lng: 72.8246,
    gate: "Gate 7",
  },
  {
    id: "zone-concourse-n",
    name: "North Concourse",
    capacity: 3000,
    lat: 18.9394,
    lng: 72.8252,
    gate: "Level 2 North",
  },
  {
    id: "zone-concourse-s",
    name: "South Concourse",
    capacity: 3000,
    lat: 18.9382,
    lng: 72.8252,
    gate: "Level 2 South",
  },
  {
    id: "zone-entry-main",
    name: "Main Entry (Gate 1-4)",
    capacity: 5000,
    lat: 18.939,
    lng: 72.826,
    gate: "Gate 1-4",
  },
  {
    id: "zone-entry-sec",
    name: "Secondary Entry (Gate 5-8)",
    capacity: 5000,
    lat: 18.9386,
    lng: 72.8244,
    gate: "Gate 5-8",
  },
] as const;

export type ZoneId = (typeof ZONES)[number]["id"];

export const REWARD_TYPES = [
  "Early Entry",
  "Exclusive Zone Access",
  "Food Credit",
  "Meet & Greet Lottery",
  "Stadium Tour",
] as const;

export type RewardType = (typeof REWARD_TYPES)[number];
