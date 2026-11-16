import type { FastifyPluginAsync } from "fastify";
import type { RouteContextFor } from "../runtime/index.ts";
import {
	handleAtlasLookupRoutes,
	handleAtlasPageRoutes,
} from "../atlasAssetRoutes";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { legacyHandler } from "../contract/legacyHandler";
import { atlasLookupContract } from "./atlasLookupContract";
import { atlasPageContract } from "./atlasPageContract";

export const atlasAssetFastifyRoutes: FastifyPluginAsync<{
	context: RouteContextFor<never>;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	registerGetRoute(
		app,
		context,
		atlasLookupContract,
		legacyHandler(context, handleAtlasLookupRoutes),
		dispatch,
	);
	registerGetRoute(
		app,
		context,
		atlasPageContract,
		legacyHandler(context, handleAtlasPageRoutes),
		dispatch,
	);
};
