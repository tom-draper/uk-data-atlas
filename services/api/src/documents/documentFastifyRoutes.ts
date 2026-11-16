import type { FastifyPluginAsync } from "fastify";
import type { RouteContextFor } from "../runtime/index.ts";
import { handleDocumentRoutes } from "./documentRoutes";
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
		legacyHandler(context, handleDocumentRoutes),
		dispatch,
	);
};
