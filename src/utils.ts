import { init } from "@paralleldrive/cuid2";
import { config } from "../tracker.config";

export const generateKey = init({
  length: 60,
});

export async function redirectRequest({
  key,
  request,
  to: { api, path },
}: {
  key: typeof config.services[number]["key"];
  request: Request;
  to: { api: string; path: string };
}) {
  const newUrl = new URL(request.url);

  const apiUrl = new URL(api);
  newUrl.protocol = apiUrl.protocol;
  newUrl.port = apiUrl.port;
  newUrl.host = apiUrl.host;
  newUrl.pathname = apiUrl.pathname + path;

  const headers = new Headers(request.headers);
  headers.delete("host");
  if (typeof key === "string")
    headers.set("Authorization", `Bearer ${key}`);
  else {
    headers.delete("Authorization");
    if (key.location === "query")
      newUrl.searchParams.set(key.name, key.value);
  }

  return fetch(newUrl, {
    method: request.method,
    body: request.body,
    redirect: request.redirect,
    mode: request.mode,
    keepalive: request.keepalive,
    integrity: request.integrity,
    credentials: request.credentials,
    headers,
  });
}

export function round(value: number, decimals = 2) {
  const multiplier = 10 ** decimals;
  return Math.ceil((value + Number.EPSILON) * multiplier) / multiplier;
}
