import { bindings } from "../routeHandlers";
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
	for (const [contract, binding] of [
		[areaContract, bindings.areaIdentity],
		[areaRelationshipsContract, bindings.areaRelationships],
		[areaHistoryContract, bindings.areaHistory],
		[areaParentsContract, bindings.areaRelationships],
		[areaChildrenContract, bindings.areaRelationships],
		[areaChildrenGeometryContract, bindings.areaChildGeometry],
		[areaNeighboursContract, bindings.areaNeighbours],
		[areaOverlapContract, bindings.areaOverlap],
		[areaGeometryContract, bindings.areaGeometry],
	] as const)
		registerGetRoute(
			app,
			context,
			contract,
			legacyRoute(context, binding),
			dispatch,
		);
};
