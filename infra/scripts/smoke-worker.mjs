import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const defaultAttempts = 5;
const defaultDelayMilliseconds = 1_000;

function assertBaseUrl(value) {
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error("Smoke-test BASE_URL must use HTTPS");
  }

  return url;
}

function accessHeaders(clientId, clientSecret) {
  if (clientId === undefined && clientSecret === undefined) return {};
  if (!clientId || !clientSecret) {
    throw new Error("Both Access client ID and client secret are required");
  }

  return {
    "CF-Access-Client-Id": clientId,
    "CF-Access-Client-Secret": clientSecret,
  };
}

async function responseJson(response, operation) {
  let body;

  try {
    body = await response.json();
  } catch {
    throw new Error(`${operation} returned a non-JSON response`);
  }

  return body;
}

async function retry(operation, attempts, delay) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay();
    }
  }

  throw lastError;
}

export async function smokeWorker({
  baseUrl,
  fetch: fetchRequest = globalThis.fetch,
  key = `smoke-${randomUUID()}`,
  attempts = defaultAttempts,
  delayMilliseconds = defaultDelayMilliseconds,
  sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  accessClientId,
  accessClientSecret,
  requireAccess = false,
} = {}) {
  const rootUrl = assertBaseUrl(baseUrl);
  const authenticationHeaders = accessHeaders(accessClientId, accessClientSecret);
  const flagUrl = new URL(`/flags/${key}`, rootUrl);
  const evaluationUrl = new URL(`/evaluate/${key}`, rootUrl);
  let cleanupRequired = false;
  let primaryError;

  try {
    const healthResponse = await fetchRequest(rootUrl, {
      headers: {},
    });
    const health = await responseJson(healthResponse, "Health check");
    if (
      healthResponse.status !== 200 ||
      health.service !== "edgeflags" ||
      health.status !== "ok"
    ) {
      throw new Error(`Health check failed with status ${healthResponse.status}`);
    }

    if (requireAccess) {
      const unauthenticatedResponse = await fetchRequest(flagUrl);
      if (unauthenticatedResponse.status !== 401) {
        throw new Error(
          `Unauthenticated protected request returned ${unauthenticatedResponse.status} instead of 401`,
        );
      }
    }

    cleanupRequired = true;
    const createResponse = await fetchRequest(flagUrl, {
      method: "PUT",
      headers: {
        ...authenticationHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    });
    if (createResponse.status !== 201) {
      throw new Error(`Flag creation failed with status ${createResponse.status}`);
    }

    await retry(
      async () => {
        const response = await fetchRequest(flagUrl, {
          headers: authenticationHeaders,
        });
        const body = await responseJson(response, "Flag read");
        if (response.status !== 200 || body.key !== key || body.enabled !== true) {
          throw new Error(`Flag read failed with status ${response.status}`);
        }
      },
      attempts,
      () => sleep(delayMilliseconds),
    );

    await retry(
      async () => {
        const response = await fetchRequest(evaluationUrl, {
          headers: authenticationHeaders,
        });
        const body = await responseJson(response, "Flag evaluation");
        if (response.status !== 200 || body.key !== key || body.value !== true) {
          throw new Error(`Flag evaluation failed with status ${response.status}`);
        }
      },
      attempts,
      () => sleep(delayMilliseconds),
    );

    return { key };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (cleanupRequired) {
      try {
        await retry(
          async () => {
            const response = await fetchRequest(flagUrl, {
              method: "DELETE",
              headers: authenticationHeaders,
            });
            if (response.status !== 204) {
              throw new Error(
                `Flag cleanup failed with status ${response.status}`,
              );
            }
          },
          attempts,
          () => sleep(delayMilliseconds),
        );
      } catch (cleanupError) {
        if (primaryError) throw new AggregateError([primaryError, cleanupError]);
        throw cleanupError;
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { key } = await smokeWorker({
    baseUrl: process.env.BASE_URL,
    accessClientId: process.env.ACCESS_CLIENT_ID,
    accessClientSecret: process.env.ACCESS_CLIENT_SECRET,
    requireAccess: process.env.REQUIRE_ACCESS === "true",
  });
  console.log(`Remote smoke test passed and cleaned up flag ${key}`);
}
