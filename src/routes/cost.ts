import bearer from "@elysiajs/bearer";
import { add, startOfDay, sub } from "date-fns";
import { and, eq, gte, lt } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { config } from "../../tracker.config";
import { db } from "../db";
import { usage, users } from "../db/schema";

export const costRouter = new Elysia({
  prefix: "/cost",
  tags: ["System"],
})
  .use(bearer())
  .get(
    "/",
    async ({ bearer, query: { from, to } }) => {
      if ((from && !to) || (to && !from))
        return {
          message:
            "Both 'from' and 'to' must be provided if you choose to provide the other.",
        };

      const fromParsed = from ?? startOfDay(sub(new Date(), { months: 1 }));
      const toParsed = to ?? startOfDay(add(new Date(), { days: 1 }));

      const foundUsage = await db.query.users.findMany({
        columns: {
          id: true,
          name: true,
          username: true,
          identities: true,
        },
        where:
          bearer !== config.masterKey ? eq(users.apiKey, bearer) : undefined,
        with: {
          usage: {
            where: and(gte(usage.date, fromParsed), lt(usage.date, toParsed)),
          },
        },
      });

      const cost: (Omit<typeof users.$inferSelect, "apiKey" | "identities"> & {
        cost: number;
        breakdown: { source: string; cost: number }[];
      })[] = [];
      for (const user of foundUsage) {
        let total = 0;
        const breakdown = new Map<string, number>();

        for (const use of user.usage) {
          total += use.cost;
          breakdown.set(
            use.service,
            (breakdown.get(use.service) ?? 0) + use.cost,
          );
        }

        for (const extraCost of config.extraCosts ?? []) {
          for (const identity of user.identities) {
            if (identity.startsWith(extraCost.prefix)) {
              let extra = await extraCost.fetch({
                from: fromParsed,
                to: toParsed,
                user: identity.replace(extraCost.prefix, ""),
              });
              if (extraCost.addTaxes) extra *= config.taxRate;

              total += extra;
              breakdown.set(extraCost.name, extra);
            }
          }
        }

        cost.push({
          id: user.id,
          name: user.name,
          username: user.username,
          cost: total,
          breakdown: [
            ...breakdown.entries().map(([source, cost]) => ({ source, cost })),
          ],
        });
      }

      return { cost, from: fromParsed, to: toParsed };
    },
    {
      query: t.Object({
        from: t.Optional(t.Date()),
        to: t.Optional(t.Date()),
      }),
    },
  );
