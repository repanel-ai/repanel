import { randomUUID } from "node:crypto";
import type { airlines, applications, candidates, jobOpenings, users } from "../db/schema";

type UserRow = typeof users.$inferInsert;
type AirlineRow = typeof airlines.$inferInsert;
type CandidateRow = typeof candidates.$inferInsert;
type OpeningRow = typeof jobOpenings.$inferInsert;
type ApplicationRow = typeof applications.$inferInsert;

/** Every row the seed writes, in the order the foreign keys require. */
export interface SeedRows {
  users: UserRow[];
  airlines: AirlineRow[];
  candidates: CandidateRow[];
  openings: OpeningRow[];
  applications: ApplicationRow[];
}

/**
 * A fixed-seed generator, so two people seeding SkyScout look at the same
 * admin. Randomness here is for texture — plausible spread across statuses and
 * dates — never for values anything depends on.
 */
function sequence(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
}

const STAFF = [
  "Amara Osei",
  "Ben Halvorsen",
  "Chiara Rossi",
  "Diego Marín",
  "Elin Dahl",
  "Farid Haddad",
  "Grace Mbeki",
  "Hannes Vogel",
  "Ines Duarte",
  "Jonas Lindqvist",
  "Kaori Tanaka",
  "Liam O'Connell",
  "Marta Nowak",
  "Nikhil Rao",
  "Olga Petrova",
  "Pieter de Vries",
  "Quinn Alvarez",
  "Rania Chakib",
  "Sofia Karlsson",
  "Tomás Ferreira",
];

const AIRLINES: readonly [string, string][] = [
  ["Northwind Air", "Ireland"],
  ["Cascade Regional", "Canada"],
  ["Aurora Nordic", "Norway"],
  ["Meridian Atlantic", "Portugal"],
  ["Sierra Cargo", "Spain"],
  ["Kestrel Airways", "United Kingdom"],
  ["Blue Delta", "Netherlands"],
  ["Solstice Air", "Iceland"],
  ["Pampas Connect", "Argentina"],
  ["Harbour Jet", "Singapore"],
  ["Tramontane Express", "France"],
  ["Vela Andina", "Chile"],
];

const CANDIDATE_NAMES = [
  "Adaora Nnamdi",
  "Alex Whitfield",
  "Anders Brekke",
  "Bianca Moretti",
  "Camille Fournier",
  "Daniel Ohanian",
  "Emeka Balogun",
  "Elsa Lindgren",
  "Fatima Zahra",
  "Felix Braun",
  "Georgia Papadaki",
  "Hugo Almeida",
  "Ida Solberg",
  "Ivan Kovac",
  "Jasmin Yilmaz",
  "Joaquín Reyes",
  "Kenji Morita",
  "Klara Novak",
  "Lars Petersen",
  "Lucia Ferrari",
  "Mateo Silva",
  "Mei Lin Chen",
  "Nadia Haddad",
  "Noor Rahman",
  "Oskar Malinowski",
  "Priya Nair",
  "Rafael Costa",
  "Rosa Jiménez",
  "Samuel Adeyemi",
  "Sanne Bakker",
];

const LICENCES = ["ATPL", "CPL", "MPL", "EASA Part-66 B1", "EASA Part-66 B2", "FAA Dispatcher"];
const BASES = ["DUB", "YVR", "OSL", "LIS", "BCN", "LHR", "AMS", "KEF", "EZE", "SIN", "NCE", "SCL"];

const CANDIDATE_TYPES = ["pilot", "cabin_crew", "engineer", "dispatcher"] as const;
const CANDIDATE_STATUSES = ["new", "screening", "verified", "placed", "rejected"] as const;
const USER_STATUSES = ["invited", "active", "suspended"] as const;
const APPROVALS = ["pending", "approved", "rejected"] as const;
const OPENING_STATUSES = ["draft", "open", "closed"] as const;
const APPLICATION_STATUSES = [
  "submitted",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;

const TITLES: Record<(typeof CANDIDATE_TYPES)[number], string[]> = {
  pilot: ["Captain — A320", "First Officer — A320", "First Officer — B737", "Captain — ATR 72"],
  cabin_crew: ["Cabin Crew — Short Haul", "Senior Cabin Crew", "Cabin Crew — Long Haul"],
  engineer: ["Line Maintenance Engineer", "Base Maintenance Engineer", "Avionics Technician"],
  dispatcher: ["Flight Dispatcher", "Senior Flight Dispatcher", "Operations Controller"],
};

/** Days back from a fixed point, so a seeded database reads the same every time. */
const EPOCH = Date.UTC(2026, 7, 1);

function daysAgo(days: number): Date {
  return new Date(EPOCH - days * 24 * 60 * 60 * 1000);
}

function emailFor(name: string, domain: string, index: number): string {
  const local = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z ]/g, "")
    .trim()
    .replace(/ +/g, ".");
  return `${local}${index}@${domain}`;
}

