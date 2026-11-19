import { bindings } from "../routeHandlers";
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
	for (const [contract, binding] of [
		[areasContract, bindings.areaSearch],
		[areaIntersectsContract, bindings.areaIntersects],
		[areaContainsContract, bindings.areaContains],
		[areaNearContract, bindings.areaNear],
		[areaValidateContract, bindings.areaValidation],
	] as const)
		registerGetRoute(
			app,
			context,
			contract,
			legacyRoute(context, binding),
			dispatch,
		);
	for (const [contract, binding] of [
		[areaValidatePostContract, bindings.areaValidation],
		[areaContainsBatchContract, bindings.areaContainsBatch],
	] as const)
		registerPostRoute(
			app,
			contract,
			legacyPostRoute(context, binding),
			dispatch,
		);
};
