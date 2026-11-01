"use client";

import { useEffect, useId, useRef, useState } from "react";
import type {
	ExpressionSpecification,
	Map as MapLibreMap,
	MapLayerMouseEvent,
} from "maplibre-gl";
import { Card } from "@/components/docs/Page";
import { MAP_CONFIG } from "@/lib/config/map";
import { mapTiles, type MapTiles } from "@/lib/fix/api";
import type { Diagnosis } from "@/lib/fix/diagnose";
import {
	statusColouring,
	valueColouring,
	type MapArea,
	type MapColouring,
} from "@/lib/fix/mapView";
import type { Table } from "@/lib/fix/table";
import { labelClass, selectClass, ToneIcon } from "./ui";

const SOURCE = "fix-areas";
const count = (value: number) => value.toLocaleString("en-GB");
const rows = (value: number) => `${count(value)} row${value === 1 ? "" : "s"}`;

function fillColour(areas: MapArea[]): ExpressionSpecification | string {
	if (areas.length === 0) return "rgba(0,0,0,0)";
	return [
		"match",
		["get", "code"],
		...areas.flatMap((area) => [area.code, area.colour]),
		"rgba(0,0,0,0)",
	] as unknown as ExpressionSpecification;
}

const inFile = (areas: MapArea[]): ExpressionSpecification => [
	"in",
	["get", "code"],
	["literal", areas.map((area) => area.code)],
];

/** The box around every point of the features found, or null if none were. */
function boundsOf(
	features: { geometry: GeoJSON.Geometry }[],
): [number, number, number, number] | null {
	let box: [number, number, number, number] | null = null;
	const visit = (value: unknown): void => {
		if (!Array.isArray(value)) return;
		if (typeof value[0] === "number") {
			const [x, y] = value as number[];
			box = box
				? [
						Math.min(box[0], x),
						Math.min(box[1], y),
						Math.max(box[2], x),
						Math.max(box[3], y),
					]
				: [x, y, x, y];
			return;
		}
		value.forEach(visit);
	};
	for (const feature of features)
		if ("coordinates" in feature.geometry)
			visit(feature.geometry.coordinates);
	return box;
}

/**
 * The file's areas on a map of the release they matched, drawn from the
 * API's vector tiles and coloured by status or by a number column.
 */
