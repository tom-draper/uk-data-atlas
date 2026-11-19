import { bindings } from "../routeHandlers";
import type { FastifyPluginAsync } from "fastify";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { legacyRoute, type ServiceContext } from "../contract/legacyHandler";
import {
	locationAlternativesContract,
	locationComparisonContract,
	locationContract,
	locationGeometryContract,
	locationMembersContract,
	locationParentsContract,
	locationsContract,
} from "./locationContract";

export const locationFastifyRoutes: FastifyPluginAsync<{
	context: ServiceContext;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	for (const contract of [
		locationsContract,
		locationAlternativesContract,
		locationContract,
		locationComparisonContract,
		locationGeometryContract,
		locationMembersContract,
		locationParentsContract,
	])
		registerGetRoute(
			app,
			context,
			contract,
			legacyRoute(context, bindings.locations),
			dispatch,
		);
};
