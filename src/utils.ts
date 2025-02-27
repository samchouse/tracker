import { init } from "@paralleldrive/cuid2";

export const generateKey = init({
  length: 60,
});

export async function redirectRequest({
  bearer,
  request,
  to: { api, path },
}: {
  bearer: string;
  request: Request;
  to: { api: string; path: string };
}) {
  const newUrl = new URL(request.url);

  const [protocol, host] = api.split("://");
  newUrl.protocol = `${protocol}://`;
  newUrl.port = "";
  newUrl.host = host;
  newUrl.pathname = path;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("Authorization", `Bearer ${bearer}`);

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
