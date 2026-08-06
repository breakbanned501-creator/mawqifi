import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const chatsTable = pgTable("chats", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull(),
  parkingArea: text("parking_area"),
  postOwnerId: text("post_owner_id").notNull(),
  seekerId: text("seeker_id").notNull(),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DbChat = typeof chatsTable.$inferSelect;
