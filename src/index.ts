import { Elysia } from "elysia";
import { config } from "../tracker.config";
import { authMiddleware, swaggerMiddleware } from "./middleware";
import { generateRoutes } from "./routes";
import { usersRouter } from "./routes/users";

const app = new Elysia({
  detail: {
    responses: {
      401: {
        $ref: "#/components/responses/Unauthorized",
      },
    },
  },
})
  .use(authMiddleware)
  .use(swaggerMiddleware)
  .use(usersRouter)
  .use(generateRoutes())
  .listen({
    hostname: config.host,
    port: config.port,
  });

console.log(
  [
    "Tracker is up and running!",
    `> Base: http://${app.server?.hostname}:${app.server?.port}`,
    `> Docs: http://${app.server?.hostname}:${app.server?.port}/docs`,
  ].join("\n"),
);
