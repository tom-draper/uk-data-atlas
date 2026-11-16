import type { FastifyPluginAsync } from "fastify";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { registerPostRoute } from "../contract/registerPostRoute";
import {
	legacyPostRoute,
	legacyRoute,
	type ServiceContext,
} from "../contract/legacyHandler";
import {
	areaContainsBatchContract,
	areaContainsContract,
	areaIntersectsContract,
	areaNearContract,
	areaValidateContract,
	areaValidatePostContract,
	areasContract,
} from "./areaCollectionContract";

export const areaCollectionFastifyRoutes: FastifyPluginAsync<{
	context: ServiceContext;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	for (const contract of [
		areasContract,
		areaIntersectsContract,
		areaContainsContract,
		areaNearContract,
		areaValidateContract,
	])
		registerGetRoute(
			app,
			context,
			contract,
			legacyRoute(context),
			dispatch,
		);
	for (const contract of [
		areaValidatePostContract,
		areaContainsBatchContract,
	])
		registerPostRoute(app, contract, legacyPostRoute(context), dispatch);
};
