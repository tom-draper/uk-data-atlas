import type {
	BoundaryGeojson,
	BrexitConstituencyDataset,
	BrexitLADDataset,
	GeneralElectionDataset,
	LocalElectionDataset,
} from "@lib/types";
import type { MapOptions } from "@lib/types/mapOptions";
import type { MapRenderContext } from "./context";

function renderElection(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: LocalElectionDataset | GeneralElectionDataset,
	mapOptions: MapOptions,
	type: "localElection" | "generalElection",
	isDark = false,
): void {
	const isLocal = type === "localElection";
	const options = isLocal
		? mapOptions.localElection
		: mapOptions.generalElection;

	const codeProp = ctx.codeProp(
		isLocal ? "ward" : "constituency",
		geojson.features,
	);

	const mode = options.mode || "majority";
	const dataMap = isLocal
		? (dataset as LocalElectionDataset).data
		: (dataset as GeneralElectionDataset).data;
	const resultsMap = isLocal
		? (dataset as LocalElectionDataset).results
		: (dataset as GeneralElectionDataset).results;

	const excluded = new Set(options.excluded ?? []);
	const getWinner =
		excluded.size > 0
			? (code: string) => {
					const votes = dataMap[code]?.partyVotes;
					if (!votes) return "NONE";
					let best = "NONE";
					let bestVotes = -1;
					for (const [party, v] of Object.entries(votes)) {
						if (!excluded.has(party) && (v as number) > bestVotes) {
							bestVotes = v as number;
							best = party;
						}
					}
					return best;
				}
			: (code: string) => resultsMap[code] || "NONE";

	const sourceMode =
		mode === "percentage" && options.selected
			? `${type}:percentage:${options.selected}`
			: `${type}:majority:${[...excluded].sort().join(",")}`;
	const transformedGeojson = ctx.transformed(
		geojson,
		dataset,
		sourceMode,
		() => {
			const features =
				mode === "percentage" && options.selected
					? ctx.featureBuilder.buildElectionPercentageFeatures(
							geojson.features,
							dataMap,
							options.selected,
							codeProp,
						)
					: ctx.featureBuilder.buildElectionWinnerFeatures(
							geojson.features,
							codeProp,
							getWinner,
						);
			return ctx.featureBuilder.formatBoundaryGeoJson(features);
		},
	);

	// Update layers
	if (mode === "percentage" && options.selected) {
		ctx.layerManager.updatePartyPercentageLayers(
			transformedGeojson,
			options,
			mapOptions.visibility,
			isDark,
		);
	} else {
		ctx.layerManager.updateElectionLayers(
			transformedGeojson,
			dataset.partyInfo,
			mapOptions.visibility,
		);
	}

	ctx.eventHandler.setupEventHandlers(dataMap, codeProp);
}

export function renderLocalElection(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: LocalElectionDataset,
	mapOptions: MapOptions,
	isDark = false,
): void {
	renderElection(ctx, geojson, dataset, mapOptions, "localElection", isDark);
}

export function renderGeneralElection(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: GeneralElectionDataset,
	mapOptions: MapOptions,
	isDark = false,
): void {
	renderElection(
		ctx,
		geojson,
		dataset,
		mapOptions,
		"generalElection",
		isDark,
	);
}

export function renderBrexit(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: BrexitLADDataset,
	mapOptions: MapOptions,
): void {
	const codeProp = ctx.codeProp("localAuthority", geojson.features);

	const features = ctx.featureBuilder.buildBrexitFeatures(
		geojson.features,
		dataset,
		codeProp,
		mapOptions,
	);

	const transformedGeojson =
		ctx.featureBuilder.formatBoundaryGeoJson(features);

	ctx.layerManager.updateColoredLayers(
		transformedGeojson,
		mapOptions.visibility,
	);
	ctx.eventHandler.setupEventHandlers(dataset.data, codeProp);
}

export function renderBrexitConstituency(
	ctx: MapRenderContext,
	geojson: BoundaryGeojson,
	dataset: BrexitConstituencyDataset,
	mapOptions: MapOptions,
): void {
	const codeProp = ctx.codeProp("constituency", geojson.features);

	const features = ctx.featureBuilder.buildBrexitConstituencyFeatures(
		geojson.features,
		dataset,
		codeProp,
		mapOptions,
	);
	const transformedGeojson =
		ctx.featureBuilder.formatBoundaryGeoJson(features);

	ctx.layerManager.updateColoredLayers(
		transformedGeojson,
		mapOptions.visibility,
	);
	ctx.eventHandler.setupEventHandlers(dataset.data, codeProp);
}
