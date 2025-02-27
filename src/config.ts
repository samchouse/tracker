import type { Static, TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { t } from "elysia";

const schema = t.Object({
  host: t.String(),
  port: t.Number(),
  masterKey: t.String(),
  dbFileName: t.String(),
  taxRate: t.Number(),
  services: t.Array(
    t.Object({
      name: t.String(),
      api: t.String({ format: "uri" }),
      key: t.String(),
      prefix: t.String(),
      endpoints: t.Array(
        t.Object({
          path: t.String(),
          method: t.Union([
            t.Literal("GET"),
            t.Literal("POST"),
            t.Literal("ALL"),
          ]),
          pricing: t.Union([
            t.Object({
              type: t.Literal("fixed"),
              cost: t.Number(),
            }),
            t.Object({
              type: t.Literal("dynamic"),
              calculate: t.Function(
                [
                  t.Object({
                    request: t.Unsafe<Request>(),
                    response: t.Unsafe<Response>(),
                  }),
                ],
                t.Promise(t.Number()),
              ),
            }),
          ]),
        }),
      ),
    }),
  ),
  extraCosts: t.Optional(
    t.Array(
      t.Object({
        name: t.String(),
        prefix: t.String(),
        addTaxes: t.Boolean(),
        fetch: t.Function(
          [
            t.Object({
              from: t.Date(),
              to: t.Date(),
              user: t.String(),
            }),
          ],
          t.Promise(t.Number()),
        ),
      }),
    ),
  ),
});

export function defineConfig(config: Static<typeof schema>) {
  return Value.Parse(schema, config);
}

export function defineEnv<T extends TSchema>(definition: T): Static<T> {
  return Value.Parse(definition, process.env);
}

export { t };
export { Parse as parse } from "@sinclair/typebox/value";
