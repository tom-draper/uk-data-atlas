import { bindings } from "../routeHandlers";
import type { FastifyPluginAsync } from "fastify";
import {
	registerGetRoute,
	type ContractDispatch,
} from "../contract/registerGetRoute";
import { legacyRoute, type ServiceContext } from "../contract/legacyHandler";
import {
	dataChangeContract,
	dataCompareContract,
	dataConvertContract,
	dataObservationsContract,
	dataRankingsContract,
	dataSeriesContract,
	dataValueContract,
} from "./dataContract";

export const dataFastifyRoutes: FastifyPluginAsync<{
	context: ServiceContext;
	dispatch?: ContractDispatch;
}> = async (app, { context, dispatch }) => {
	for (const [contract, binding] of [
		[dataObservationsContract, bindings.data],
		[dataConvertContract, bindings.dataConversion],
		[dataSeriesContract, bindings.dataSeries],
		[dataRankingsContract, bindings.dataRankings],
		[dataValueContract, bindings.dataValue],
		[dataChangeContract, bindings.dataChange],
		[dataCompareContract, bindings.dataTransforms],
	] as const)
		registerGetRoute(
			app,
			context,
			contract,
			legacyRoute(context, binding),
			dispatch,
		);
};
