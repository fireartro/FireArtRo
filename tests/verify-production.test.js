import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { verifyProduction } from "../scripts/verify-production.mjs";


async function withServer(responses, run) {
  const server = http.createServer((request, response) => {
    const value = responses[request.url] || {
      status: 404,
      type: "text/plain",
      body: "Not found",
    };
    response.writeHead(value.status || 200, { "content-type": value.type });
    response.end(value.body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previous = process.env.FIREARTRO_BASE_URL;
  process.env.FIREARTRO_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.FIREARTRO_BASE_URL;
    else process.env.FIREARTRO_BASE_URL = previous;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}


const validResponses = {
  "/": { type: "text/html", body: '<main id="root"></main>' },
  "/api/health": {
    type: "application/json",
    body: JSON.stringify({
      status: "ready",
      configuration_errors: [],
      database: "ready",
      indexes: "ready",
    }),
  },
  "/api/sitemap.xml": {
    type: "application/xml",
    body: "<urlset><url><loc>https://fireart.ro/</loc></url></urlset>",
  },
  "/robots.txt": {
    type: "text/plain",
    body: "Sitemap: https://fireart.ro/api/sitemap.xml",
  },
};


test("production verifier accepts the complete public contract", async () => {
  await withServer(validResponses, async () => {
    await assert.doesNotReject(verifyProduction());
  });
});


test("production verifier fails when the API is not ready", async () => {
  await withServer({
    ...validResponses,
    "/api/health": {
      type: "application/json",
      body: JSON.stringify({
        status: "not_ready",
        configuration_errors: [],
        database: "unavailable",
        indexes: "not_ready",
      }),
    },
  }, async () => {
    await assert.rejects(verifyProduction(), /health check is not ready/i);
  });
});
