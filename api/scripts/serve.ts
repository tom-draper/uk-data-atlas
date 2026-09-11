import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApiServer, readBoundaryRegistry } from "../src/server";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registry = readBoundaryRegistry(apiRoot);
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
	throw new Error("PORT must be an integer between 1 and 65535");
}

createApiServer(registry).listen(port, host, () => {
	console.log(`UK Data Atlas API listening at http://${host}:${port}/v1`);
});
