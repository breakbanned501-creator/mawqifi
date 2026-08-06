/**
 * Admin analytics routes — protected by a bearer token.
 *
 * GET /admin/stats
 *   Returns real-time platform statistics from the database.
 *   Requires: Authorization: Bearer <ADMIN_KEY>
 *
 * The ADMIN_KEY is read from the ADMIN_KEY environment variable.
 * Default value: "mawqifi7777" (matches the mobile PIN "7777").
 *
 * DO NOT expose this endpoint publicly without proper authentication.
 */

import { Router } from "express";
import { desc, eq, gt, sql } from "drizzle-orm";
import {
  db,
  parkingPostsTable,
  chatsTable,
  chatMessagesTable,
} from "@workspace/db";

const router: Router = Router();

function getAdminKey(): string {
  return process.env["ADMIN_KEY"] ?? "mawqifi7777";
}

router.get("/admin/stats", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${getAdminKey()}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars

    const [activePosts, postsToday, totalChats, totalMessages, topAreas] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(parkingPostsTable)
          .where(eq(parkingPostsTable.isActive, true)),

        db
          .select({ count: sql<number>`count(*)::int` })
          .from(parkingPostsTable)
          .where(gt(parkingPostsTable.createdAt, since24h)),

        db.select({ count: sql<number>`count(*)::int` }).from(chatsTable),

        db
          .select({ count: sql<number>`count(*)::int` })
          .from(chatMessagesTable),

        db
          .select({
            area: parkingPostsTable.parkingArea,
            count: sql<number>`count(*)::int`.as("cnt"),
          })
          .from(parkingPostsTable)
          .groupBy(parkingPostsTable.parkingArea)
          .orderBy(desc(sql`count(*)`))
          .limit(5),
      ]);

    req.log.info("Admin stats fetched");

    res.json({
      activePosts: activePosts[0]?.count ?? 0,
      postsToday: postsToday[0]?.count ?? 0,
      totalChats: totalChats[0]?.count ?? 0,
      totalMessages: totalMessages[0]?.count ?? 0,
      topAreas: topAreas.map((r) => ({ area: r.area, count: r.count })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch admin stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
