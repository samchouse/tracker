import { like } from "drizzle-orm";
import { Elysia } from "elysia";
import { config } from "../../tracker.config";
import { db } from "../db";
import { usage, users } from "../db/schema";
import { redirectRequest } from "../utils";

const HEADERS = {
  user: "x-tracker-user",
};

export function generateRoutes() {
  let elysia = new Elysia().onBeforeHandle(async ({ headers, error }) => {
    const user = headers[HEADERS.user];
    if (!user)
      return error(400, {
        message: "Missing user to track.",
      });

    const foundUser = await db.query.users.findFirst({
      where: like(users.identities, `%"${user}"%`),
    });
    if (!foundUser)
      return error(404, {
        message: "User not found.",
      });
  });
  for (const service of config.services) {
    let group = new Elysia({
      prefix: service.prefix,
      tags: ["Services"],
    }).all("/*", ({ error }) =>
      error(400, {
        message:
          "This route is not enabled. Please contact an admin to enable it.",
      }),
    );
    for (const endpoint of service.endpoints) {
      if (endpoint.path.includes("*"))
        throw new Error("Wildcard paths are not supported.");

      group = group[
        endpoint.method.toLowerCase() as Lowercase<typeof endpoint.method>
      ](
        endpoint.path,
        async ({ request, headers }) => {
          const response = await redirectRequest({
            bearer: service.key,
            request: request.clone(),
            to: { api: service.api, path: endpoint.path },
          });

          Promise.resolve().then(async () => {
            let cost =
              endpoint.pricing.type === "fixed" ? endpoint.pricing.cost : 0;
            if (endpoint.pricing.type === "dynamic") {
              cost = await endpoint.pricing.calculate({
                request,
                response,
              });
            }

            const user = headers[HEADERS.user];
            if (!user) return;

            const foundUser = await db.query.users.findFirst({
              where: like(users.identities, `%"${user}"%`),
            });
            if (!foundUser) return;

            await db
              .insert(usage)
              .values({
                date: new Date(),
                userId: foundUser.id,
                service: service.name,
                endpoint: endpoint.path,
                cost,
              })
              .execute();
          });

          return response;
        },
        {
          detail: {
            description: `Forwards request to ${service.api}${endpoint.path} ${endpoint.pricing.type === "fixed" ? `for a cost of $${endpoint.pricing.cost}` : "with a dynamic pricing model."}.`,
          },
        },
      );
    }
    elysia = elysia.use(group);
  }
  return elysia;
}
