import { bindings } from "../routeHandlers";
import type { FastifyPluginAsync } from "fastify";
import type {
	RouteContextFor,
	RouteDispatchContext,
} from "../runtime/index.ts";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { legacyRoute } from "../contract/legacyHandler";
import { similarAreasContract } from "./similarAreasContract";

export const similarAreasFastifyRoutes: FastifyPluginAsync<{
	context: RouteContextFor<never> & Partial<RouteDispatchContext>;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	registerGetRoute(
		app,
		context,
		similarAreasContract,
		legacyRoute(context, bindings.similarAreas),
		dispatch,
	);
};