export default function MapPanel({
	table,
	diagnosis,
	values,
}: {
	table: Table;
	diagnosis: Diagnosis;
	/** The number columns chosen in step 2. */
	values: number[];
}) {
	const release = diagnosis.release;
	const [by, setBy] = useState("status");
	const [tiles, setTiles] = useState<MapTiles | null>(null);
	const [failed, setFailed] = useState<string | null>(null);
	const [hover, setHover] = useState<{
		x: number;
		y: number;
		area: MapArea;
		/** Near the right edge, the box sits left of the pointer. */
		flip: boolean;
	} | null>(null);
	const container = useRef<HTMLDivElement>(null);
	const map = useRef<MapLibreMap | null>(null);
	const id = useId();

	const column = by === "status" ? null : Number(by);
	const colouring: MapColouring =
		column === null || !values.includes(column)
			? statusColouring(diagnosis)
			: valueColouring(table, diagnosis, column);
	/** The colouring the map's handlers read, kept current by an effect. */
	const latest = useRef<MapArea[]>([]);

	const areas = colouring.areas;
	useEffect(() => {
		latest.current = areas;
		const engine = map.current;
		if (!engine?.getLayer("fix-fill")) return;
		engine.setFilter("fix-fill", inFile(areas));
		engine.setPaintProperty("fix-fill", "fill-color", fillColour(areas));
	}, [areas]);

	useEffect(() => {
		if (!release) return;
		const controller = new AbortController();
		mapTiles(release, controller.signal)
			.then(setTiles)
			.catch((error: Error) => {
				if (error.name === "AbortError") return;
				setFailed(
					"status" in error && error.status === 404
						? `No map is published for ${diagnosis.releaseLabel} yet.`
						: error.message,
				);
			});
		return () => controller.abort();
	}, [release, diagnosis.releaseLabel]);

	useEffect(() => {
		if (!tiles) return;
		let cancelled = false;
		let engine: MapLibreMap | undefined;
		void import("maplibre-gl").then(({ Map }) => {
			if (cancelled || !container.current) return;
			engine = new Map({
				container: container.current,
				style: MAP_CONFIG.style,
				bounds: tiles.bounds,
				fitBoundsOptions: { padding: 24 },
				maxBounds: MAP_CONFIG.maxBounds,
				attributionControl: { compact: true },
				cooperativeGestures: true,
			});
			map.current = engine;
			engine.on("load", () => {
				if (!engine) return;
				// A narrow map starts with its attribution folded behind the
				// (i) button, so it does not cover the areas.
				if (engine.getContainer().clientWidth < 640)
					engine
						.getContainer()
						.querySelector(".maplibregl-ctrl-attrib")
						?.classList.remove("maplibregl-compact-show");
				const areas = latest.current;
				engine.addSource(SOURCE, {
					type: "vector",
					tiles: tiles.tiles,
					minzoom: tiles.minzoom,
					maxzoom: tiles.maxzoom,
					attribution: tiles.attribution,
				});
				engine.addLayer({
					id: "fix-fill",
					type: "fill",
					source: SOURCE,
					"source-layer": tiles.layer,
					filter: inFile(areas),
					paint: {
						"fill-color": fillColour(areas),
						"fill-opacity": 0.8,
					},
				});
				engine.addLayer({
					id: "fix-line",
					type: "line",
					source: SOURCE,
					"source-layer": tiles.layer,
					paint: {
						"line-color": "#0f172a",
						"line-width": 0.5,
						"line-opacity": 0.25,
					},
				});
				// Zoom to the file's areas once the first tiles are in, then
				// again once closer tiles give their true extent.
				let fits = 0;
				const fit = () => {
					if (!engine) return;
					const box = boundsOf(
						engine.querySourceFeatures(SOURCE, {
							sourceLayer: tiles.layer,
							filter: inFile(latest.current),
						}),
					);
					if (box)
						engine.fitBounds(box, {
							// More room at the foot, where the attribution sits.
							padding: {
								top: 24,
								right: 24,
								bottom: 48,
								left: 24,
							},
							duration: 0,
							maxZoom: 13,
						});
					if (++fits >= 2) engine.off("idle", fit);
				};
				engine.on("idle", fit);
				engine.on(
					"mousemove",
					"fix-fill",
					(event: MapLayerMouseEvent) => {
						const code = event.features?.[0]?.properties?.code;
						const area = latest.current.find(
							(entry) => entry.code === String(code),
						);
						setHover(
							area
								? {
										x: event.point.x,
										y: event.point.y,
										area,
										flip:
											event.point.x >
											engine!.getCanvas().clientWidth / 2,
									}
								: null,
						);
					},
				);
				engine.on("mouseleave", "fix-fill", () => setHover(null));
			});
		});
		return () => {
			cancelled = true;
			engine?.remove();
			map.current = null;
		};
	}, [tiles]);

	if (!release) return null;
	if (failed)
		return (
			<Card className="p-4 sm:p-5">
				<p className="text-[15px] text-slate-700">{failed}</p>
			</Card>
		);

	const noun = diagnosis.kind === "code" ? "code" : "name";
	const summary = `${count(areas.length)} ${areas.length === 1 ? "area" : "areas"} from your file on a map of ${diagnosis.releaseLabel}`;

	return (
		<Card className="p-4 sm:p-5">
			<div className="mb-4 max-w-[320px]">
				<label htmlFor={`${id}-by`} className={labelClass}>
					Colour by
				</label>
				<select
					id={`${id}-by`}
					className={selectClass}
					value={by}
					onChange={(event) => {
						setBy(event.target.value);
						setHover(null);
					}}
				>
					<option value="status">Status</option>
					{values.map((index) => (
						<option key={index} value={index}>
							{table.headers[index]}
						</option>
					))}
				</select>
			</div>

			<div className="relative">
				<div
					ref={container}
					role="img"
					aria-label={summary}
					className="h-[320px] w-full overflow-hidden rounded-md bg-[#eef0ee] sm:h-[420px]"
				/>
				{hover && (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute z-10 max-w-[240px] rounded-md border border-slate-900/10 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 shadow-sm"
						style={{
							left: hover.flip ? undefined : hover.x + 12,
							right: hover.flip
								? `calc(100% - ${hover.x - 12}px)`
								: undefined,
							top: hover.y + 12,
						}}
					>
						<span className="font-medium">{hover.area.name}</span>{" "}
						<span className="text-slate-500">
							{hover.area.code}
						</span>
						<span className="block">{hover.area.note}</span>
					</div>
				)}
			</div>

			<ul
				className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5"
				aria-label="Key"
			>
				{colouring.legend.map((entry) => (
					<li
						key={entry.label}
						className="flex items-center gap-2 text-[13px] text-slate-700"
					>
						<span
							aria-hidden="true"
							className="h-3.5 w-3.5 shrink-0 rounded-sm border border-slate-900/20"
							style={{ background: entry.colour }}
						/>
						{entry.tone && (
							<span className="-ml-1 flex [&>svg]:mt-0 [&>svg]:h-4 [&>svg]:w-4">
								<ToneIcon tone={entry.tone} />
							</span>
						)}
						{entry.label}
					</li>
				))}
			</ul>

			<p className="mt-3 text-[13px] text-slate-500">
				{summary}.
				{colouring.notShown > 0 &&
					` ${rows(colouring.notShown)} ${colouring.notShown === 1 ? "isn't" : "aren't"} drawn, because the ${noun} wasn't matched.`}
				{colouring.noValue > 0 &&
					` ${rows(colouring.noValue)} with no number, or repeating an area, ${colouring.noValue === 1 ? "isn't" : "aren't"} shaded.`}
			</p>
		</Card>
	);
}
