import * as jose from "jose";
import { Cookie } from "tough-cookie";
import { defineConfig, defineEnv, parse, t } from "./src/config";

const env = defineEnv(
  t.Object({
    MASTER_KEY: t.String(),
    DB_FILE_NAME: t.String(),

    TAVILY_KEY: t.String(),
    YOUTUBE_API_KEY: t.String(),
    OPENWEATHER_APP_ID: t.String(),
    WOLFRAMALPHA_APP_ID: t.String(),
    FREECURRENCYAPI_KEY: t.String(),

    LITELLM_URL: t.String({ format: "uri" }),
    LITELLM_USERNAME: t.String(),
    LITELLM_PASSWORD: t.String(),
  }),
);

export const config = defineConfig({
  masterKey: env.MASTER_KEY,
  dbFileName: env.DB_FILE_NAME,
  host: "0.0.0.0",
  port: 3729,
  taxRate: 1.14975,
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
              const CREDIT_RATE = 0.0025;

              const requestBodySchema = t.Object({
                search_depth: t.Union([
                  t.Literal("basic"),
                  t.Literal("advanced"),
                ]),
              });

              try {
                const json = parse(requestBodySchema, await request.json());
                return CREDIT_RATE * (json.search_depth === "basic" ? 1 : 2);
              } catch (error) {
                return 0.05;
              }
            },
          },
        },
      ],
    },
    {
      name: "YouTube API",
      api: "https://www.googleapis.com",
      key: {
        location: "query",
        name: "key",
        value: env.YOUTUBE_API_KEY,
      },
      prefix: "/yt",
      endpoints: [
        {
          method: "GET",
          path: "/youtube/v3/search",
          pricing: {
            type: "fixed",
            cost: 0.001,
          },
        },
        {
          method: "GET",
          path: "/youtube/v3/videos",
          pricing: {
            type: "fixed",
            cost: 0.001,
          },
        },
        {
          method: "GET",
          path: "/youtube/v3/commentThreads",
          pricing: {
            type: "fixed",
            cost: 0.001,
          },
        },
      ],
    },
    {
      name: "OpenWeather",
      api: "https://api.openweathermap.org/data/3.0",
      key: {
        location: "query",
        name: "appid",
        value: env.OPENWEATHER_APP_ID,
      },
      prefix: "/weather",
      endpoints: [
        {
          method: "GET",
          path: "/onecall",
          pricing: {
            type: "fixed",
            cost: 0.001,
          },
        },
        {
          method: "GET",
          path: "/onecall/timemachine",
          pricing: {
            type: "fixed",
            cost: 0.001,
          },
        },
        {
          method: "GET",
          path: "/onecall/day_summary",
          pricing: {
            type: "fixed",
            cost: 0.001,
          },
        },
        {
          method: "GET",
          path: "/onecall/overview",
          pricing: {
            type: "fixed",
            cost: 0.001,
          },
        },
      ],
    },
    {
      name: "WolframAlpha",
      api: "https://www.wolframalpha.com/api/v1",
      key: {
        location: "query",
        name: "appid",
        value: env.WOLFRAMALPHA_APP_ID,
      },
      prefix: "/wolfram",
      endpoints: [
        {
          method: "GET",
          path: "/llm-api",
          pricing: {
            type: "fixed",
            cost: 0.001,
          },
          transformResponse: (response) => {
            response.headers.delete("content-encoding")
            return response
          }
        },
      ],
    },
  ],
  extraCosts: [
    {
      name: "LibreChat",
      prefix: "librechat/",
      addTaxes: true,
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
