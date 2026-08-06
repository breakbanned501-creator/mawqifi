/**
 * Chat messages routes.
 *
 * GET  /messages/:chatId  — all messages in a chat (oldest first)
 * POST /messages          — send a text or image message
 */

import { Router } from "express";
import { and, asc, eq, gt } from "drizzle-orm";
import { db, chatMessagesTable, chatsTable, type DbChatMessage } from "@workspace/db";

const router: Router = Router();

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB base64 safety limit

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function mapMessage(m: DbChatMessage) {
  return {
    id: m.id,
    chatId: m.chatId,
    senderId: m.senderId,
    text: m.messageText ?? undefined,
    imageUri: m.imageUrl ?? undefined,
    timestamp: (m.createdAt as Date).toISOString(),
  };
}

/** GET /api/messages/:chatId — fetch messages for a chat (oldest first). Accepts optional ?since=<iso> for delta polling. */
router.get("/messages/:chatId", async (req, res) => {
  const { chatId } = req.params;
  const since = req.query.since as string | undefined;

  try {
    let conditions = eq(chatMessagesTable.chatId, chatId);
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        conditions = and(eq(chatMessagesTable.chatId, chatId), gt(chatMessagesTable.createdAt, sinceDate))!;
      }
    }

    const rows = await db
      .select()
      .from(chatMessagesTable)
      .where(conditions)
      .orderBy(asc(chatMessagesTable.createdAt));

    res.json(rows.map(mapMessage));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch messages");
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/** POST /api/messages — send a new message (text or image). */
router.post("/messages", async (req, res): Promise<void> => {
  const { chatId, senderId, text, imageData } = req.body as {
    chatId: string;
    senderId: string;
    text?: string;
    /** Full base64 data URI: "data:image/jpeg;base64,..." */
    imageData?: string;
  };

  if (!chatId || !senderId) {
    res.status(400).json({ error: "chatId and senderId are required" });
    return;
  }
  if (!text && !imageData) {
    res.status(400).json({ error: "text or imageData is required" });
    return;
  }
  if (imageData && Buffer.byteLength(imageData, "utf8") > MAX_IMAGE_BYTES) {
    res.status(413).json({ error: "Image too large. Max 3 MB." });
    return;
  }

  try {
    const id = generateId();
    const [inserted] = await db
      .insert(chatMessagesTable)
      .values({
        id,
        chatId,
        senderId,
        messageText: text ?? null,
        imageUrl: imageData ?? null,
      })
      .returning();

    // Update chat's last message preview
    await db
      .update(chatsTable)
      .set({
        lastMessage: text ?? "📷 صورة",
        lastMessageAt: new Date(),
      })
      .where(eq(chatsTable.id, chatId));

    req.log.info({ chatId, messageId: id, hasImage: !!imageData }, "Message sent");
    res.status(201).json(mapMessage(inserted));
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
