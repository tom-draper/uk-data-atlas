import fs from "node:fs";
import path from "node:path";

/**
 * The API catalogue projection used by static docs. It is generated after an
 * API build, carries hashes of its source artifacts, and is committed with
 * the other website precompiled data.
 */

const DOCS_CATALOGUE = path.join(
	process.cwd(),
	"data",
	"precompiled",
	"docs-catalogue.json",
);

export interface Licence {
	name: string;
	url?: string;
}

export interface CatalogueDataset {
	id: string;
	label: string;
	publisher: string;
	sourceUrl?: string;
	temporalCoverage?: string;
	licence?: Licence;
	description?: string;
}

export interface MeasureSource {
	datasetId: string;
	periods: string[];
	sourceGeography: { type: string; boundaryYear: number };
	coverage: {
		kind: string;
		countries: string[];
		recordCount: number;
		note?: string;
	};
}

export interface CatalogueMeasure {
	id: string;
	label: string;
	valueKind: string;
	unit: string;
	aggregation: {
		kind: string;
		operation?: string;
		available: boolean;
		statistic?: string;
		note?: string;
	};
	sources: MeasureSource[];
	notes?: string[];
	derivedFrom?: { datasetIds: string[]; note?: string };
	uncertainty?: unknown;
}

export interface CatalogueExport {
	id: string;
	measureId: string;
	datasetId: string;
	periods: string[];
	sourceGeography: { type: string; boundaryYear: number };
	bytes: number;
	recordCount: number;
	href: string;
}

export interface BoundaryRelease {
	id: string;
	geography: string;
	title: string;
	description?: string;
	temporalCoverage?: string;
	coverage: { countries: string[] };
	source: { publisher: string; url?: string; licence?: Licence };
}

export interface Catalogue {
	datasets: CatalogueDataset[];
	measures: CatalogueMeasure[];
	exports: CatalogueExport[];
	releases: BoundaryRelease[];
	/** Compiled area counts, keyed by `geography/release`. */
	areaCounts: Map<string, number>;
	/** Boundary releases published as vector tiles, as `geography/release`. */
	mapResources: Set<string>;
}

interface DocsCatalogueSnapshot {
	schemaVersion: 1;
	sourceArtifacts: Array<{ path: string; sha256: string }>;
	datasets: CatalogueDataset[];
	measures: CatalogueMeasure[];
	exports: CatalogueExport[];
	releases: BoundaryRelease[];
	areaCounts: Record<string, number>;
	mapResourceIds: string[];
}

function readSnapshot(): DocsCatalogueSnapshot {
	const snapshot = JSON.parse(
		fs.readFileSync(DOCS_CATALOGUE, "utf8"),
	) as DocsCatalogueSnapshot;
	if (
		snapshot.schemaVersion !== 1 ||
		!Array.isArray(snapshot.datasets) ||
		!Array.isArray(snapshot.measures) ||
		!Array.isArray(snapshot.exports) ||
		!Array.isArray(snapshot.releases) ||
		!Array.isArray(snapshot.mapResourceIds)
	) {
		throw new Error(`Invalid docs catalogue snapshot at ${DOCS_CATALOGUE}`);
	}
	return snapshot;
}

let cached: Catalogue | null = null;

export function loadCatalogue(): Catalogue {
	if (cached) return cached;
	const snapshot = readSnapshot();

	cached = {
		datasets: snapshot.datasets,
		// Some sources report a period count rather than listing periods.
		measures: snapshot.measures.map((measure) => ({
			...measure,
			sources: measure.sources.map((source) => ({
				...source,
				periods: Array.isArray(source.periods) ? source.periods : [],
			})),
		})),
		exports: snapshot.exports,
		releases: snapshot.releases,
		areaCounts: new Map(Object.entries(snapshot.areaCounts)),
		mapResources: new Set(snapshot.mapResourceIds),
	};
	return cached;
}

const NATIONS: Record<string, string> = {
	"GB-ENG": "England",
	"GB-WLS": "Wales",
	"GB-SCT": "Scotland",
	"GB-NIR": "Northern Ireland",
};

const NATION_ORDER = ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"];

