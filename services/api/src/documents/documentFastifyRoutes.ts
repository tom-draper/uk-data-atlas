import type { FastifyPluginAsync } from "fastify";
import type { RouteContextFor } from "../runtime/index.ts";
import { bindings } from "../routeHandlers";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { legacyHandler } from "../contract/legacyHandler";
import { documentContract } from "./documentContract";

export const documentFastifyRoutes: FastifyPluginAsync<{
	context: RouteContextFor<never>;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	registerGetRoute(
		app,
		context,
		documentContract,
		legacyHandler(context, bindings.documents),
		dispatch,
	);
};
