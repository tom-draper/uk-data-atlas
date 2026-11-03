import { decodeCompactPayload } from "@uk-data-atlas/catalogue/compactPayload";
import type { DatasetCoverage } from "@uk-data-atlas/catalogue/place-profile";

// The atlas datasets that publish a figure for each code, and for which
// years. A dataset's years each hold maps from code to figures.
export function readDatasetCoverage(readDataset: (output: string) => string) {
	const manifest = JSON.parse(readDataset("dataset-manifest")) as {
		datasets: { output: string; source: { name: string } }[];
	};
	const coverage = new Map<string, Map<string, Set<number>>>();
	const titles = new Map<string, string>();
	const looksLikeCode = (key: string) => /^[EWSN]\d{8}$/.test(key);
	for (const { output, source } of manifest.datasets) {
		if (titles.has(output)) continue;
		titles.set(output, source.name);
		const file = decodeCompactPayload(
			JSON.parse(readDataset(output)),
		) as Record<string, unknown>;
		for (const [key, entry] of Object.entries(file)) {
			if (!entry || typeof entry !== "object") continue;
			const year = Number((entry as { year?: unknown }).year ?? key);
			if (!Number.isFinite(year)) continue;
			for (const value of Object.values(entry)) {
				if (!value || typeof value !== "object" || Array.isArray(value))
					continue;
				const codes = Object.keys(value).filter(looksLikeCode);
				if (codes.length < 5) continue;
				for (const code of codes) {
					const byDataset = coverage.get(code) ?? new Map();
					coverage.set(code, byDataset);
					const years = byDataset.get(output) ?? new Set<number>();
					byDataset.set(output, years);
					years.add(year);
				}
			}
		}
	}
	return (code: string): DatasetCoverage[] =>
		[...(coverage.get(code) ?? [])]
			.map(([slug, years]) => ({
				slug,
				title: titles.get(slug) ?? slug,
				years: [...years].sort((a, b) => b - a),
			}))
			.sort((a, b) => a.title.localeCompare(b.title));
}

/** The datasets that count each geography's residents, one per geography. */
const POPULATION_DATASETS = [
	"population",
	"population-uk",
	"population-constituency",
];

// The latest population each dataset publishes for a code. A total is either
// a count or a count for each single year of age.
export function readPopulations(readDataset: (output: string) => string) {
	const latest = new Map<
		string,
		{ value: number; year: number; dataset: string }
	>();
	const sum = (total: unknown): number | undefined =>
		typeof total === "number"
			? total
			: total && typeof total === "object"
				? Object.values(total).reduce<number>(
						(count, value) =>
							count + (typeof value === "number" ? value : 0),
						0,
					)
				: undefined;
	for (const dataset of POPULATION_DATASETS) {
		const file = decodeCompactPayload(
			JSON.parse(readDataset(dataset)),
		) as Record<
			string,
			{ year: number; data: Record<string, { total?: unknown }> }
		>;
		for (const { year, data } of Object.values(file))
			for (const [code, record] of Object.entries(data)) {
				const value = sum(record.total);
				if (value === undefined || value <= 0) continue;
				const known = latest.get(code);
				if (!known || year > known.year)
					latest.set(code, {
						value: Math.round(value),
						year,
						dataset,
					});
			}
	}
	return latest;
}
