import type { FastifyPluginAsync } from "fastify";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import {
	legacyRoute,
	legacyRouteAsync,
	type ServiceContext,
} from "../contract/legacyHandler";
import {
	mapResourceArchiveContract,
	mapResourceContract,
	mapResourceFeaturesContract,
	mapResourceJoinContract,
	mapResourceTileContract,
	mapResourceTileJsonContract,
	mapResourcesContract,
} from "./mapResourceContract";

export const mapResourceFastifyRoutes: FastifyPluginAsync<{
	context: ServiceContext;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	for (const contract of [
		mapResourcesContract,
		mapResourceContract,
		mapResourceTileJsonContract,
		mapResourceTileContract,
		mapResourceJoinContract,
		mapResourceArchiveContract,
	])
		registerGetRoute(
			app,
			context,
			contract,
			legacyRoute(context),
			dispatch,
		);
	// A full-detail download may wait for the file to be built.
	registerGetRoute(
		app,
		context,
		mapResourceFeaturesContract,
		legacyRouteAsync(context),
		dispatch,
	);
};
