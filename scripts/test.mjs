#!/usr/bin/env node
/**
 * Integration test suite for the stakeholders + follower services.
 * Exercises every HTTP-accessible endpoint through the gateway.
 *
 * Each run creates isolated users (suffix = current timestamp) so the suite
 * is safe to run multiple times against a live stack.
 *
 * Usage:
 *   node scripts/test.mjs
 *   GATEWAY_URL=http://localhost:8080 node scripts/test.mjs
 *
 * Exit code: 0 on full pass, 1 on any failure.
 */

import assert from "node:assert/strict";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";
const RUN_ID      = Date.now().toString(36);   // unique suffix for this run
const PASSWORD    = "Test1234!";

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

// Registers a fresh user and returns { userId, username, email, token, refreshToken }.
async function register(label, roles = ["tourist"]) {
  const username = `t_${label}_${RUN_ID}`;
  const email    = `${username}@test.example`;
  const res = await api("POST", "/api/v1/auth/register", {
    username, email, password: PASSWORD, roles,
  });
  if (res.status !== 200) {
    throw new Error(`setup: register ${username} failed HTTP ${res.status}: ${JSON.stringify(res.data)}`);
  }
  return {
    userId:       res.data.user.id,
    username,
    email,
    token:        res.data.tokens.accessToken,
    refreshToken: res.data.tokens.refreshToken,
  };
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let pass = 0, fail = 0;
const failures = [];
let currentSuite = "";

function suite(name) {
  currentSuite = name;
  console.log(`\n${name}`);
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (err) {
    const msg = err instanceof assert.AssertionError
      ? err.message
      : String(err);
    console.log(`  ✗ ${name}`);
    console.log(`      ${msg}`);
    fail++;
    failures.push({ suite: currentSuite, name, message: msg });
  }
}

// ─── Connectivity ─────────────────────────────────────────────────────────────

suite("gateway");

await test("base endpoint responds 404", async () => {
  const { status } = await api("GET", "/");
  assert.equal(status, 404, `gateway at ${GATEWAY_URL} is not responding`);
});

// Abort early if the gateway is completely down - nothing else will work.
if (fail > 0) {
  console.error("\n✗ Gateway unreachable. Aborting.\n");
  process.exit(1);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

suite("auth");

// Shared state for this suite, built up across tests.
let authUser = {};

await test("registers a new user and returns user + token pair", async () => {
  const username = `t_auth_${RUN_ID}`;
  const email    = `${username}@test.example`;
  const { status, data } = await api("POST", "/api/v1/auth/register", {
    username, email, password: PASSWORD, roles: ["tourist"],
  });
  assert.equal(status, 200);
  assert.ok(data.user?.id,                   "response.user.id");
  assert.equal(data.user.username, username, "response.user.username");
  assert.ok(data.tokens?.accessToken,        "response.tokens.accessToken");
  assert.ok(data.tokens?.refreshToken,       "response.tokens.refreshToken");
  authUser = {
    userId:       data.user.id,
    token:        data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken,
  };
});

await test("rejects duplicate username -> 409", async () => {
  const { status } = await api("POST", "/api/v1/auth/register", {
    username: `t_auth_${RUN_ID}`,       // same username as above
    email:    `other_${RUN_ID}@test.example`,
    password: PASSWORD,
  });
  assert.equal(status, 409);
});

await test("logs in with correct credentials → 200 + tokens", async () => {
  const { status, data } = await api("POST", "/api/v1/auth/login", {
    identifier: `t_auth_${RUN_ID}@test.example`,
    password:   PASSWORD,
  });
  assert.equal(status, 200);
  assert.ok(data.tokens?.accessToken);
});

await test("rejects login with wrong password → 401", async () => {
  const { status } = await api("POST", "/api/v1/auth/login", {
    identifier: `t_auth_${RUN_ID}@test.example`,
    password:   "wrongpassword",
  });
  assert.equal(status, 401);
});

await test("rejects login for unknown user → 404", async () => {
  const { status } = await api("POST", "/api/v1/auth/login", {
    identifier: `nobody_${RUN_ID}@test.example`,
    password:   PASSWORD,
  });
  assert.equal(status, 404);
});

await test("refreshes an access token", async () => {
  const { status, data } = await api("POST", "/api/v1/auth/refresh", {
    refreshToken: authUser.refreshToken,
  });
  assert.equal(status, 200);
  assert.ok(data.accessToken, "new accessToken in response");
});

// ─── Stakeholders ─────────────────────────────────────────────────────────────

suite("stakeholders");

let stkA = {}, stkB = {};
stkA = await register("stkA");
stkB = await register("stkB");

await test("returns empty profile for a brand-new user", async () => {
  const { status, data } = await api("GET", `/api/v1/stakeholders/profiles/${stkA.userId}`);
  assert.equal(status, 200);
  assert.equal(data.userId, stkA.userId, "profile.userId matches");
  assert.equal(data.name   ?? "", "", "name is empty");
  assert.equal(data.bio    ?? "", "", "bio is empty");
});

await test("updates own profile (authenticated)", async () => {
  const { status, data } = await api(
    "PUT", `/api/v1/stakeholders/profiles/${stkA.userId}`,
    { name: "Test", surname: "User", bio: "Integration tester", motto: "All green" },
    stkA.token,
  );
  assert.equal(status, 200);
  assert.equal(data.name,    "Test");
  assert.equal(data.surname, "User");
  assert.equal(data.bio,     "Integration tester");
  assert.equal(data.motto,   "All green");
});

await test("reads back the updated profile", async () => {
  const { status, data } = await api("GET", `/api/v1/stakeholders/profiles/${stkA.userId}`);
  assert.equal(status, 200);
  assert.equal(data.name, "Test");
  assert.equal(data.bio,  "Integration tester");
});

await test("partial update only changes the provided fields", async () => {
  const { status, data } = await api(
    "PUT", `/api/v1/stakeholders/profiles/${stkA.userId}`,
    { bio: "Updated bio" },
    stkA.token,
  );
  assert.equal(status, 200);
  assert.equal(data.bio,  "Updated bio",  "bio changed");
  assert.equal(data.name, "Test",         "name unchanged");
});

await test("rejects unauthenticated profile update → 401", async () => {
  const { status } = await api(
    "PUT", `/api/v1/stakeholders/profiles/${stkA.userId}`,
    { name: "Hacker" },
    // no token
  );
  assert.equal(status, 401);
});

await test("rejects updating another user's profile → 403", async () => {
  const { status } = await api(
    "PUT", `/api/v1/stakeholders/profiles/${stkA.userId}`,
    { name: "Stolen" },
    stkB.token,    // different user's token
  );
  assert.equal(status, 403);
});

// ─── Follower ─────────────────────────────────────────────────────────────────

suite("follower");

// Set up a 4-user graph for recommendation coverage:
//
//   alice → bob        alice → charlie
//   bob   → diana      charlie → diana
//
// ∴ alice's recommendations must include diana with mutualFollows=2.

let fAlice = {}, fBob = {}, fCharlie = {}, fDiana = {};
fAlice   = await register("flAlice");
fBob     = await register("flBob");
fCharlie = await register("flCharlie");
fDiana   = await register("flDiana");

await test("follow another user → { success: true }", async () => {
  const { status, data } = await api(
    "POST", `/api/v1/followers/${fBob.userId}/follow`, {}, fAlice.token,
  );
  assert.equal(status, 200);
  assert.equal(data.success, true);
});

await test("rejects following yourself → 400", async () => {
  const { status } = await api(
    "POST", `/api/v1/followers/${fAlice.userId}/follow`, {}, fAlice.token,
  );
  assert.equal(status, 400);
});

await test("rejects unauthenticated follow → 401", async () => {
  const { status } = await api("POST", `/api/v1/followers/${fBob.userId}/follow`, {});
  assert.equal(status, 401);
});

// Build the remaining graph edges (outside test() — failures here are setup errors).
await api("POST", `/api/v1/followers/${fCharlie.userId}/follow`, {}, fAlice.token);
await api("POST", `/api/v1/followers/${fDiana.userId}/follow`,   {}, fBob.token);
await api("POST", `/api/v1/followers/${fDiana.userId}/follow`,   {}, fCharlie.token);

await test("getFollowers → alice is listed as follower of bob", async () => {
  const { status, data } = await api("GET", `/api/v1/followers/${fBob.userId}/followers`);
  assert.equal(status, 200);
  assert.ok(Array.isArray(data.userIds), "userIds is array");
  assert.ok(data.userIds.includes(fAlice.userId), `alice in bob's followers; got ${JSON.stringify(data.userIds)}`);
  assert.equal(data.total, 1);
});

await test("getFollowing → alice follows bob and charlie", async () => {
  const { status, data } = await api("GET", `/api/v1/followers/${fAlice.userId}/following`);
  assert.equal(status, 200);
  assert.ok(data.userIds.includes(fBob.userId),     "bob in alice's following");
  assert.ok(data.userIds.includes(fCharlie.userId), "charlie in alice's following");
  assert.equal(data.total, 2);
});

await test("isFollowing → true for alice→bob", async () => {
  const { status, data } = await api(
    "GET", `/api/v1/followers/${fAlice.userId}/following/${fBob.userId}`,
  );
  assert.equal(status, 200);
  assert.equal(data.isFollowing, true);
});

await test("isFollowing → false for bob→alice (no edge)", async () => {
  const { status, data } = await api(
    "GET", `/api/v1/followers/${fBob.userId}/following/${fAlice.userId}`,
  );
  assert.equal(status, 200);
  assert.equal(data.isFollowing, false);
});

await test("getFollowers with limit=1 returns 1 result but correct total", async () => {
  // diana has 2 followers (bob + charlie)
  const { status, data } = await api(
    "GET", `/api/v1/followers/${fDiana.userId}/followers?limit=1&offset=0`,
  );
  assert.equal(status, 200);
  assert.equal(data.userIds.length, 1,  "only 1 user returned (limit=1)");
  assert.equal(data.total,          2,  "total still reflects full count");
});

await test("getRecommendations → diana recommended for alice (mutualFollows=2)", async () => {
  const { status, data } = await api(
    "GET", "/api/v1/followers/recommendations", undefined, fAlice.token,
  );
  assert.equal(status, 200);
  assert.ok(Array.isArray(data.recommendations), "recommendations is array");
  const rec = data.recommendations.find(r => r.userId === fDiana.userId);
  assert.ok(
    rec,
    `diana missing from alice's recommendations; got: ${JSON.stringify(data.recommendations)}`,
  );
  assert.equal(rec.mutualFollows, 2, "diana has 2 mutual follows (via bob + charlie)");
});

await test("getRecommendations excludes users alice already follows", async () => {
  const { status, data } = await api(
    "GET", "/api/v1/followers/recommendations", undefined, fAlice.token,
  );
  assert.equal(status, 200);
  assert.ok(!data.recommendations.some(r => r.userId === fBob.userId),     "bob not recommended (already following)");
  assert.ok(!data.recommendations.some(r => r.userId === fCharlie.userId), "charlie not recommended (already following)");
});

await test("getRecommendations requires auth → 401", async () => {
  const { status } = await api("GET", "/api/v1/followers/recommendations");
  assert.equal(status, 401);
});

await test("unfollow bob → { success: true }", async () => {
  const { status, data } = await api(
    "DELETE", `/api/v1/followers/${fBob.userId}/follow`, undefined, fAlice.token,
  );
  assert.equal(status, 200);
  assert.equal(data.success, true);
});

await test("isFollowing → false after unfollow", async () => {
  const { status, data } = await api(
    "GET", `/api/v1/followers/${fAlice.userId}/following/${fBob.userId}`,
  );
  assert.equal(status, 200);
  assert.equal(data.isFollowing, false);
});

await test("getFollowers total decrements after unfollow", async () => {
  const { status, data } = await api("GET", `/api/v1/followers/${fBob.userId}/followers`);
  assert.equal(status, 200);
  assert.equal(data.total, 0, `expected 0 followers; got ${data.total}`);
  assert.ok(!data.userIds.includes(fAlice.userId), "alice no longer in bob's followers");
});

await test("unfollow is idempotent (second unfollow → 200)", async () => {
  const { status, data } = await api(
    "DELETE", `/api/v1/followers/${fBob.userId}/follow`, undefined, fAlice.token,
  );
  assert.equal(status, 200);
  assert.equal(data.success, true);
});

await test("unfollow requires auth → 401", async () => {
  const { status } = await api("DELETE", `/api/v1/followers/${fBob.userId}/follow`);
  assert.equal(status, 401);
});

// ─── Tours ────────────────────────────────────────────────────────────────────

suite("tours");

let tAuthor = {}, tTourist = {}, tOther = {};
tAuthor  = await register("tAuthor",  ["author"]);
tTourist = await register("tTourist", ["tourist"]);
tOther   = await register("tOtherA",  ["author"]);

let tourId = null;

// Auth guards on create
await test("rejects unauthenticated create → 401", async () => {
  const { status } = await api("POST", "/api/v1/tours", {
    name: "T", description: "D", difficulty: 1, tags: ["x"],
  });
  assert.equal(status, 401);
});

await test("tourist cannot create tour → 403", async () => {
  const { status } = await api("POST", "/api/v1/tours", {
    name: "T", description: "D", difficulty: 1, tags: ["x"],
  }, tTourist.token);
  assert.equal(status, 403);
});

// Create
await test("author creates tour → TOUR_STATUS_DRAFT, price 0, no keypoints", async () => {
  const { status, data } = await api("POST", "/api/v1/tours", {
    name: "Mountain Trek",
    description: "A challenging hike",
    difficulty: 3,
    tags: ["hiking", "mountains"],
  }, tAuthor.token);
  assert.equal(status, 200);
  assert.ok(data.id, "tour.id present");
  assert.equal(data.status, "TOUR_STATUS_DRAFT");
  assert.equal(data.authorId, tAuthor.userId);
  assert.equal(data.price    ?? 0, 0, "initial price is 0");
  assert.equal(data.lengthKm ?? 0, 0, "initial length is 0");
  assert.equal((data.keypoints ?? []).length, 0, "no keypoints yet");
  tourId = data.id;
});

// ListMyTours
await test("ListMyTours returns the created tour", async () => {
  const { status, data } = await api("GET", "/api/v1/tours/authored", undefined, tAuthor.token);
  assert.equal(status, 200);
  assert.ok((data.tours ?? []).some(t => t.id === tourId), "tour in author's list");
});

await test("ListMyTours requires auth → 401", async () => {
  const { status } = await api("GET", "/api/v1/tours/authored");
  assert.equal(status, 401);
});

// Draft visibility rules
await test("draft tour not visible to tourist → 404", async () => {
  const { status } = await api("GET", `/api/v1/tours/${tourId}`, undefined, tTourist.token);
  assert.equal(status, 404);
});

await test("draft tour not visible to unauthenticated caller → 404", async () => {
  const { status } = await api("GET", `/api/v1/tours/${tourId}`);
  assert.equal(status, 404);
});

await test("draft tour absent from public listing", async () => {
  const { status, data } = await api("GET", "/api/v1/tours");
  assert.equal(status, 200);
  assert.ok(!(data.tours ?? []).some(t => t.id === tourId), "draft absent from public list");
});

await test("author can see own draft tour", async () => {
  const { status, data } = await api("GET", `/api/v1/tours/${tourId}`, undefined, tAuthor.token);
  assert.equal(status, 200);
  assert.equal(data.status, "TOUR_STATUS_DRAFT");
  assert.equal(data.name, "Mountain Trek");
});

// Update
await test("author updates draft tour name", async () => {
  const { status, data } = await api("PUT", `/api/v1/tours/${tourId}`, {
    name: "Alpine Trek",
  }, tAuthor.token);
  assert.equal(status, 200);
  assert.equal(data.name, "Alpine Trek");
  assert.equal(data.description, "A challenging hike", "other fields unchanged");
});

await test("other author cannot update tour → 403", async () => {
  const { status } = await api("PUT", `/api/v1/tours/${tourId}`, { name: "Stolen" }, tOther.token);
  assert.equal(status, 403);
});

// Publish validation — step-by-step
await test("cannot publish with no keypoints → 400", async () => {
  const { status } = await api("POST", `/api/v1/tours/${tourId}/publish`, {}, tAuthor.token);
  assert.equal(status, 400);
});

await test("add first keypoint → length_km stays 0", async () => {
  const { status, data } = await api("POST", `/api/v1/tours/${tourId}/keypoints`, {
    name: "Trailhead", description: "Starting point",
    latitude: 44.8176, longitude: 20.4633,
  }, tAuthor.token);
  assert.equal(status, 200);
  assert.equal(data.keypoints?.length, 1);
  assert.equal(data.lengthKm ?? 0, 0, "no distance with a single keypoint");
});

await test("cannot publish with only one keypoint → 400", async () => {
  const { status } = await api("POST", `/api/v1/tours/${tourId}/publish`, {}, tAuthor.token);
  assert.equal(status, 400);
});

await test("add second keypoint → length_km > 0", async () => {
  const { status, data } = await api("POST", `/api/v1/tours/${tourId}/keypoints`, {
    name: "Summit", description: "Peak viewpoint",
    latitude: 44.8696, longitude: 20.5233,
  }, tAuthor.token);
  assert.equal(status, 200);
  assert.equal(data.keypoints?.length, 2);
  assert.ok((data.lengthKm ?? 0) > 0, `lengthKm should be > 0, got ${data.lengthKm}`);
});

await test("other author cannot add keypoint to someone else's tour → 403", async () => {
  const { status } = await api("POST", `/api/v1/tours/${tourId}/keypoints`, {
    name: "Stolen KP", description: "x", latitude: 44.0, longitude: 20.0,
  }, tOther.token);
  assert.equal(status, 403);
});

await test("cannot publish without a transport time → 400", async () => {
  const { status } = await api("POST", `/api/v1/tours/${tourId}/publish`, {}, tAuthor.token);
  assert.equal(status, 400);
});

await test("add transport time (foot, 120 min)", async () => {
  const { status, data } = await api("POST", `/api/v1/tours/${tourId}/transport-times`, {
    transport: "TRANSPORT_TYPE_FOOT", minutes: 120,
  }, tAuthor.token);
  assert.equal(status, 200);
  assert.equal(data.transportTimes?.length, 1);
  assert.equal(data.transportTimes[0].minutes, 120);
});

await test("adding same transport type replaces existing entry", async () => {
  const { status, data } = await api("POST", `/api/v1/tours/${tourId}/transport-times`, {
    transport: "TRANSPORT_TYPE_FOOT", minutes: 90,
  }, tAuthor.token);
  assert.equal(status, 200);
  assert.equal(data.transportTimes?.length, 1, "no duplicate entries");
  assert.equal(data.transportTimes[0].minutes, 90, "minutes updated");
});

// Publish
await test("publish tour → TOUR_STATUS_PUBLISHED, publishedAt set", async () => {
  const { status, data } = await api("POST", `/api/v1/tours/${tourId}/publish`, {}, tAuthor.token);
  assert.equal(status, 200);
  assert.equal(data.status, "TOUR_STATUS_PUBLISHED");
  assert.ok(data.publishedAt, "publishedAt is set");
});

// Published visibility rules
await test("tourist sees published tour with first keypoint only", async () => {
  const { status, data } = await api("GET", `/api/v1/tours/${tourId}`, undefined, tTourist.token);
  assert.equal(status, 200);
  assert.equal(data.keypoints?.length, 1, "tourist sees only first keypoint");
  assert.equal(data.keypoints[0].name, "Trailhead", "correct first keypoint shown");
});

await test("unauthenticated caller sees published tour with first keypoint only", async () => {
  const { status, data } = await api("GET", `/api/v1/tours/${tourId}`);
  assert.equal(status, 200);
  assert.equal(data.keypoints?.length, 1);
});

await test("author sees published tour with all keypoints", async () => {
  const { status, data } = await api("GET", `/api/v1/tours/${tourId}`, undefined, tAuthor.token);
  assert.equal(status, 200);
  assert.equal(data.keypoints?.length, 2, "author sees all keypoints");
});

await test("published tour in public listing with first keypoint only", async () => {
  const { status, data } = await api("GET", "/api/v1/tours");
  assert.equal(status, 200);
  const t = (data.tours ?? []).find(t => t.id === tourId);
  assert.ok(t, "published tour in public list");
  assert.equal(t.keypoints?.length, 1, "listing shows first keypoint only");
});

await test("cannot update published tour → 400", async () => {
  const { status } = await api("PUT", `/api/v1/tours/${tourId}`, { name: "Hijacked" }, tAuthor.token);
  assert.equal(status, 400);
});

// Reviews (while tour is published)
await test("author cannot add review → 403", async () => {
  const { status } = await api("POST", `/api/v1/tours/${tourId}/reviews`, {
    rating: 5, comment: "Self-review", visitDate: "2025-05-01",
  }, tAuthor.token);
  assert.equal(status, 403);
});

await test("rating 0 rejected → 400", async () => {
  const { status } = await api("POST", `/api/v1/tours/${tourId}/reviews`, {
    rating: 0, comment: "Bad", visitDate: "2025-05-01",
  }, tTourist.token);
  assert.equal(status, 400);
});

await test("rating 6 rejected → 400", async () => {
  const { status } = await api("POST", `/api/v1/tours/${tourId}/reviews`, {
    rating: 6, comment: "Too high", visitDate: "2025-05-01",
  }, tTourist.token);
  assert.equal(status, 400);
});

await test("tourist adds review → stored with correct fields", async () => {
  const { status, data } = await api("POST", `/api/v1/tours/${tourId}/reviews`, {
    rating: 4, comment: "Lovely hike!", visitDate: "2025-04-20", imageUrls: [],
  }, tTourist.token);
  assert.equal(status, 200);
  const review = (data.reviews ?? []).find(r => r.touristId === tTourist.userId);
  assert.ok(review, "review by tourist present");
  assert.equal(review.rating,          4);
  assert.equal(review.comment,         "Lovely hike!");
  assert.equal(review.touristUsername.toLowerCase(), tTourist.username.toLowerCase());
  assert.ok(review.createdAt, "createdAt is set");
});

// Archive
await test("tourist cannot archive tour → 403", async () => {
  const { status } = await api("POST", `/api/v1/tours/${tourId}/archive`, {}, tTourist.token);
  assert.equal(status, 403);
});

await test("archive published tour → TOUR_STATUS_ARCHIVED, archivedAt set", async () => {
  const { status, data } = await api("POST", `/api/v1/tours/${tourId}/archive`, {}, tAuthor.token);
  assert.equal(status, 200);
  assert.equal(data.status, "TOUR_STATUS_ARCHIVED");
  assert.ok(data.archivedAt, "archivedAt is set");
});

await test("archived tour not visible to tourist → 404", async () => {
  const { status } = await api("GET", `/api/v1/tours/${tourId}`, undefined, tTourist.token);
  assert.equal(status, 404);
});

await test("archived tour absent from public listing", async () => {
  const { status, data } = await api("GET", "/api/v1/tours");
  assert.equal(status, 200);
  assert.ok(!(data.tours ?? []).some(t => t.id === tourId), "archived tour absent");
});

await test("cannot add review to archived tour → 400", async () => {
  const { status } = await api("POST", `/api/v1/tours/${tourId}/reviews`, {
    rating: 3, comment: "Late review", visitDate: "2025-05-01",
  }, tTourist.token);
  assert.equal(status, 400);
});

// Reactivate
await test("reactivate archived tour → TOUR_STATUS_PUBLISHED, archivedAt cleared", async () => {
  const { status, data } = await api("POST", `/api/v1/tours/${tourId}/reactivate`, {}, tAuthor.token);
  assert.equal(status, 200);
  assert.equal(data.status, "TOUR_STATUS_PUBLISHED");
  assert.ok(!data.archivedAt, "archivedAt cleared after reactivation");
});

await test("reactivated tour is visible again in public listing", async () => {
  const { status, data } = await api("GET", "/api/v1/tours");
  assert.equal(status, 200);
  assert.ok((data.tours ?? []).some(t => t.id === tourId), "reactivated tour back in public list");
});

// ─── Summary ─────────────────────────────────────────────────────────────────

const total = pass + fail;
console.log(`\n${"─".repeat(44)}`);
if (fail === 0) {
  console.log(`  ✓ All ${total} tests passed`);
} else {
  console.log(`  ${pass}/${total} passed — ${fail} FAILED`);
  console.log("\nFailed tests:");
  for (const f of failures) {
    console.log(`  [${f.suite}] ${f.name}`);
    console.log(`    ${f.message}`);
  }
}
console.log();
process.exit(fail > 0 ? 1 : 0);
