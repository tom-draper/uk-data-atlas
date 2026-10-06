import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApiServer, readApiCatalogues } from "../src/server";
import { DEFAULT_POSTCODE_GEOGRAPHIES } from "../src/postcodeRoutes";
import {
	errorFields,
	jsonLog,
	readServeConfiguration,
} from "../src/serverOptions";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const log = jsonLog();
const configuration = readServeConfiguration(process.env, log);

// An exception outside a request leaves the process in an unknown state, so it
// is logged where the request failures are and the process ends for its
// supervisor to restart.
process.on("uncaughtException", (error) => {
	log({
		level: "error",
		event: "process.uncaught",
		error: errorFields(error),
	});
	process.exit(1);
});
process.on("unhandledRejection", (reason) => {
	log({
		level: "error",
		event: "process.unhandled",
		error: errorFields(reason),
	});
	process.exit(1);
});

const loading = performance.now();
const catalogues = readApiCatalogues(apiRoot, {
	geometryCacheReleases: configuration.geometryCacheReleases,
	terrainRemoteEndpoint: configuration.terrainRemoteEndpoint,
	terrainCoverageEndpoint: configuration.terrainCoverageEndpoint,
	terrainRemoteTimeoutMs: configuration.terrainRemoteTimeoutMs,
	terrainRemoteConcurrency: configuration.terrainRemoteConcurrency,
});
// A postcode lookup without an explicit geography reads these three releases.
// Warm their compact store metadata and prebuilt spatial indexes before this
// process starts listening, so readiness never advertises a cold first lookup.
catalogues.geographyResolver.warmGeometryReleases(
	DEFAULT_POSTCODE_GEOGRAPHIES.flatMap((geography) => {
		const selected = catalogues.geographyResolver.selectReleaseForDate(
			geography,
			"9999-12",
		);
		return selected?.status === "selected"
			? [[geography, selected.selected.id] as const]
			: [];
	}),
);
const server = createApiServer(catalogues, configuration.server);

server.listen(configuration.port, configuration.host, () => {
	log({
		level: "info",
		event: "server.listening",
		url: `http://${configuration.host}:${configuration.port}/v1`,
		atlasRelease: catalogues.atlasRelease.releaseId,
		loadSeconds: Math.round(performance.now() - loading) / 1000,
		rateLimit: configuration.server.rateLimit ?? null,
		geometryCacheReleases: configuration.geometryCacheReleases,
		metrics:
			configuration.server.metrics === undefined
				? "off"
				: configuration.server.metrics === "open"
					? "open"
					: "token",
	});
});

// On SIGTERM the server reports not ready, stops accepting connections and
// finishes the requests it holds. Whatever is still open after the grace
// period is closed, so a stuck client cannot hold up a deployment.
const shutdown = (signal: string) => {
	log({ level: "info", event: "server.draining", signal });
	server.beginDrain();
	server.close(() => {
		log({ level: "info", event: "server.closed" });
		process.exit(0);
	});
	setTimeout(() => {
		server.closeAllConnections();
		log({ level: "warn", event: "server.forced-close" });
		process.exit(0);
	}, configuration.shutdownGraceSeconds * 1000).unref();
};
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
