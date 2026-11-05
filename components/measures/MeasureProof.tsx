"use client";

import { useEffect, useMemo, useState } from "react";
import {
	BOUNDARY_CATALOG,
	type BoundaryType,
} from "@/lib/data/boundaries/catalog";
import { boundaryTiles, fetchMapBoundaries } from "@/lib/data/boundaries/tiles";
import { getFeatureProp } from "@uk-data-atlas/datasets/types/geometry";
import { valuesByCode } from "@/lib/measures/client";
import {
	buildScale,
	formatMeasureValue,
	legendEntries,
	unitLabel,
} from "@/lib/measures/presentation";
import { useMeasureValues } from "@/lib/measures/useMeasureValues";
import { MeasureChart } from "./MeasureChart";
import { MeasureMap } from "./MeasureMap";

type Props = {
	measure: string;
	geography: string;
	boundaryYear: number;
};

type Boundaries = {
	tiles: NonNullable<ReturnType<typeof boundaryTiles.get>>;
	names: Map<string, string>;
};

/**
 * One measure drawn end to end through the website's measure query: the
 * values come from `/data/measures/{measure}`, the colours from the measure's
 * value kind, the chart from the same, and the legend from its unit. Nothing
 * here names a dataset. It is a proof of the approach, not a replacement for
 * the atlas map.
 */
export function MeasureProof({ measure, geography, boundaryYear }: Props) {
	const [boundaries, setBoundaries] = useState<Boundaries | "missing">();
	const [selected, setSelected] = useState<string | null>(null);
	const latest = useMeasureValues({ measure, geography, boundaryYear });
	const data = latest.status === "ready" ? latest.data : null;
	const history = useMeasureValues(
		data && selected && data.source.periods.length > 1
			? {
					measure,
					geography,
					boundaryYear,
					periods: data.source.periods,
					areas: [selected],
				}
			: null,
	);

	useEffect(() => {
		const family = BOUNDARY_CATALOG[geography as BoundaryType];
		const release = family?.releases.find(
			(candidate) => candidate.year === boundaryYear && candidate.asset,
		);
		if (!release?.asset) return;
		let cancelled = false;
		fetchMapBoundaries(release.asset, {
			location: null,
			type: geography as BoundaryType,
		})
			.then((geojson) => {
				const tiles = boundaryTiles.get(geojson);
				if (cancelled) return;
				if (!tiles) return setBoundaries("missing");
				const names = new Map<string, string>();
				for (const feature of geojson.features) {
					const code = getFeatureProp(
						feature.properties,
						release.codeKey,
					);
					const name = (
						feature.properties as unknown as Record<string, unknown>
					)[release.nameKey];
					if (typeof code === "string" && typeof name === "string")
						names.set(code, name);
				}
				setBoundaries({ tiles, names });
			})
			.catch(() => !cancelled && setBoundaries("missing"));
		return () => {
			cancelled = true;
		};
	}, [geography, boundaryYear]);

	const period = data?.periods[0];
	const view = useMemo(() => {
		if (!data || !period) return null;
		const values = valuesByCode(data, period);
		const scale = buildScale(data.measure.valueKind, [...values.values()]);
		return {
			scale,
			colors: new Map(
				[...values].map(([code, value]) => [
					code,
					scale?.colorFor(value) ?? "",
				]),
			),
		};
	}, [data, period]);

	if (latest.status === "error")
		return (
			<p role="alert" className="text-red-700">
				{latest.error.message}
			</p>
		);
	if (!data || !period || !view) return <p>Loading {measure}.</p>;

	const { valueKind, unit } = data.measure;
	const format = (value: number) =>
		formatMeasureValue(valueKind, unit, value);
	const name = (code: string) =>
		boundaries && boundaries !== "missing"
			? (boundaries.names.get(code) ?? code)
			: code;
	const selectedValue = selected
		? valuesByCode(data, period).get(selected)
		: undefined;

	return (
		<section className="flex flex-col gap-4">
			<header>
				<h2 className="text-xl font-semibold">{data.measure.label}</h2>
				<p className="text-sm text-gray-600">
					{data.measure.description} {unitLabel(unit)}, {period}.
					Value kind: {valueKind}. Source: {data.source.datasetId}.
				</p>
			</header>
			{boundaries && boundaries !== "missing" ? (
				<MeasureMap
					tiles={boundaries.tiles}
					colors={view.colors}
					selected={selected}
					onSelect={setSelected}
				/>
			) : (
				<p className="text-sm text-gray-500">
					{boundaries === "missing"
						? "Boundary tiles for this geography are not built, so the map is not drawn."
						: "Loading boundaries."}
				</p>
			)}
			{view.scale && (
				<ul className="flex flex-wrap gap-3 text-xs">
					{legendEntries(view.scale, format).map((entry) => (
						<li
							key={entry.label}
							className="flex items-center gap-1"
						>
							<span
								className="inline-block h-3 w-3 border border-gray-300"
								style={{ backgroundColor: entry.color }}
							/>
							{entry.label}
						</li>
					))}
				</ul>
			)}
			{selected && (
				<p className="text-sm">
					<strong>{name(selected)}</strong>:{" "}
					{formatMeasureValue(valueKind, unit, selectedValue ?? null)}
				</p>
			)}
			<MeasureChart
				payload={data}
				period={period}
				names={
					boundaries && boundaries !== "missing"
						? boundaries.names
						: undefined
				}
				selected={selected}
				history={history.status === "ready" ? history.data : null}
			/>
		</section>
	);
}
