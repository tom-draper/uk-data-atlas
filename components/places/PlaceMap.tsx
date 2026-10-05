"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MAPLIBRE_CONFIG } from "@/lib/config/map";
import {
	decodeOutline,
	type BoundingBox,
	type Outline,
} from "@/lib/places/profile";

export type PlaceShape = {
	code: string;
	name: string;
	outline: Outline;
	/** Where clicking the shape goes, for a place with a page of its own. */
	href?: string;
};

const INK = "#0f172a";
const ACCENT = "#2563eb";

/**
 * A place drawn over the basemap: one outline for an area, or each member's
 * outline for a named place, each of which links to its own page.
 */
export default function PlaceMap({
	shapes,
	bbox,
	label,
}: {
	shapes: PlaceShape[];
	bbox: BoundingBox;
	label: string;
}) {
	const container = useRef<HTMLDivElement>(null);
	const router = useRouter();

	useEffect(() => {
		let map: MapLibreMap | undefined;
		let cancelled = false;
		void import("maplibre-gl").then(({ Map }) => {
			if (cancelled || !container.current) return;
			map = new Map({
				container: container.current,
				style: MAPLIBRE_CONFIG.style,
				bounds: bbox,
				fitBoundsOptions: { padding: 32 },
				maxBounds: MAPLIBRE_CONFIG.maxBounds,
				attributionControl: { compact: true },
				cooperativeGestures: true,
			});
			const features = shapes.map((shape, id) => ({
				type: "Feature" as const,
				id,
				properties: {
					code: shape.code,
					name: shape.name,
					href: shape.href ?? "",
				},
				geometry: {
					type: "MultiPolygon" as const,
					coordinates: decodeOutline(shape.outline),
				},
			}));
			const single = shapes.length === 1;
			map.on("load", () => {
				if (!map) return;
				map.addSource("place", {
					type: "geojson",
					data: { type: "FeatureCollection", features },
				});
				map.addLayer({
					id: "place-fill",
					type: "fill",
					source: "place",
					paint: {
						"fill-color": ACCENT,
						"fill-opacity": [
							"case",
							["boolean", ["feature-state", "hover"], false],
							0.32,
							single ? 0.16 : 0.12,
						],
					},
				});
				map.addLayer({
					id: "place-line",
					type: "line",
					source: "place",
					paint: {
						"line-color": single ? ACCENT : INK,
						"line-width": single ? 2.5 : 1,
						"line-opacity": single ? 0.9 : 0.55,
					},
				});
				if (single) return;
				let hovered: number | undefined;
				map.on("mousemove", "place-fill", (event) => {
					const feature = event.features?.[0];
					if (!map || feature?.id === undefined) return;
					if (hovered !== undefined)
						map.setFeatureState(
							{ source: "place", id: hovered },
							{ hover: false },
						);
					hovered = Number(feature.id);
					map.setFeatureState(
						{ source: "place", id: hovered },
						{ hover: true },
					);
					map.getCanvas().style.cursor = feature.properties.href
						? "pointer"
						: "";
					map.getCanvas().title = String(feature.properties.name);
				});
				map.on("mouseleave", "place-fill", () => {
					if (!map) return;
					if (hovered !== undefined)
						map.setFeatureState(
							{ source: "place", id: hovered },
							{ hover: false },
						);
					hovered = undefined;
					map.getCanvas().style.cursor = "";
					map.getCanvas().title = "";
				});
				map.on("click", "place-fill", (event) => {
					const href = event.features?.[0]?.properties.href;
					if (href) router.push(String(href));
				});
			});
		});
		return () => {
			cancelled = true;
			map?.remove();
		};
	}, [shapes, bbox, router]);

	return (
		<div
			ref={container}
			role="img"
			aria-label={`Map of ${label}`}
			className="h-[320px] w-full overflow-hidden rounded-md bg-[#eef0ee] sm:h-[400px]"
		/>
	);
}
