import type { FastifyPluginAsync } from "fastify";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { legacyRoute, type ServiceContext } from "../contract/legacyHandler";
import {
	analysisGeographiesContract,
	analysisPlanContract,
} from "./analysisContract";

export const analysisFastifyRoutes: FastifyPluginAsync<{
	context: ServiceContext;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	const answer = legacyRoute(context);
	registerGetRoute(
		app,
		context,
		analysisGeographiesContract,
		answer,
		dispatch,
	);
	registerGetRoute(app, context, analysisPlanContract, answer, dispatch);
};
