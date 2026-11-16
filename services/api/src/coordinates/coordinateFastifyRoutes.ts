import type { FastifyPluginAsync } from "fastify";
import type { RouteContextFor } from "../runtime/index.ts";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { legacyHandler } from "../contract/legacyHandler";
import { handleCoordinateRoutes } from "./coordinateRoutes";
import { coordinateContract } from "./coordinateContract";

export const coordinateFastifyRoutes: FastifyPluginAsync<{
	context: RouteContextFor<never>;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	registerGetRoute(
		app,
		context,
		coordinateContract,
		legacyHandler(context, handleCoordinateRoutes),
		dispatch,
	);
};
