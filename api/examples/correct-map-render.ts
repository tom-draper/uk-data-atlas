import { writeFileSync } from "node:fs";
import { createClient, type AtlasClient, type Step } from "./client";

/**
 * The correct-map reference implementation: everything a MapLibre application
 * needs, taken only from the published contract.
 *
 * `correct-map.ts` proves the values can be trusted. This one draws them. The
 * path is deliberately the safe one at every step: the boundary release is
 * chosen from what is published rather than assumed, the measure is joined
 * only because the API says every source code is in that release, areas with
 * no value are drawn as having no value rather than as zero, and the citation
 * comes back with the release and content hash that produced the picture.
 */

type MapResource = {
	id: string;
	title: string;
	bounds: [number, number, number, number];
	tiles: {
		layer: string;
		minZoom: number;
		maxZoom: number;
		contentHash: string;
		href: string;
	};
	attribution: { text: string };
};

type TileJson = {
	tilejson: string;
	tiles: string[];
	minzoom: number;
	maxzoom: number;
	bounds: [number, number, number, number];
	attribution: string;
	vector_layers: Array<{ id: string }>;
};

type Join = {
	measure: { id: string; label: string };
	period: string;
	layer: string;
	areasWithoutValue: number;
	join: { boundaryRelease: string; method: string };
	values: Array<{ id: number; code: string; value: number }>;
};

export type MapPlan = {
	style: Record<string, unknown>;
	/** What must be shown beside the map, and what identifies it. */
	citation: {
		attribution: string;
		atlasRelease: string;
		archiveContentHash: string;
		measure: string;
		period: string;
	};
	values: Array<{ id: number; value: number }>;
	noDataColour: string;
};

const BREAKS = [
	[0, "#f7fbff"],
	[50000, "#c6dbef"],
	[100000, "#6baed6"],
	[200000, "#2171b5"],
	[400000, "#08306b"],
] as const;

const NO_DATA = "#d9d9d9";

/**
 * A MapLibre style built from the TileJSON the API serves.
 *
 * Values are not in the tiles, so the fill colour reads `feature-state`, which
 * the application sets per feature from the join table. One tileset therefore
 * draws any measure, and changing measure never refetches a tile.
 *
 * The fallback colour is not decoration. A release holds areas a measure may
 * not cover, and colouring those from a missing value would draw them as the
 * bottom of the scale, which is a different claim entirely.
 */
export const mapStyle = (tileJson: TileJson, layer: string) => ({
	version: 8,
	name: "UK Data Atlas correct map",
	sources: {
		boundaries: {
			type: "vector",
			tiles: tileJson.tiles,
			minzoom: tileJson.minzoom,
			maxzoom: tileJson.maxzoom,
			bounds: tileJson.bounds,
			attribution: tileJson.attribution,
		},
	},
	layers: [
		{
			id: "boundary-fill",
			type: "fill",
			source: "boundaries",
			"source-layer": layer,
			paint: {
				"fill-color": [
					"case",
					["==", ["feature-state", "value"], null],
					NO_DATA,
					[
						"step",
						["feature-state", "value"],
						...BREAKS.flatMap(([at, colour], index) =>
							index === 0 ? [colour] : [at, colour],
						),
					],
				],
				"fill-opacity": 0.85,
			},
		},
		{
			id: "boundary-line",
			type: "line",
			source: "boundaries",
			"source-layer": layer,
			paint: { "line-color": "#ffffff", "line-width": 0.5 },
		},
	],
});

export const run = async (client: AtlasClient): Promise<Step[]> => {
	const steps: Step[] = [];

	// 1. Choose a map resource from what is published, rather than assuming a
	//    geography and release exist for it.
	const published =
		await client.get<Array<{ id: string; title: string; href: string }>>(
			"/v1/map-resources",
		);
	const chosen = published.data[0];
	if (!chosen) throw new Error("the API publishes no map resource");
	steps.push({
		title: "Choose a published map resource",
		detail: `${published.data.length} published; took ${chosen.id}.`,
	});

	// 2. The descriptor is the only document needed to draw and to cite.
	const resource = await client.get<MapResource>(chosen.href);
	steps.push({
		title: "Read the descriptor",
		detail: `${resource.data.title}, zoom ${resource.data.tiles.minZoom} to ${resource.data.tiles.maxZoom}, archive ${resource.data.tiles.contentHash.slice(0, 18)}…`,
	});

	// 3. The refusal comes before the success on purpose. A measure published
	//    on other boundaries cannot be drawn here, and the API says which
	//    releases would carry it rather than leaving the caller to guess.
	const refused = await client.refusal(
		`${chosen.href}/join/imd-rank?period=2019`,
	);
	const alternatives = (
		refused as unknown as { alternatives?: { releases?: string[] } }
	).alternatives?.releases;
	steps.push({
		title: "Refuse a measure these boundaries cannot carry",
		detail: `imd-rank: ${refused.code ?? refused.title}; it would work on ${(alternatives ?? []).join(", ") || "no published release"}.`,
	});

	// 4. TileJSON: the tile URLs and the attribution to display.
	const tileJson = await client.get<TileJson>(`${chosen.href}/tiles.json`);
	const layer = tileJson.data.vector_layers[0]?.id;
	if (!layer) throw new Error("the TileJSON declares no vector layer");
	steps.push({
		title: "Configure the renderer",
		detail: `TileJSON ${tileJson.data.tilejson}, layer "${layer}", attribution "${tileJson.data.attribution}".`,
	});

	// 5. The values, numbered with the ids the tiles carry.
	const join = await client.get<Join>(
		`${chosen.href}/join/population-estimate?period=2022&geography=localAuthority&boundaryYear=2023`,
	);
	if (join.data.join.method !== "code-match")
		throw new Error("the join stopped being a code match");
	steps.push({
		title: "Join the values by code",
		detail: `${join.data.values.length} values for ${join.data.measure.id} ${join.data.period}; ${join.data.areasWithoutValue} areas have none and are drawn as no data.`,
	});

	// 6. The style, and the citation that has to travel with the picture.
	const style = mapStyle(tileJson.data, layer);
	steps.push({
		title: "Build the style",
		detail: `${(style.layers as unknown[]).length} layers reading feature-state, so one tileset draws any measure.`,
	});
	steps.push({
		title: "Cite the map",
		detail: `${resource.data.attribution.text}; Atlas release ${join.atlasRelease.slice(0, 18)}….`,
	});
	return steps;
};

