import { mkdir, writeFile } from "node:fs/promises";

const endpoint = process.env.OPENPARTY_OPENAPI_URL || "http://localhost:4000/api/openapi";
const outputPath = "shared/openapi/openapi.json";

const response = await fetch(endpoint, {
  headers: {
    accept: "application/json"
  }
});

if (!response.ok) {
  throw new Error(`Failed to fetch OpenAPI spec from ${endpoint}: ${response.status} ${response.statusText}`);
}

const spec = await response.text();
await mkdir("shared/openapi", { recursive: true });
await writeFile(outputPath, spec, "utf8");

console.log(`Saved OpenAPI spec to ${outputPath}`);
