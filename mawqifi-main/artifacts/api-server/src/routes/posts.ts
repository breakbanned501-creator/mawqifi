/**
 * Parking posts routes — with Server-Sent Events (SSE) for realtime updates.
 *
 * GET  /posts          — all active, non-expired posts (newest first)
 * GET  /posts/stream   — SSE channel; emits "new_post" events to all clients
 * POST /posts          — create a new post (also broadcasts via SSE)
 * PATCH /posts/:id/close — mark a post as inactive
 */

import { Router, type Response } from "express";
import { and, desc, eq, gt } from "drizzle-orm";
import { db, parkingPostsTable, type DbParkingPost } from "@workspace/db";

const router: Router = Router();

// ─── SSE client store ─────────────────────────────────────────────────────────
// Holds every currently-connected web client.  Cleaned up on disconnect.
const sseClients = new Set<Response>();

/** Convert a DB row to the JSON shape the mobile app expects. */
function mapPost(p: DbParkingPost) {
  return {
    id: p.id,
    userId: p.userId,
    parkingArea: p.parkingArea,
    nearbyBuilding: p.nearbyBuilding ?? undefined,
    carDescription: p.carDescription ?? undefined,
    departureTime: (p.departureTime as Date).toISOString(),
    departureNote: p.departureNote ?? undefined,
    isActive: p.isActive,
    createdAt: (p.createdAt as Date).toISOString(),
  };
}

/** Push a new-post event to every connected SSE client. */
function broadcastNewPost(post: ReturnType<typeof mapPost>): void {
  if (sseClients.size === 0) return;
  const msg = `event: new_post\ndata: ${JSON.stringify(post)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(msg);
    } catch {
      sseClients.delete(client);
    }
  });
}

// ─── GET /posts/stream ────────────────────────────────────────────────────────
// SSE endpoint.  Clients connect once and receive push events for new posts.
// Keep-alive ping sent every 20 s to prevent proxy timeouts.
router.get("/posts/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Confirm connection to the client
  res.write(`event: connected\ndata: {"status":"ok","clients":${sseClients.size + 1}}\n\n`);

  sseClients.add(res);
  req.log.info({ clientCount: sseClients.size }, "SSE client connected");

  // Keep-alive: send a comment ping every 20 s so proxies don't close the socket
  const keepAlive = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 20_000);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
    req.log.info({ clientCount: sseClients.size }, "SSE client disconnected");
  });
});

// ─── GET /posts ───────────────────────────────────────────────────────────────
router.get("/posts", async (req, res) => {
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(parkingPostsTable)
      .where(
        and(
          eq(parkingPostsTable.isActive, true),
          gt(parkingPostsTable.departureTime, now)
        )
      )
      .orderBy(desc(parkingPostsTable.createdAt));

    req.log.info({ count: rows.length }, "Fetched active posts");
    res.json(rows.map(mapPost));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch posts");
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// ─── POST /posts ──────────────────────────────────────────────────────────────
router.post("/posts", async (req, res) => {
  const {
    userId,
    parkingArea,
    nearbyBuilding,
    carDescription,
    departureTime,
    departureNote,
  } = req.body as {
    userId: string;
    parkingArea: string;
    nearbyBuilding?: string;
    carDescription?: string;
    departureTime: string;
    departureNote?: string;
  };

  if (!userId || !parkingArea || !departureTime) {
    res.status(400).json({ error: "userId, parkingArea, departureTime are required" });
    return;
  }

  try {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    const [inserted] = await db
      .insert(parkingPostsTable)
      .values({
        id,
        userId,
        parkingArea,
        nearbyBuilding: nearbyBuilding ?? null,
        carDescription: carDescription ?? null,
        departureTime: new Date(departureTime),
        departureNote: departureNote ?? null,
        isActive: true,
      })
      .returning();

    const post = mapPost(inserted);
    req.log.info({ postId: id, parkingArea, sseClients: sseClients.size }, "Post created — broadcasting via SSE");

    // Push to all connected web clients immediately
    broadcastNewPost(post);

    res.status(201).json(post);
  } catch (err) {
    req.log.error({ err }, "Failed to create post");
    res.status(500).json({ error: "Failed to create post" });
  }
});

// ─── PATCH /posts/:id/close ───────────────────────────────────────────────────
router.patch("/posts/:id/close", async (req, res) => {
  const { id } = req.params;

  try {
    const [updated] = await db
      .update(parkingPostsTable)
      .set({ isActive: false })
      .where(eq(parkingPostsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    req.log.info({ postId: id }, "Post closed");
    res.json(mapPost(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to close post");
    res.status(500).json({ error: "Failed to close post" });
  }
});

export default router;
