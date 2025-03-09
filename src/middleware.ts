import bearer from "@elysiajs/bearer";
import swagger from "@elysiajs/swagger";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { version } from "../package.json";
import { config } from "../tracker.config";
import { db } from "./db";
import { users } from "./db/schema";

const UNPROTECTED_ROUTES = new Set(["GET /docs"]);
const DUAL_KEY_ROUTES = new Set([
  "GET /users/",
  "GET /users/usage/",
  "GET /users/usage/cost/",
]);

export const authMiddleware = new Elysia()
  .use(bearer())
  .onBeforeHandle(
    async ({ error, path, request: { method }, bearer }) => {
      if (
        UNPROTECTED_ROUTES.has(`${method.toUpperCase()} /${path.split("/")[1]}`)
      )
        return;

      const authorization = bearer as string | undefined;
      if (
        authorization &&
        DUAL_KEY_ROUTES.has(`${method.toUpperCase()} ${path}`)
      ) {
        const foundUser = await db.query.users.findFirst({
          where: eq(users.apiKey, authorization),
        });
        if (foundUser) return;
      }

      if (authorization !== config.masterKey)
        return error(401, {
          message: "API key is missing or invalid.",
        });
    },
  )
  .as("plugin");

export const swaggerMiddleware = swagger({
  path: "/docs",
  documentation: {
    info: {
      title: "Tracker",
      version,
      description:
        "Track your users' API usage across multiple services in a configurable manner.",
    },
    tags: [
      {
        name: "System",
        description: "Endpoints to manage and get data from Tracker itself.",
      },
      {
        name: "Services",
        description: "Endpoints to forward and track usage from API requests.",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
      responses: {
        Unauthorized: {
          description: "API key is missing or invalid.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    default: "API key is missing or invalid.",
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
});
