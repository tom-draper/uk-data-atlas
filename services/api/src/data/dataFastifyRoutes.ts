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
	for (const contract of [
		dataObservationsContract,
		dataConvertContract,
		dataSeriesContract,
		dataRankingsContract,
		dataValueContract,
		dataChangeContract,
		dataCompareContract,
	])
		registerGetRoute(
			app,
			context,
			contract,
			legacyRoute(context),
			dispatch,
		);
};
