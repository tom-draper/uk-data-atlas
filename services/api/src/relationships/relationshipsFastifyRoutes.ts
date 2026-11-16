import type { FastifyPluginAsync } from "fastify";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { legacyRoute, type ServiceContext } from "../contract/legacyHandler";
import { relationshipsContract } from "./relationshipsContract";

export const relationshipsFastifyRoutes: FastifyPluginAsync<{
	context: ServiceContext;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	registerGetRoute(
		app,
		context,
		relationshipsContract,
		legacyRoute(context),
		dispatch,
	);
};
