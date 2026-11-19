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
	crosswalkConvertContract,
	crosswalkDetailContract,
	crosswalkRecordsContract,
	crosswalksContract,
} from "./crosswalkContract";

export const crosswalkFastifyRoutes: FastifyPluginAsync<{
	context: ServiceContext;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	for (const contract of [
		crosswalksContract,
		crosswalkDetailContract,
		crosswalkRecordsContract,
	])
		registerGetRoute(
			app,
			context,
			contract,
			legacyRoute(context, bindings.crosswalks),
			dispatch,
		);
	registerPostRoute(
		app,
		crosswalkConvertContract,
		legacyPostRoute(context, bindings.crosswalkConversion),
		dispatch,
	);
};
