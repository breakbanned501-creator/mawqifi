import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const parkingPostsTable = pgTable("parking_posts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  parkingArea: text("parking_area").notNull(),
  nearbyBuilding: text("nearby_building"),
  carDescription: text("car_description"),
  departureTime: timestamp("departure_time", { withTimezone: true }).notNull(),
  departureNote: text("departure_note"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DbParkingPost = typeof parkingPostsTable.$inferSelect;
