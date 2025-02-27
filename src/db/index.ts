import { drizzle } from "drizzle-orm/bun-sqlite";
import { config } from "../../tracker.config";
import * as schema from "./schema";

export const db = drizzle(config.dbFileName, { schema });
