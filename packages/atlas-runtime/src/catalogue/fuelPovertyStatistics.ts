import {
	ATLAS_BOUNDARY_VINTAGES,
	type AtlasBoundaryVintages,
} from "@uk-data-atlas/catalogue";
import type {
	FuelPovertyDataset,
	FuelPovertyLSOAData,
} from "@uk-data-atlas/datasets/types/fuelPoverty";
import type { DatabaseSync } from "node:sqlite";
import type {
	AreaRelease,
	StatisticsDataset,
	StatisticsMeasure,
	StatisticsObservation,
} from "./atlasStatistics";
import { HOUSEHOLDS } from "./statisticsDatasets/measures";

/**
 * Fuel poverty as statistics rows, and the reader that rebuilds its compiled
 * JSON from them byte for byte. The JSON shape lives here, not in the schema.
 */

const SLUG = "fuel-poverty";
const TYPE = "fuelPoverty";

/** Record fields in output order, with the measure each holds. */
const FIELDS: readonly (readonly [
	"householdCount" | "fuelPoorHouseholdCount" | "fuelPovertyRate",
	string,
])[] = [
	["householdCount", "households"],
	["fuelPoorHouseholdCount", "fuel-poor-households"],
	["fuelPovertyRate", "fuel-poverty-rate"],
];

const MEASURES: StatisticsMeasure[] = [
	HOUSEHOLDS,
	{
		slug: "fuel-poor-households",
		label: "Fuel poor households",
		description:
			"Households in fuel poverty under the Low Income Low Energy Efficiency measure.",
		unit: "households",
		valueKind: "count",
		aggregation: "sum",
	},
	{
		slug: "fuel-poverty-rate",
		label: "Fuel poverty rate",
		description: "Fuel poor households as a percentage of all households.",
		unit: "percent",
		valueKind: "rate",
		aggregation: "ratio",
		numerator: "fuel-poor-households",
		denominator: "households",
	},
];

const vintages = (ATLAS_BOUNDARY_VINTAGES as AtlasBoundaryVintages).lsoa;

/** The dataset manifest entry; its source metadata is checked, not trusted. */
export type FuelPovertyManifestEntry = { fingerprint: string; source: unknown };

const sourceText = (source: unknown, key: string, required = true) => {
	const value =
		typeof source === "object" && source !== null
			? (source as Record<string, unknown>)[key]
			: undefined;
	if (typeof value === "string") return value;
	if (value === undefined && !required) return undefined;
	throw new Error(`Fuel poverty manifest source has no ${key}`);
};

export function fuelPovertyStatistics(
	text: string,
	entry: FuelPovertyManifestEntry,
): StatisticsDataset {
	const periods: Record<string, FuelPovertyDataset> = JSON.parse(text);
	const releases = new Map<string, AreaRelease>();
	for (const [period, dataset] of Object.entries(periods)) {
		if (
			dataset.type !== TYPE ||
			dataset.boundaryType !== "lsoa" ||
			dataset.id !== `${TYPE}${period}` ||
			String(dataset.year) !== period
		)
			throw new Error(`Unexpected fuel poverty period header ${period}`);
		const id = vintages[dataset.boundaryYear];
		if (!id)
			throw new Error(
				`Unknown fuel poverty boundary year ${dataset.boundaryYear}`,
			);
		releases.set(id, { geography: "lsoa", id });
		let previous = "";
		for (const [code, record] of Object.entries(dataset.data)) {
			if (record.lsoaCode !== code)
				throw new Error(`Unknown fuel poverty area ${code}`);
			if (code <= previous)
				throw new Error(
					`Fuel poverty records are not in area code order at ${code}`,
				);
			previous = code;
			for (const [field] of FIELDS)
				if (!Number.isFinite(record[field]))
					throw new Error(`Invalid fuel poverty value ${field}`);
		}
	}
	const releaseIds = [...releases.keys()];
	const series = releaseIds.flatMap((id) =>
		FIELDS.map(([, measure]) => ({ measure, release: releases.get(id)! })),
	);
	const seriesIndex = (boundaryYear: number, field: number) =>
		releaseIds.indexOf(vintages[boundaryYear]) * FIELDS.length + field;
	return {
		slug: SLUG,
		title: sourceText(entry.source, "name")!,
		description: sourceText(entry.source, "description")!,
		source: {
			publisher: sourceText(entry.source, "source")!,
			url: sourceText(entry.source, "sourceUrl", false),
			licence: sourceText(entry.source, "licence")!,
			licenceUrl: sourceText(entry.source, "licenceUrl", false),
		},
		fingerprint: entry.fingerprint,
		measures: MEASURES,
		periods: Object.keys(periods).map((label) => ({
			label,
			kind: "year" as const,
			start: `${label}-01-01`,
			end: `${label}-12-31`,
		})),
		series,
		*observations(): Generator<StatisticsObservation> {
			for (const [period, dataset] of Object.entries(periods))
				for (const [code, record] of Object.entries(dataset.data))
					for (const [index, [field]] of FIELDS.entries())
						yield {
							series: seriesIndex(dataset.boundaryYear, index),
							code,
							period,
							value: record[field],
						};
		},
		*areaNames() {
			const names = new Map<string, string>();
			for (const dataset of Object.values(periods)) {
				const release = releases.get(vintages[dataset.boundaryYear])!;
				for (const [code, record] of Object.entries(dataset.data)) {
					const key = `${release.id}\0${code}`;
					if (names.has(key)) {
						if (record.lsoaName !== names.get(key))
							throw new Error(
								`Fuel poverty names ${code} differently across periods`,
							);
						continue;
					}
					names.set(key, record.lsoaName);
					yield { release, code, name: record.lsoaName };
				}
			}
		},
		verify(database) {
			if (rebuildFuelPoverty(database) !== text)
				throw new Error(
					"Fuel poverty rows differ from catalogue payload",
				);
		},
	};
}

