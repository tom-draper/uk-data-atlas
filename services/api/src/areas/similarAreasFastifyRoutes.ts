import type { FastifyPluginAsync } from "fastify";
import type {
	RouteContextFor,
	RouteDispatchContext,
} from "@uk-data-atlas/atlas-runtime/api";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { route } from "../routes";
import { similarAreasContract } from "./similarAreasContract";

export const similarAreasFastifyRoutes: FastifyPluginAsync<{
	context: RouteContextFor<never> & Partial<RouteDispatchContext>;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	registerGetRoute(
		app,
		context,
		similarAreasContract,
		(request) => {
			if (
				!context.geographyResolver ||
				!context.areaValidation ||
				!context.postcodes
			)
				throw new Error("Geography services are unavailable");
			return route("GET", request.url, {
				...context,
				geographyResolver: context.geographyResolver,
				areaValidation: context.areaValidation,
				postcodes: context.postcodes,
			});
		},
		dispatch,
	);
};
