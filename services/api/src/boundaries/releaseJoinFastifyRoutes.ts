import type { FastifyPluginAsync } from "fastify";
import type { ContractDispatch } from "../contract/registerGetRoute";
import { registerPostRoute } from "../contract/registerPostRoute";
import {
	legacyPostRoute,
	type ServiceContext,
} from "../contract/legacyHandler";
import { releaseJoinContract } from "./releaseJoinContract";

export const releaseJoinFastifyRoutes: FastifyPluginAsync<{
	context: ServiceContext;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	registerPostRoute(
		app,
		releaseJoinContract,
		legacyPostRoute(context),
		dispatch,
	);
};
