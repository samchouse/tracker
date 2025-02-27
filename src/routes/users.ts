import type { SQLiteError } from "bun:sqlite";
import bearer from "@elysiajs/bearer";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { config } from "../../tracker.config";
import { db } from "../db";
import { users } from "../db/schema";
import { usageRouter } from "./usage";

export const usersRouter = new Elysia({
  prefix: "/users",
  tags: ["System"],
})
  .use(bearer())
  .use(usageRouter)
  .get("/", async ({ bearer }) => {
    const foundUsers = await db.query.users.findMany({
      where: bearer !== config.masterKey ? eq(users.apiKey, bearer) : undefined,
    });
    return { users: foundUsers };
  })
  .post(
    "/",
    async ({ body, error }) => {
      try {
        const createdUsers = await db
          .insert(users)
          .values(body)
          .returning()
          .onConflictDoNothing()
          .execute();
        if (!createdUsers.length)
          return error(409, { message: "Username already exists." });

        return { user: createdUsers[0] };
      } catch (e) {
        const exception = e as SQLiteError;
        if (
          exception.code === "SQLITE_CONSTRAINT_UNIQUE" &&
          exception.message.includes("users.username")
        )
          return error(409, { message: "Username already exists." });
        return error(500, { message: "Internal server error." });
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 3, examples: ["John Doe"] }),
        username: t.String({ minLength: 3, examples: ["john.doe"] }),
        identities: t.Optional(
          t.Array(t.String({ minLength: 1 }), {
            examples: [["lc/a1234"]],
          }),
        ),
      }),
    },
  )
  .patch(
    "/:id/identifiers",
    async ({ params, body, error }) => {
      const foundUser = await db.query.users.findFirst({
        where: eq(users.id, params.id),
      });
      if (!foundUser) return error(404, { message: "User not found." });

      const identities = foundUser.identities;
      for (const { operation, value } of body) {
        if (operation === "add" && !identities.includes(value)) {
          identities.push(value);
        } else if (operation === "remove") {
          const index = identities.indexOf(value);
          if (index === -1) continue;

          identities.splice(index, 1);
        }
      }

      const updatedUsers = await db
        .update(users)
        .set({ identities })
        .where(eq(users.id, params.id))
        .returning()
        .execute();
      return { user: updatedUsers[0] };
    },
    {
      params: t.Object({
        id: t.String(t.String({ minLength: 24, maxLength: 24 })),
      }),
      body: t.Array(
        t.Object({
          operation: t.Union([t.Literal("add"), t.Literal("remove")]),
          value: t.String({ minLength: 1 }),
        }),
      ),
    },
  )
  .delete(
    "/:id",
    async ({ params, error }) => {
      const deletedUsers = await db
        .delete(users)
        .where(eq(users.id, params.id))
        .returning()
        .execute();
      if (!deletedUsers.length)
        return error(404, { message: "User not found." });

      return { user: deletedUsers[0] };
    },
    {
      params: t.Object({
        id: t.String(t.String({ minLength: 24, maxLength: 24 })),
      }),
    },
  );
