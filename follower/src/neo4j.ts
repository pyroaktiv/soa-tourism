import neo4j, { Driver, Integer } from "neo4j-driver";

const NEO4J_URI = process.env.NEO4J_URI ?? "bolt://neo4j:7687";
const NEO4J_USER = process.env.NEO4J_USER ?? "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? "neo4j";

let _driver: Driver | undefined;

export function getDriver(): Driver {
  if (!_driver) {
    _driver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
    );
  }
  return _driver;
}

export async function closeDriver(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = undefined;
  }
}

// Query helpers

export async function follow(followerId: string, followeeId: string): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run(
      `MERGE (a:User {id: $followerId})
       MERGE (b:User {id: $followeeId})
       MERGE (a)-[:FOLLOWS]->(b)`,
      { followerId, followeeId },
    );
  } finally {
    await session.close();
  }
}

export async function unfollow(followerId: string, followeeId: string): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run(
      `MATCH (a:User {id: $followerId})-[r:FOLLOWS]->(b:User {id: $followeeId})
       DELETE r`,
      { followerId, followeeId },
    );
  } finally {
    await session.close();
  }
}

export interface PageResult {
  userIds: string[];
  total: number;
}

export async function getFollowers(
  userId: string,
  limit: number,
  offset: number,
): Promise<PageResult> {
  const session = getDriver().session();
  try {
    const [listResult, countResult] = await Promise.all([
      session.run(
        `MATCH (f:User)-[:FOLLOWS]->(:User {id: $userId})
         RETURN f.id AS userId
         SKIP $offset LIMIT $limit`,
        { userId, offset: neo4j.int(offset), limit: neo4j.int(limit) },
      ),
      session.run(
        `MATCH (f:User)-[:FOLLOWS]->(:User {id: $userId})
         RETURN count(f) AS total`,
        { userId },
      ),
    ]);
    return {
      userIds: listResult.records.map((r) => r.get("userId") as string),
      total: (countResult.records[0]?.get("total") as Integer).toNumber(),
    };
  } finally {
    await session.close();
  }
}

export async function getFollowing(
  userId: string,
  limit: number,
  offset: number,
): Promise<PageResult> {
  const session = getDriver().session();
  try {
    const [listResult, countResult] = await Promise.all([
      session.run(
        `MATCH (:User {id: $userId})-[:FOLLOWS]->(f:User)
         RETURN f.id AS userId
         SKIP $offset LIMIT $limit`,
        { userId, offset: neo4j.int(offset), limit: neo4j.int(limit) },
      ),
      session.run(
        `MATCH (:User {id: $userId})-[:FOLLOWS]->(f:User)
         RETURN count(f) AS total`,
        { userId },
      ),
    ]);
    return {
      userIds: listResult.records.map((r) => r.get("userId") as string),
      total: (countResult.records[0]?.get("total") as Integer).toNumber(),
    };
  } finally {
    await session.close();
  }
}

export async function isFollowing(
  followerId: string,
  followeeId: string,
): Promise<boolean> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (a:User {id: $followerId})-[r:FOLLOWS]->(b:User {id: $followeeId})
       RETURN count(r) > 0 AS result`,
      { followerId, followeeId },
    );
    return (result.records[0]?.get("result") as boolean) ?? false;
  } finally {
    await session.close();
  }
}

export async function getFollowedUserIds(userId: string): Promise<string[]> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (:User {id: $userId})-[:FOLLOWS]->(f:User)
       RETURN f.id AS userId`,
      { userId },
    );
    return result.records.map((r) => r.get("userId") as string);
  } finally {
    await session.close();
  }
}

export interface RecommendationRow {
  userId: string;
  mutualFollows: number;
}

export async function getRecommendations(
  userId: string,
  limit: number,
): Promise<RecommendationRow[]> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (me:User {id: $userId})-[:FOLLOWS]->(friend:User)-[:FOLLOWS]->(rec:User)
       WHERE rec.id <> $userId AND NOT (me)-[:FOLLOWS]->(rec)
       RETURN rec.id AS userId, count(DISTINCT friend) AS mutualFollows
       ORDER BY mutualFollows DESC
       LIMIT $limit`,
      { userId, limit: neo4j.int(limit) },
    );
    return result.records.map((r) => ({
      userId: r.get("userId") as string,
      mutualFollows: (r.get("mutualFollows") as Integer).toNumber(),
    }));
  } finally {
    await session.close();
  }
}
