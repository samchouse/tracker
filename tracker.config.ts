import * as jose from "jose";
import { Cookie } from "tough-cookie";
import { defineConfig, defineEnv, parse, t } from "./src/config";

const env = defineEnv(
  t.Object({
    MASTER_KEY: t.String(),
    DB_FILE_NAME: t.String(),

    TAVILY_KEY: t.String(),
    FREECURRENCYAPI_KEY: t.String(),

    LITELLM_URL: t.String({ format: "uri" }),
    LITELLM_USERNAME: t.String(),
    LITELLM_PASSWORD: t.String(),
  }),
);

export const config = defineConfig({
  masterKey: env.MASTER_KEY,
  dbFileName: env.DB_FILE_NAME,
  host: "localhost",
  port: 3000,
  services: [
    {
      name: "Tavily",
      api: "https://api.tavily.com",
      key: env.TAVILY_KEY,
      prefix: "/tavily",
      endpoints: [
        {
          method: "POST",
          path: "/search",
          pricing: {
            type: "dynamic",
            calculate: async ({ request }) => {
              const requestBodySchema = t.Object({
                search_depth: t.Union([
                  t.Literal("basic"),
                  t.Literal("advanced"),
                ]),
              });

              try {
                const json = parse(requestBodySchema, await request.json());
                return json.search_depth === "basic" ? 0.001 : 0.005;
              } catch (error) {
                return 0.05;
              }
            },
          },
        },
      ],
    },
  ],
  extraCosts: [
    {
      name: "LibreChat",
      prefix: "librechat/",
      fetch: async ({ from, to, user }) => {
        const loginReq = await fetch(`${env.LITELLM_URL}/login`, {
          method: "POST",
          redirect: "manual",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams([
            ["username", env.LITELLM_USERNAME],
            ["password", env.LITELLM_PASSWORD],
          ]).toString(),
        });

        let bearerKey: string | undefined;
        for (const c of loginReq.headers.getSetCookie()) {
          const potentialCookie = Cookie.parse(c);
          if (potentialCookie?.key === "token") {
            bearerKey = jose.decodeJwt(potentialCookie.value).key as
              | string
              | undefined;
          }
        }
        if (!bearerKey) return 0;

        const usageReq = await fetch(
          `${env.LITELLM_URL}/global/spend/end_users`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${bearerKey}`,
            },
            body: JSON.stringify({
              startTime: from.toISOString(),
              endTime: to.toISOString(),
            }),
          },
        );

        const usage: { end_user: string; total_spend: number }[] =
          await usageReq.json();
        const targetUsage =
          usage.find((u) => u.end_user === user)?.total_spend ?? 0;

        const conversionReq = await fetch(
          `https://api.freecurrencyapi.com/v1/latest?currencies=CAD&apikey=${env.FREECURRENCYAPI_KEY}`,
        );
        const conversion: { data: { CAD: number } } =
          await conversionReq.json();

        return targetUsage * conversion.data.CAD;
      },
    },
  ],
});
