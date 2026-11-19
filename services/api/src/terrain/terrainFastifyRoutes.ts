import type { FastifyPluginAsync } from "fastify";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { bindings } from "../routeHandlers";
import {
	legacyRouteAsync,
	type ServiceContext,
} from "../contract/legacyHandler";
import {
	terrainCatalogueContract,
	terrainPointContract,
	terrainProductContract,
} from "./terrainContract";

export const terrainFastifyRoutes: FastifyPluginAsync<{
	context: ServiceContext;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	for (const contract of [
		terrainCatalogueContract,
		terrainProductContract,
		terrainPointContract,
	])
		registerGetRoute(
			app,
			context,
			contract,
			legacyRouteAsync(context, bindings.terrain),
			dispatch,
		);
};