/** The whole plan, for a caller that wants the style rather than the story. */
export const plan = async (client: AtlasClient): Promise<MapPlan> => {
	const published =
		await client.get<Array<{ href: string }>>("/v1/map-resources");
	const href = published.data[0]!.href;
	const resource = await client.get<MapResource>(href);
	const tileJson = await client.get<TileJson>(`${href}/tiles.json`);
	const layer = tileJson.data.vector_layers[0]!.id;
	const join = await client.get<Join>(
		`${href}/join/population-estimate?period=2022&geography=localAuthority&boundaryYear=2023`,
	);
	return {
		style: mapStyle(tileJson.data, layer),
		citation: {
			attribution: resource.data.attribution.text,
			atlasRelease: join.atlasRelease,
			archiveContentHash: resource.data.tiles.contentHash,
			measure: join.data.measure.id,
			period: join.data.period,
		},
		values: join.data.values.map(({ id, value }) => ({ id, value })),
		noDataColour: NO_DATA,
	};
};

/**
 * A page that draws the plan. It is generated rather than written by hand so
 * it cannot drift from the contract: every URL in it came from the API.
 */
export const tutorialPage = (
	mapPlan: MapPlan,
	baseUrl: string,
) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>UK Data Atlas — correct map</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link href="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<style>
  html, body { margin: 0; height: 100%; font: 14px system-ui, sans-serif; }
  #map { height: 100%; }
  #cite { position: absolute; left: 8px; bottom: 8px; z-index: 1;
          background: rgba(255,255,255,.92); padding: 8px 10px; border-radius: 6px;
          max-width: 40em; line-height: 1.4; }
  code { font-size: 12px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="cite">
  <strong>${mapPlan.citation.measure}</strong>, ${mapPlan.citation.period}.
  ${mapPlan.citation.attribution}.<br />
  Atlas release <code>${mapPlan.citation.atlasRelease}</code><br />
  Tiles <code>${mapPlan.citation.archiveContentHash}</code>
</div>
<script>
// Tile URLs are relative to the API, so they are resolved against it here.
const style = ${JSON.stringify(mapPlan.style, null, 2)};
style.sources.boundaries.tiles = style.sources.boundaries.tiles.map(
  (url) => ${JSON.stringify(baseUrl)} + url,
);

const map = new maplibregl.Map({
  container: "map",
  style,
  bounds: style.sources.boundaries.bounds,
  fitBoundsOptions: { padding: 24 },
});

// The values are held against the tile feature ids, not baked into the tiles.
// An area with no value keeps a null state and is drawn in the no-data colour
// rather than at the bottom of the scale.
const values = ${JSON.stringify(mapPlan.values)};
map.on("load", () => {
  for (const { id, value } of values) {
    map.setFeatureState(
      { source: "boundaries", sourceLayer: ${JSON.stringify(mapPlan.style.layers ? (mapPlan.style.layers as Array<{ "source-layer": string }>)[0]!["source-layer"] : "boundaries")}, id },
      { value },
    );
  }
});
</script>
</body>
</html>
`;

if (process.argv[1]?.endsWith("correct-map-render.ts")) {
	const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3001";
	const client = createClient(baseUrl);
	for (const step of await run(client))
		console.log(`${step.title}: ${step.detail}`);
	const out = process.argv[2] ?? "correct-map.html";
	writeFileSync(out, tutorialPage(await plan(client), baseUrl));
	console.log(
		`\nWrote ${out}. Serve the API with \`pnpm start\` and open it in a browser.`,
	);
}