/** The compiled fuel poverty JSON, rebuilt from statistics rows. */
export function rebuildFuelPoverty(database: DatabaseSync): string {
	const periods = database
		.prepare(
			`
		SELECT DISTINCT p.label, p.start_date, r.geography, r.id AS release
		FROM dataset d
		JOIN series s ON s.dataset_id = d.id
		JOIN observation o ON o.series_id = s.id
		JOIN period p ON p.id = o.period_id
		JOIN area_releases r ON r.position = s.release_id
		WHERE d.slug = ?
		ORDER BY p.start_date, p.label
	`,
		)
		.all(SLUG);
	if (periods.length === 0) throw new Error("Missing fuel poverty periods");
	const values = database.prepare(`
		SELECT a.code, coalesce(n.name, v.name) AS name, m.slug AS measure, o.value
		FROM dataset d
		JOIN series s ON s.dataset_id = d.id
		JOIN measure m ON m.id = s.measure_id
		JOIN observation o ON o.series_id = s.id
		JOIN period p ON p.id = o.period_id
		JOIN area_version v ON v.id = o.area_version_id
		JOIN area a ON a.id = v.area_id
		LEFT JOIN dataset_area_name n ON n.dataset_id = d.id AND n.area_version_id = v.id
		WHERE d.slug = ? AND p.label = ?
		ORDER BY a.code
	`);
	const result: Record<string, FuelPovertyDataset> = {};
	for (const period of periods) {
		const label = String(period.label);
		if (label in result)
			throw new Error(`Fuel poverty period ${label} spans releases`);
		const years = Object.entries(vintages).filter(
			([, id]) => id === period.release,
		);
		if (period.geography !== "lsoa" || years.length !== 1)
			throw new Error(
				`Fuel poverty release ${period.release} has no single boundary year`,
			);
		const rows = new Map<
			string,
			{ name: string; values: Map<string, number> }
		>();
		for (const row of values.all(SLUG, label)) {
			const code = String(row.code);
			let entry = rows.get(code);
			if (!entry) {
				entry = { name: String(row.name), values: new Map() };
				rows.set(code, entry);
			}
			entry.values.set(String(row.measure), Number(row.value));
		}
		const data: Record<string, FuelPovertyLSOAData> = {};
		for (const [code, { name, values: byMeasure }] of rows) {
			const record = { lsoaCode: code, lsoaName: name } as Record<
				string,
				string | number
			>;
			for (const [field, measure] of FIELDS) {
				const value = byMeasure.get(measure);
				if (value === undefined)
					throw new Error(
						`Missing fuel poverty ${measure} for ${code}`,
					);
				record[field] = value;
			}
			data[code] = record as unknown as FuelPovertyLSOAData;
		}
		result[label] = {
			id: `${TYPE}${label}`,
			type: TYPE,
			year: Number(label),
			boundaryType: "lsoa",
			boundaryYear: Number(years[0][0]),
			data,
		};
	}
	return JSON.stringify(result);
}
