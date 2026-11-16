import type { FastifyPluginAsync } from "fastify";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
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
	for (const contract of [placesContract, postcodeContract])
		registerGetRoute(
			app,
			context,
			contract,
			legacyRoute(context),
			dispatch,
		);
	registerPostRoute(
		app,
		postcodeBatchContract,
		legacyPostRoute(context),
		dispatch,
	);
};
