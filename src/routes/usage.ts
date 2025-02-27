import bearer from "@elysiajs/bearer";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { config } from "../../tracker.config";
import { db } from "../db";
import { usage, users } from "../db/schema";
import { costRouter } from "./cost";

export const usageRouter = new Elysia({
  prefix: "/usage",
  tags: ["System"],
})
  .use(bearer())
  .use(costRouter)
  .get("/", async ({ bearer }) => {
    const foundUsage = await db.query.users.findMany({
      columns: {
        id: true,
        name: true,
        username: true,
      },
      where: bearer !== config.masterKey ? eq(users.apiKey, bearer) : undefined,
      with: { usage: true },
    });
    return { usage: foundUsage };
  })
  .delete(
    "/:id",
    async ({ params, error }) => {
      const deletedUsage = await db
        .delete(usage)
        .where(eq(usage.id, params.id))
        .returning()
        .execute();
      if (!deletedUsage.length)
        return error(404, { message: "Usage not found." });

      return { usage: deletedUsage[0] };
    },
    {
      params: t.Object({
        id: t.String(t.String({ minLength: 24, maxLength: 24 })),
      }),
    },
  )
  .delete("/reset", async ({ error }) => {
    const deletedUsage = await db.delete(usage).returning().execute();
    if (!deletedUsage.length)
      return error(404, { message: "There is no usage." });

    return { usage: deletedUsage };
  })
  .delete(
    "/reset/:user",
    async ({ error, params: { user } }) => {
      const deletedUsage = await db
        .delete(usage)
        .where(eq(usage.userId, user))
        .returning()
        .execute();
      if (!deletedUsage.length)
        return error(404, { message: "There is no usage." });

      return { usage: deletedUsage };
    },
    {
      params: t.Object({
        user: t.String(t.String({ minLength: 24, maxLength: 24 })),
      }),
    },
  );
