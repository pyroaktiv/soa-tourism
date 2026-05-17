#!/usr/bin/env node
/**
 * Seed script — creates 5 users with profiles and a follow graph.
 *
 * Graph structure:
 *
 *   alice ──► bob  ──► diana
 *    │                 ▲
 *    └──► charlie ──────┘
 *                  diana ──► eve
 *                  eve   ──► bob
 *
 * Expected recommendation for alice: diana (2 mutual follows via bob + charlie)
 *
 * Usage:
 *   node scripts/seed.mjs
 *   GATEWAY_URL=http://localhost:8080 node scripts/seed.mjs
 *   SEED_SUFFIX=abc123 node scripts/seed.mjs   # re-run with same user set
 */

const GATEWAY_URL = process.env.GATEWAY_URL   ?? "http://localhost:8080";
const PASSWORD    = process.env.SEED_PASSWORD ?? "Seed1234!";
// Unique suffix so repeated runs create distinct users.
// Set SEED_SUFFIX=<value> to reuse a previous run's users.
const SUFFIX      = process.env.SEED_SUFFIX   ?? Date.now().toString(36);

// ─── HTTP client ──────────────────────────────────────────────────────────────

async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data };
}

// ─── Domain helpers ───────────────────────────────────────────────────────────

async function registerOrLogin(name) {
  const username = `${name}_${SUFFIX}`;
  const email    = `${username}@test.example`;

  const reg = await api("POST", "/api/v1/auth/register", {
    username, email, password: PASSWORD, roles: ["tourist"],
  });

  if (reg.status === 200) {
    return { userId: reg.data.user.id, username, email, token: reg.data.tokens.accessToken };
  }

  // User already exists from a previous run with the same SEED_SUFFIX — log in instead.
  if (reg.status === 409) {
    const login = await api("POST", "/api/v1/auth/login", { identifier: email, password: PASSWORD });
    if (login.status !== 200) {
      throw new Error(`login fallback failed for ${username}: HTTP ${login.status} ${JSON.stringify(login.data)}`);
    }
    return { userId: login.data.user.id, username, email, token: login.data.tokens.accessToken };
  }

  throw new Error(`register ${username} failed: HTTP ${reg.status} ${JSON.stringify(reg.data)}`);
}

async function setProfile(userId, token, profile) {
  const { status, data } = await api("PUT", `/api/v1/stakeholders/profiles/${userId}`, profile, token);
  if (status !== 200) throw new Error(`setProfile ${userId} failed: HTTP ${status} ${JSON.stringify(data)}`);
  return data;
}

async function follow(followeeId, token) {
  const { status, data } = await api("POST", `/api/v1/followers/${followeeId}/follow`, {}, token);
  if (status !== 200) throw new Error(`follow ${followeeId} failed: HTTP ${status} ${JSON.stringify(data)}`);
}

// ─── Personas ─────────────────────────────────────────────────────────────────

const PERSONAS = {
  alice:   { name: "Alice",   surname: "Kowalski",  bio: "Adventure seeker",  motto: "Live every day fully"      },
  bob:     { name: "Bob",     surname: "Novak",     bio: "Mountain hiker",    motto: "Higher every time"         },
  charlie: { name: "Charlie", surname: "Horváth",   bio: "City explorer",     motto: "Every street has a story"  },
  diana:   { name: "Diana",   surname: "Müller",    bio: "Food traveler",     motto: "Taste the world"           },
  eve:     { name: "Eve",     surname: "Lindqvist", bio: "Beach lover",       motto: "Sun, sea, serenity"        },
};

// directed edges: [follower, followee]
const EDGES = [
  ["alice",   "bob"],
  ["alice",   "charlie"],
  ["bob",     "diana"],
  ["charlie", "diana"],
  ["diana",   "eve"],
  ["eve",     "bob"],
];

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\nGateway : ${GATEWAY_URL}`);
console.log(`Suffix  : ${SUFFIX}\n`);

// Connectivity check
const health = await api("GET", "/api/v1/health");
if (health.status !== 200) {
  console.error(`✗ Gateway health check failed: HTTP ${health.status}`);
  process.exit(1);
}
console.log("✓ Gateway is up\n");

// Register / log in
console.log("--- Users ---");
const users = {};
for (const name of Object.keys(PERSONAS)) {
  users[name] = await registerOrLogin(name);
  console.log(`  ${users[name].username.padEnd(20)} ${users[name].userId}`);
}

// Profiles
console.log("\n--- Profiles ---");
for (const [name, profile] of Object.entries(PERSONAS)) {
  await setProfile(users[name].userId, users[name].token, profile);
  console.log(`  ${users[name].username.padEnd(20)} ${profile.name} ${profile.surname}`);
}

// Follow graph
console.log("\n--- Follow graph ---");
for (const [from, to] of EDGES) {
  await follow(users[to].userId, users[from].token);
  console.log(`  ${users[from].username} → ${users[to].username}`);
}

// Summary
console.log("\n✓ Seed complete");
console.log("\nUser IDs:");
const pad = Math.max(...Object.keys(users).map(k => k.length));
for (const [name, u] of Object.entries(users)) {
  console.log(`  ${name.padEnd(pad)}  ${u.userId}`);
}
console.log(`\nRe-run with same users:\n  SEED_SUFFIX=${SUFFIX} node scripts/seed.mjs`);
console.log("\nExpected: alice's recommendations include diana (mutualFollows=2)\n");
