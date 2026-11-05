"use client";

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { pmtilesURL } from "@/lib/map/tilesUrl";
import { NO_DATA_COLOR } from "@/lib/measures/presentation";

const SOURCE = "measure-areas";
const SOURCE_LAYER = "boundaries";

const STYLE: StyleSpecification = {
	version: 8,
	sources: {},
	layers: [
		{
			id: "background",
			type: "background",
			paint: { "background-color": "#f8f8f6" },
		},
	],
};

type Tiles = {
	href: string;
	minZoom: number;
	maxZoom: number;
	/** Feature id by area code, as the tiles number their areas. */
	ids: ReadonlyMap<string, number>;
};

type Props = {
	tiles: Tiles;
	/** The fill of each area by code. Areas not listed are drawn as no data. */
	colors: ReadonlyMap<string, string>;
	selected: string | null;
	onSelect(code: string | null): void;
};

/**
 * Areas coloured by whatever the measure query returned. It knows only a
 * colour per area code: the colour comes from the measure's value kind (see
 * `buildScale`), never from a dataset. The geometry is the compiled boundary
 * tiles the atlas already serves, addressed by feature state.
 */
export function MeasureMap({ tiles, colors, selected, onSelect }: Props) {
	const container = useRef<HTMLDivElement>(null);
	const map = useRef<MapLibreMap | null>(null);
	const ready = useRef(false);
	const latest = useRef({ colors, selected, onSelect });

	useEffect(() => {
		latest.current = { colors, selected, onSelect };
	});

	useEffect(() => {
		let cancelled = false;
		const codeById = new Map(
			[...tiles.ids].map(([code, id]) => [id, code] as const),
		);
		const paint = () => {
			const engine = map.current;
			if (!engine || !ready.current) return;
			for (const [code, id] of tiles.ids)
				engine.setFeatureState(
					{ source: SOURCE, sourceLayer: SOURCE_LAYER, id },
					{
						color: latest.current.colors.get(code) ?? NO_DATA_COLOR,
						selected: code === latest.current.selected,
					},
				);
		};
		void (async () => {
			const [maplibre, { Protocol }] = await Promise.all([
				import("maplibre-gl"),
				import("pmtiles"),
			]);
			if (cancelled || !container.current) return;
			maplibre.addProtocol("pmtiles", new Protocol().tile);
			const engine = new maplibre.Map({
				container: container.current,
				style: STYLE,
				center: [-2.5, 54.5],
				zoom: 4.6,
				maxBounds: [-12, 48, 6, 62],
			});
			map.current = engine;
			engine.on("load", () => {
				engine.addSource(SOURCE, {
					type: "vector",
					url: pmtilesURL(tiles.href, window.location.href),
					minzoom: tiles.minZoom,
					maxzoom: tiles.maxZoom,
				});
				engine.addLayer({
					id: "measure-fill",
					type: "fill",
					source: SOURCE,
					"source-layer": SOURCE_LAYER,
					paint: {
						"fill-color": [
							"coalesce",
							["feature-state", "color"],
							NO_DATA_COLOR,
						],
						"fill-opacity": 0.85,
					},
				});
				engine.addLayer({
					id: "measure-line",
					type: "line",
					source: SOURCE,
					"source-layer": SOURCE_LAYER,
					paint: {
						"line-color": "#1f2937",
						"line-width": [
							"case",
							["boolean", ["feature-state", "selected"], false],
							2,
							0.4,
						],
					},
				});
				ready.current = true;
				paint();
			});
			engine.on("click", "measure-fill", (event) => {
				const id = event.features?.[0]?.id;
				latest.current.onSelect(
					typeof id === "number" ? (codeById.get(id) ?? null) : null,
				);
			});
		})();
		return () => {
			cancelled = true;
			ready.current = false;
			map.current?.remove();
			map.current = null;
		};
	}, [tiles]);

	useEffect(() => {
		const engine = map.current;
		if (!engine || !ready.current) return;
		for (const [code, id] of tiles.ids)
			engine.setFeatureState(
				{ source: SOURCE, sourceLayer: SOURCE_LAYER, id },
				{
					color: colors.get(code) ?? NO_DATA_COLOR,
					selected: code === selected,
				},
			);
	}, [tiles, colors, selected]);

	return (
		<div
			ref={container}
			className="h-[480px] w-full overflow-hidden rounded-md border border-gray-200"
			role="img"
			aria-label="Map of areas coloured by value"
		/>
	);
}
