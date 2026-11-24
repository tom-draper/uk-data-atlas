import type {
	FastifyInstance,
	FastifyPluginAsync,
	FastifyReply,
	FastifyRequest,
} from "fastify";
import { analysisFastifyRoutes } from "./analysis/analysisFastifyRoutes";
import { areaCollectionFastifyRoutes } from "./areas/areaCollectionFastifyRoutes";
import { areaDetailFastifyRoutes } from "./areas/areaDetailFastifyRoutes";
import { similarAreasFastifyRoutes } from "./areas/similarAreasFastifyRoutes";
import { atlasAssetFastifyRoutes } from "./atlas/atlasAssetFastifyRoutes";
import { attributionFastifyRoutes } from "./attribution/attributionFastifyRoutes";
import { boundaryFastifyRoutes } from "./boundaries/boundaryFastifyRoutes";
import { releaseJoinFastifyRoutes } from "./boundaries/releaseJoinFastifyRoutes";
import { bulkFastifyRoutes } from "./bulk/bulkFastifyRoutes";
import { catalogueFastifyRoutes } from "./catalogue/catalogueFastifyRoutes";
import { atlasReleaseRoutes } from "./contract/atlasReleaseRoutes";
import { documentationRoutes } from "./contract/documentationRoutes";
import { collectOwners } from "./contract/fallbackRoutes";
import { legacyPostRoute } from "./contract/legacyHandler";
import type { ContractDispatch } from "./contract/registerGetRoute";
import { rootRoutes } from "./contract/rootRoutes";
import { coordinateFastifyRoutes } from "./coordinates/coordinateFastifyRoutes";
import { crosswalkFastifyRoutes } from "./crosswalks/crosswalkFastifyRoutes";
import { translationFastifyRoutes } from "./crosswalks/translationFastifyRoutes";
import { dataFastifyRoutes } from "./data/dataFastifyRoutes";
import { measureExportRoutes } from "./data/measureExportRoutes";
import { documentFastifyRoutes } from "./documents/documentFastifyRoutes";
import { mapResourceFastifyRoutes } from "./mapResources/mapResourceFastifyRoutes";
import { locationFastifyRoutes } from "./places/locationFastifyRoutes";
import { placeFastifyRoutes } from "./places/placeFastifyRoutes";
import { relationshipsFastifyRoutes } from "./relationships/relationshipsFastifyRoutes";
import type { RouteContext } from "./runtime/index.ts";
import { terrainFastifyRoutes } from "./terrain/terrainFastifyRoutes";

const routePlugins: ReadonlyArray<
	FastifyPluginAsync<{ context: RouteContext; dispatch: ContractDispatch }>
> = [
	documentationRoutes,
	rootRoutes,
	atlasReleaseRoutes,
	catalogueFastifyRoutes,
	boundaryFastifyRoutes,
	similarAreasFastifyRoutes,
	documentFastifyRoutes,
	atlasAssetFastifyRoutes,
	coordinateFastifyRoutes,
	translationFastifyRoutes,
	attributionFastifyRoutes,
	analysisFastifyRoutes,
	relationshipsFastifyRoutes,
	releaseJoinFastifyRoutes,
	bulkFastifyRoutes,
	terrainFastifyRoutes,
	crosswalkFastifyRoutes,
	placeFastifyRoutes,
	locationFastifyRoutes,
	areaCollectionFastifyRoutes,
	areaDetailFastifyRoutes,
	dataFastifyRoutes,
	mapResourceFastifyRoutes,
	measureExportRoutes,
];

export function registerApiRoutes(
	app: FastifyInstance,
	context: RouteContext,
	dispatch: (
		request: FastifyRequest,
		reply: FastifyReply,
		handle?: Parameters<ContractDispatch>[2],
	) => Promise<unknown>,
) {
	const ownerOf = collectOwners(app);
	app.setNotFoundHandler((request, reply) => {
		const owner = ownerOf(request.url.split("?")[0]!);
		if (!owner) return dispatch(request, reply);
		const answer = legacyPostRoute(context, owner);
		return dispatch(request, reply, (body) => answer(request, body));
	});
	for (const plugin of routePlugins)
		void app.register(plugin, { prefix: "/v1", context, dispatch });
}
