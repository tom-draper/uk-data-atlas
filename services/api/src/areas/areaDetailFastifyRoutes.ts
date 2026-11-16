import type { FastifyPluginAsync } from "fastify";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { legacyRoute, type ServiceContext } from "../contract/legacyHandler";
import {
	areaChildrenContract,
	areaChildrenGeometryContract,
	areaContract,
	areaGeometryContract,
	areaHistoryContract,
	areaNeighboursContract,
	areaOverlapContract,
	areaParentsContract,
	areaRelationshipsContract,
} from "./areaDetailContract";

export const areaDetailFastifyRoutes: FastifyPluginAsync<{
	context: ServiceContext;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	for (const contract of [
		areaContract,
		areaRelationshipsContract,
		areaHistoryContract,
		areaParentsContract,
		areaChildrenContract,
		areaChildrenGeometryContract,
		areaNeighboursContract,
		areaOverlapContract,
		areaGeometryContract,
	])
		registerGetRoute(
			app,
			context,
			contract,
			legacyRoute(context),
			dispatch,
		);
};
