import type { FastifyPluginAsync } from "fastify";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { legacyRoute, type ServiceContext } from "../contract/legacyHandler";
import { bindings } from "../routeHandlers";
import {
	analysisGeographiesContract,
	analysisPlanContract,
} from "./analysisContract";

export const analysisFastifyRoutes: FastifyPluginAsync<{
	context: ServiceContext;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	const answer = legacyRoute(context, bindings.analysisGeographies);
	registerGetRoute(
		app,
		context,
		analysisGeographiesContract,
		answer,
		dispatch,
	);
	registerGetRoute(app, context, analysisPlanContract, answer, dispatch);
};