/** "England and Wales", or "UK" when all four are covered. */
export function nationList(countries: Iterable<string>): string {
	const set = new Set(countries);
	if (NATION_ORDER.every((code) => set.has(code))) return "UK";
	const names = NATION_ORDER.filter((code) => set.has(code)).map(
		(code) => NATIONS[code],
	);
	if (names.length <= 1) return names[0] ?? "no nations";
	return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The measures that take any of their values from these datasets. */
export function measuresFromDatasets(
	catalogue: Catalogue,
	datasetIds: string[],
): CatalogueMeasure[] {
	return catalogue.measures.filter((measure) =>
		measure.sources.some((source) => datasetIds.includes(source.datasetId)),
	);
}

/** Complete observation exports that include at least one of these datasets. */
export function exportsFromDatasets(
	catalogue: Catalogue,
	datasetIds: string[],
): CatalogueExport[] {
	return catalogue.exports.filter((item) =>
		datasetIds.includes(item.datasetId),
	);
}

/** Datasets that at least one measure is served from. */
export function servedDatasetIds(catalogue: Catalogue): string[] {
	const ids = new Set(
		catalogue.measures.flatMap((m) => m.sources.map((s) => s.datasetId)),
	);
	return catalogue.datasets.map((d) => d.id).filter((id) => ids.has(id));
}

export interface SourceSummary {
	datasetId: string;
	geography: string;
	boundaryYear: number;
	periods: string[];
	countries: string[];
	recordCount: number;
	note?: string;
	measureIds: string[];
}

/**
 * Each distinct place the datasets are published: one row per dataset,
 * geography, code year and run of periods, with the measures that share it.
 */
export function sourceSummaries(
	catalogue: Catalogue,
	datasetIds: string[],
): SourceSummary[] {
	const rows = new Map<string, SourceSummary>();
	for (const measure of measuresFromDatasets(catalogue, datasetIds)) {
		for (const source of measure.sources) {
			if (!datasetIds.includes(source.datasetId)) continue;
			const key = [
				source.datasetId,
				source.sourceGeography.type,
				source.sourceGeography.boundaryYear,
				source.periods.join(","),
			].join("|");
			const row = rows.get(key);
			if (row) {
				row.measureIds.push(measure.id);
				continue;
			}
			rows.set(key, {
				datasetId: source.datasetId,
				geography: source.sourceGeography.type,
				boundaryYear: source.sourceGeography.boundaryYear,
				periods: source.periods,
				countries: source.coverage.countries,
				recordCount: source.coverage.recordCount,
				note: source.coverage.note,
				measureIds: [measure.id],
			});
		}
	}
	return [...rows.values()];
}

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/**
 * A period as a reader would say it: `year-ending-2026-03` is "Year to March
 * 2026", `2026-Q1` is "January to March 2026". Unfamiliar forms pass through.
 */
export function formatPeriod(period: string): string {
	let match = /^year-ending-(\d{4})-(\d{2})$/.exec(period);
	if (match) return `Year to ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
	match = /^(\d{4})-(\d{2})$/.exec(period);
	// `1996-97` is a financial year; `2026-04` is a month.
	if (match && Number(match[2]) !== (Number(match[1]) + 1) % 100) {
		return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
	}
	match = /^(\d{4})-Q([1-4])$/.exec(period);
	if (match) {
		const start = (Number(match[2]) - 1) * 3;
		return `${MONTHS[start]} to ${MONTHS[start + 2]} ${match[1]}`;
	}
	match = /^(\d{4})-H([12])$/.exec(period);
	if (match) {
		return match[2] === "1"
			? `January to June ${match[1]}`
			: `July to December ${match[1]}`;
	}
	match = /^(\d{4})-(\d{4})$/.exec(period);
	if (match) return `${match[1]}–${match[2]}`;
	return period;
}

/** "2011 to 2024", or the single period. */
export function periodRange(periods: string[]): string {
	if (periods.length === 0) return "Several periods";
	if (periods.length === 1) return formatPeriod(periods[0]);
	return `${formatPeriod(periods[0])} to ${formatPeriod(periods.at(-1)!)}`;
}

export function releasesForGeography(
	catalogue: Catalogue,
	geography: string,
): BoundaryRelease[] {
	return catalogue.releases
		.filter((release) => release.geography === geography)
		.sort((a, b) => b.id.localeCompare(a.id));
}

export function geographyIds(catalogue: Catalogue): string[] {
	return [...new Set(catalogue.releases.map((r) => r.geography))].sort();
}

/** Measures published on a geography, whatever the year of their codes. */
export function measuresOnGeography(
	catalogue: Catalogue,
	geography: string,
): CatalogueMeasure[] {
	return catalogue.measures.filter((measure) =>
		measure.sources.some(
			(source) => source.sourceGeography.type === geography,
		),
	);
}
