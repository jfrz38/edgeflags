import { pathToFileURL } from "node:url";

const environments = new Set(["dev", "prod"]);

export async function manageAccessServiceToken({
  action,
  environment,
  accountId,
  apiToken,
  serviceTokenId,
  fetch: fetchRequest = globalThis.fetch,
  now = () => Date.now(),
}) {
  if (!environments.has(environment)) {
    throw new Error("Environment must be one of: dev, prod");
  }
  if (!/^[0-9a-f]{32}$/.test(accountId ?? "")) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required");
  }
  if (!apiToken) throw new Error("CLOUDFLARE_API_TOKEN is required");

  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/service_tokens`;
  let url = baseUrl;
  let body;

  if (action === "create") {
    body = {
      name: `edgeflags-${environment}-smoke`,
      duration: "8760h",
    };
  } else if (action === "rotate") {
    if (!/^[0-9a-f-]{36}$/.test(serviceTokenId ?? "")) {
      throw new Error("ACCESS_SERVICE_TOKEN_ID is required for rotation");
    }
    url = `${baseUrl}/${serviceTokenId}/rotate`;
    body = {
      previous_client_secret_expires_at: new Date(
        now() + 24 * 60 * 60 * 1_000,
      ).toISOString(),
    };
  } else {
    throw new Error("Action must be create or rotate");
  }

  const response = await fetchRequest(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();

  if (!response.ok || payload.success !== true) {
    throw new Error(`Cloudflare rejected Access token ${action}`);
  }

  const result = payload.result;
  if (!result?.id || !result.client_id || !result.client_secret) {
    throw new Error("Cloudflare returned an incomplete Access token");
  }

  return {
    id: result.id,
    clientId: result.client_id,
    clientSecret: result.client_secret,
    expiresAt: result.expires_at,
    previousClientSecretExpiresAt: result.previous_client_secret_expires_at,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.GITHUB_ACTIONS === "true") {
    throw new Error("Access Service Token bootstrap must run from a trusted terminal");
  }

  const result = await manageAccessServiceToken({
    action: process.argv[2],
    environment: process.argv[3],
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    serviceTokenId: process.env.ACCESS_SERVICE_TOKEN_ID,
  });

  console.log("Store these values immediately; the client secret is shown once:");
  console.log(`ACCESS_SERVICE_TOKEN_ID=${result.id}`);
  console.log(`ACCESS_CLIENT_ID=${result.clientId}`);
  console.log(`ACCESS_CLIENT_SECRET=${result.clientSecret}`);
  console.log(`ACCESS_TOKEN_EXPIRES_AT=${result.expiresAt}`);
  if (result.previousClientSecretExpiresAt) {
    console.log(
      `PREVIOUS_ACCESS_SECRET_EXPIRES_AT=${result.previousClientSecretExpiresAt}`,
    );
  }
}
