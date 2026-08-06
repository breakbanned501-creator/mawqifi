/**
 * Chat routes.
 *
 * POST /chats          — create or return existing chat thread
 * GET  /chats/:userId  — list all chats a user participates in
 */

import { Router } from "express";
import { desc, eq, or } from "drizzle-orm";
import { db, chatsTable, type DbChat } from "@workspace/db";

const router: Router = Router();

function mapChat(c: DbChat) {
  return {
    id: c.id,
    postId: c.postId,
    parkingArea: c.parkingArea ?? undefined,
    postOwnerId: c.postOwnerId,
    seekerId: c.seekerId,
    lastMessage: c.lastMessage ?? undefined,
    lastMessageAt: c.lastMessageAt ? (c.lastMessageAt as Date).toISOString() : undefined,
    createdAt: (c.createdAt as Date).toISOString(),
  };
}

/** POST /api/chats — idempotent: creates chat if not exists, returns it either way. */
router.post("/chats", async (req, res): Promise<void> => {
  const { postId, postOwnerId, seekerId, parkingArea } = req.body as {
    postId: string;
    postOwnerId: string;
    seekerId: string;
    parkingArea?: string;
  };

  if (!postId || !postOwnerId || !seekerId) {
    res.status(400).json({ error: "postId, postOwnerId, seekerId required" });
    return;
  }

  const chatId = `${postId}-${seekerId}-${postOwnerId}`;

  try {
    // Check if already exists
    const [existing] = await db.select().from(chatsTable).where(eq(chatsTable.id, chatId));
    if (existing) {
      res.json(mapChat(existing));
      return;
    }

    const [inserted] = await db
      .insert(chatsTable)
      .values({ id: chatId, postId, postOwnerId, seekerId, parkingArea: parkingArea ?? null })
      .returning();

    req.log.info({ chatId }, "Chat created");
    res.status(201).json(mapChat(inserted));
  } catch (err) {
    req.log.error({ err }, "Failed to create/get chat");
    res.status(500).json({ error: "Failed to create/get chat" });
  }
});

/** GET /api/chats/:userId — return all chats involving this user. */
router.get("/chats/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const rows = await db
      .select()
      .from(chatsTable)
      .where(or(eq(chatsTable.postOwnerId, userId), eq(chatsTable.seekerId, userId)))
      .orderBy(desc(chatsTable.lastMessageAt));

    req.log.info({ userId, count: rows.length }, "Fetched user chats");
    res.json(rows.map(mapChat));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch chats");
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

export default router;
