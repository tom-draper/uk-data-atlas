import cluster from "node:cluster";
import { createApiServer as createServer } from "../../src/apiServer";
import { atlasRelease, testContext } from "../routeFixtures";

export const readApiCatalogues = () => testContext({ atlasRelease });

export const createApiServer: typeof createServer = (catalogues, options) => {
	const server = createServer(catalogues, options);
	const worker = cluster.worker?.id ?? 0;
	for (let index = 0; index < worker; index++)
		server.metrics.observe({
			route: "/fixture",
			method: "GET",
			status: 200,
			durationSeconds: worker / 100,
			bytes: worker * 10,
		});
	server.prependListener("request", (_, response) => {
		response.setHeader("x-fixture-worker", worker);
		response.setHeader("x-fixture-pid", process.pid);
	});
	return server;
};
