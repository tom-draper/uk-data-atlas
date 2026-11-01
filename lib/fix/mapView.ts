import { countInput } from "./convert";
import type { Diagnosis } from "./diagnose";
import type { Table } from "./table";

/**
 * What the fix page's map draws: each matched area of the file, coloured
 * by its status or by one of its number columns. Pure, so the colouring is
 * tested without a map.
 */

/** Status colours, which the legend always pairs with an icon and words. */
export const STATUS_COLOURS = {
	current: "#0ca30c",
	retired: "#fab219",
} as const;

/** One hue, light to dark, for a number column. */
export const VALUE_COLOURS = [
	"#cde2fb",
	"#86b6ef",
	"#3987e5",
	"#1c5cab",
	"#0d366b",
];

export interface MapArea {
	code: string;
	name: string;
	colour: string;
	/** Read out on hover, such as "Retired since May 2025" or "4,478". */
	note: string;
}

export interface LegendEntry {
	colour: string;
	label: string;
	tone?: "ok" | "warn";
}

export interface MapColouring {
	areas: MapArea[];
	legend: LegendEntry[];
	/** Rows with no area on the map, because none was matched. */
	notShown: number;
	/** Rows left off a value map: no count, or a repeat of an area. */
	noValue: number;
}

const format = (value: number) =>
	value.toLocaleString("en-GB", { maximumFractionDigits: 2 });

/** Matched areas, coloured by whether the latest release still holds them. */
export function statusColouring(diagnosis: Diagnosis): MapColouring {
	const seen = new Map<string, MapArea>();
	let notShown = 0;
	let retired = 0;
	for (const result of diagnosis.results) {
		const matched =
			(result.status === "valid" || result.status === "matched") &&
			result.area;
		if (!matched) {
			if (result.status !== "empty") notShown++;
			continue;
		}
		if (seen.has(result.area!.code)) continue;
		const isRetired = result.latestStatus === "superseded";
		if (isRetired) retired++;
		seen.set(result.area!.code, {
			code: result.area!.code,
			name: result.area!.name,
			colour: isRetired ? STATUS_COLOURS.retired : STATUS_COLOURS.current,
			note: isRetired
				? `Retired since ${diagnosis.releaseLabel}`
				: diagnosis.latestLabel
					? `Current in ${diagnosis.latestLabel}`
					: "Matched",
		});
	}
	const legend: LegendEntry[] = [
		{
			colour: STATUS_COLOURS.current,
			label: diagnosis.latestLabel
				? `Current in ${diagnosis.latestLabel}`
				: "Matched",
			tone: "ok",
		},
	];
	if (retired > 0)
		legend.push({
			colour: STATUS_COLOURS.retired,
			label: `Retired since ${diagnosis.releaseLabel}`,
			tone: "warn",
		});
	return { areas: [...seen.values()], legend, notShown, noValue: 0 };
}

/**
 * Up to five classes holding about the same number of areas each, as the
 * upper bound of every class but the last.
 */
export function quantileBreaks(values: number[], classes = 5): number[] {
	const sorted = [...values].sort((a, b) => a - b);
	const breaks: number[] = [];
	for (let i = 1; i < classes; i++) {
		const cut = sorted[Math.ceil((i * sorted.length) / classes) - 1];
		if (cut !== undefined && cut !== breaks[breaks.length - 1])
			breaks.push(cut);
	}
	// The top class must hold something above its lower bound.
	while (
		breaks.length &&
		breaks[breaks.length - 1] >= sorted[sorted.length - 1]
	)
		breaks.pop();
	return breaks;
}

/** Matched areas, shaded by one number column of the file. */
export function valueColouring(
	table: Table,
	diagnosis: Diagnosis,
	column: number,
): MapColouring {
	const input = countInput(table, diagnosis, column);
	const status = statusColouring(diagnosis);
	const names = new Map(status.areas.map((area) => [area.code, area.name]));
	const breaks = quantileBreaks(input.rows.map((row) => row.value));
	// Spread the classes over the whole ramp, so few classes still contrast.
	const colours =
		breaks.length === 0
			? [VALUE_COLOURS[2]]
			: Array.from(
					{ length: breaks.length + 1 },
					(_, i) =>
						VALUE_COLOURS[
							Math.round(
								(i * (VALUE_COLOURS.length - 1)) /
									breaks.length,
							)
						],
				);
	const classOf = (value: number) => {
		const index = breaks.findIndex((cut) => value <= cut);
		return index === -1 ? breaks.length : index;
	};
	const sorted = input.rows.map((row) => row.value).sort((a, b) => a - b);
	const legend: LegendEntry[] = colours.map((colour, i) => {
		const low = i === 0 ? sorted[0] : breaks[i - 1];
		const high =
			i === breaks.length ? sorted[sorted.length - 1] : breaks[i];
		return {
			colour,
			label:
				i === 0
					? `${format(low)} to ${format(high)}`
					: `Over ${format(low)} to ${format(high)}`,
		};
	});
	return {
		areas: input.rows.map((row) => ({
			code: row.code,
			name: names.get(row.code) ?? row.code,
			colour: colours[classOf(row.value)],
			note: format(row.value),
		})),
		legend: sorted.length ? legend : [],
		notShown: status.notShown,
		noValue:
			input.leftOut.filter(
				(row) =>
					row.reason === "not a count" || row.reason === "no value",
			).length + input.repeats.length,
	};
}
