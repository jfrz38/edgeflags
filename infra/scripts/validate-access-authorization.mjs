import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const defaultAttempts = 5;
const defaultDelayMilliseconds = 1_000;

function assertBaseUrl(value) {
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error("Access validation BASE_URL must use HTTPS");
  }

  return url;
}

function accessHeaders(clientId, clientSecret, clientName) {
  if (!clientId || !clientSecret) {
    throw new Error(`${clientName} Access client ID and client secret are required`);
  }

  return {
    "CF-Access-Client-Id": clientId,
    "CF-Access-Client-Secret": clientSecret,
  };
}

async function responseJson(response, operation) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${operation} returned a non-JSON response`);
  }
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

async function assertForbidden(response, operation) {
  const body = await responseJson(response, operation);
  if (response.status !== 403 || body.error?.code !== "FORBIDDEN") {
    throw new Error(`${operation} was not forbidden; status ${response.status}`);
  }
}

export async function validateAccessAuthorization({
  baseUrl,
  fullAccessClientId,
  fullAccessClientSecret,
  limitedAccessClientId,
  limitedAccessClientSecret,
  fetch: fetchRequest = globalThis.fetch,
  key = `access-validation-${randomUUID()}`,
  attempts = defaultAttempts,
  delayMilliseconds = defaultDelayMilliseconds,
  sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const rootUrl = assertBaseUrl(baseUrl);
  const fullHeaders = accessHeaders(
    fullAccessClientId,
    fullAccessClientSecret,
    "Full-scope",
  );
  const limitedHeaders = accessHeaders(
    limitedAccessClientId,
    limitedAccessClientSecret,
    "Limited-scope",
  );
  const flagUrl = new URL(`/flags/${key}`, rootUrl);
  const evaluationUrl = new URL(`/evaluate/${key}`, rootUrl);
  let cleanupRequired = false;
  let primaryError;

  try {
    const healthResponse = await fetchRequest(rootUrl);
    const health = await responseJson(healthResponse, "Public health check");
    if (
      healthResponse.status !== 200 ||
      health.service !== "edgeflags" ||
      health.status !== "ok"
    ) {
      throw new Error(`Public health check failed with status ${healthResponse.status}`);
    }

    const unauthenticatedResponse = await fetchRequest(flagUrl);
    if (unauthenticatedResponse.status !== 401) {
      throw new Error(
        `Unauthenticated protected request returned status ${unauthenticatedResponse.status}`,
      );
    }

    cleanupRequired = true;
    const createResponse = await fetchRequest(flagUrl, {
      method: "PUT",
      headers: {
        ...fullHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    });
    if (createResponse.status !== 201) {
      throw new Error(`Full-scope flag creation failed with status ${createResponse.status}`);
    }

    await retry(
      async () => {
        const response = await fetchRequest(flagUrl, { headers: limitedHeaders });
        const body = await responseJson(response, "Limited-scope flag read");
        if (response.status !== 200 || body.key !== key || body.enabled !== true) {
          throw new Error(`Limited-scope flag read failed with status ${response.status}`);
        }
      },
      attempts,
      () => sleep(delayMilliseconds),
    );

    await assertForbidden(
      await fetchRequest(flagUrl, {
        method: "PUT",
        headers: {
          ...limitedHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: false }),
      }),
      "Limited-scope flag replacement",
    );
    await assertForbidden(
      await fetchRequest(evaluationUrl, { headers: limitedHeaders }),
      "Limited-scope flag evaluation",
    );
    await assertForbidden(
      await fetchRequest(flagUrl, {
        method: "DELETE",
        headers: limitedHeaders,
      }),
      "Limited-scope flag deletion",
    );

    const unchangedResponse = await fetchRequest(flagUrl, {
      headers: limitedHeaders,
    });
    const unchanged = await responseJson(
      unchangedResponse,
      "Flag read after denied operations",
    );
    if (
      unchangedResponse.status !== 200 ||
      unchanged.key !== key ||
      unchanged.enabled !== true
    ) {
      throw new Error("Denied operations changed the validation flag");
    }

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
              headers: fullHeaders,
            });
            if (response.status !== 204) {
              throw new Error(
                `Access validation cleanup failed with status ${response.status}`,
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
  const { key } = await validateAccessAuthorization({
    baseUrl: process.env.BASE_URL,
    fullAccessClientId: process.env.ACCESS_CLIENT_ID,
    fullAccessClientSecret: process.env.ACCESS_CLIENT_SECRET,
    limitedAccessClientId: process.env.LIMITED_ACCESS_CLIENT_ID,
    limitedAccessClientSecret: process.env.LIMITED_ACCESS_CLIENT_SECRET,
  });
  console.log(`Remote Access authorization validation passed and cleaned up flag ${key}`);
}
