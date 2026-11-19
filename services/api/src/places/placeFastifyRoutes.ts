import type { FastifyPluginAsync } from "fastify";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { bindings } from "../routeHandlers";
import { registerPostRoute } from "../contract/registerPostRoute";
import {
	legacyPostRoute,
	legacyRoute,
	type ServiceContext,
} from "../contract/legacyHandler";
import {
	placesContract,
	postcodeBatchContract,
	postcodeContract,
} from "./placeContract";

export const placeFastifyRoutes: FastifyPluginAsync<{
	context: ServiceContext;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	for (const [contract, binding] of [
		[placesContract, bindings.places],
		[postcodeContract, bindings.postcodes],
	] as const)
		registerGetRoute(
			app,
			context,
			contract,
			legacyRoute(context, binding),
			dispatch,
		);
	registerPostRoute(
		app,
		postcodeBatchContract,
		legacyPostRoute(context, bindings.postcodesBatch),
		dispatch,
	);
};