/**
 * Roughly two hundred rows across the five tables: enough that a table view has
 * to paginate, a filter has something to narrow, and every enum value is
 * actually present somewhere.
 */
export function seedRows(): SeedRows {
  const next = sequence(20260801);
  const pick = <T>(values: readonly T[]): T => values[Math.floor(next() * values.length)] as T;

  const userRows: UserRow[] = STAFF.map((name, index) => ({
    id: randomUUID(),
    name,
    email: emailFor(name, "skyscout.example", index),
    status: index < 3 ? "invited" : pick(USER_STATUSES),
    // Bcrypt-shaped and worth nothing: a fixture is not a credential.
    passwordHash: `$2b$12$${"seedseedseedseedseedse"}${String(index).padStart(2, "0")}fixtureonlyfixtureonly`,
    createdAt: daysAgo(300 - index * 7),
  }));

  const airlineRows: AirlineRow[] = AIRLINES.map(([name, country], index) => ({
    id: randomUUID(),
    name,
    country,
    // Four pending on purpose: the approve action needs something to act on.
    approvalStatus: index < 4 ? "pending" : pick(APPROVALS),
    verification: {
      aocNumber: `AOC-${1000 + index * 37}`,
      checkedBy: STAFF[index % STAFF.length],
      documents: ["aoc.pdf", "insurance.pdf", index % 2 === 0 ? "fleet-list.xlsx" : "iosa.pdf"],
      lastCheckedAt: daysAgo(90 - index * 3).toISOString(),
      notes: index % 3 === 0 ? "Fleet list predates the last two deliveries." : null,
    },
    createdAt: daysAgo(400 - index * 11),
  }));

  const approved = airlineRows.filter((airline) => airline.approvalStatus === "approved");

  const candidateRows: CandidateRow[] = Array.from({ length: 60 }, (_, index) => {
    const name = CANDIDATE_NAMES[index % CANDIDATE_NAMES.length] as string;
    const type = pick(CANDIDATE_TYPES);
    const status = index < 5 ? "new" : pick(CANDIDATE_STATUSES);
    const placedWith = status === "placed" && approved.length > 0 ? pick(approved).id : undefined;

    return {
      id: randomUUID(),
      name,
      email: emailFor(name, "example.com", index),
      type,
      status,
      profile: {
        yearsExperience: 1 + Math.floor(next() * 22),
        licences: [pick(LICENCES), ...(next() > 0.6 ? [pick(LICENCES)] : [])],
        preferredBase: pick(BASES),
        recruiterScore: Math.round(next() * 100),
        internalNotes: next() > 0.7 ? "Referred by an existing placement; move quickly." : null,
      },
      airlineId: placedWith,
      // Every tenth candidate is soft-deleted: still in the table, gone from
      // the product. An admin that shows them is showing deleted people.
      deletedAt: index % 10 === 9 ? daysAgo(30 + index) : null,
      createdAt: daysAgo(240 - index * 3),
    };
  });

  const openingRows: OpeningRow[] = Array.from({ length: 28 }, (_, index) => {
    const airline = (approved[index % Math.max(approved.length, 1)] ?? airlineRows[0]) as AirlineRow;
    const type = pick(CANDIDATE_TYPES);

    return {
      id: randomUUID(),
      airlineId: airline.id as string,
      title: pick(TITLES[type]) as string,
      status: index < 3 ? "open" : pick(OPENING_STATUSES),
      createdAt: daysAgo(180 - index * 5),
    };
  });

  const live = candidateRows.filter((candidate) => candidate.deletedAt === null);

  const applicationRows: ApplicationRow[] = Array.from({ length: 85 }, (_, index) => ({
    id: randomUUID(),
    candidateId: (live[index % live.length] as CandidateRow).id as string,
    openingId: (openingRows[index % openingRows.length] as OpeningRow).id as string,
    status: pick(APPLICATION_STATUSES),
    createdAt: daysAgo(120 - index),
  }));

  return {
    users: userRows,
    airlines: airlineRows,
    candidates: candidateRows,
    openings: openingRows,
    applications: applicationRows,
  };
}
