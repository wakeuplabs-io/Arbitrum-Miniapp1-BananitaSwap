import {
  pgTable,
  serial,
  text
} from "drizzle-orm/pg-core";

// placeholder table
export const placeholder = pgTable(
  "plcaeholder",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
  },
);
