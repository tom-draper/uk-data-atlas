import type { SourceGeography, Measure } from "../dataCatalog";
import { countriesFor } from "./countries";
import { localAuthorityFieldPeriods } from "./localAuthorityFields";
import type { CatalogManifest } from "./manifest";
import { sha256 } from "./values";

/**
 * A nation's deprivation index, as its published rank and decile.
 *
 * Each index is a position within one nation, built to its own method,
 * domains and date, so the four are separate measure families and none can
 * be compared with another. A composite score is never published as a
 * measure: the only published ways of combining one over areas use
 * method-specific population weighting, and serving it bare invites
 * averaging.
 */
export const compileDeprivationIndices = (
	{ manifestPath, datasets }: CatalogManifest,
	imdPath: string,
	wimdPath: string,
	simdPath: string,
) => {
	const deprivationIndex = (index: {
		datasetId: "imd" | "wimd" | "simd";
		path: string;
		label: string;
		nation: "England" | "Wales" | "Scotland";
		otherNations: string;
		geography: SourceGeography["type"];
		areaNoun: string;
		rankField: string;
		decileField: string;
		rankNotes: string[];
		decileNotes: string[];
	}) => {
		const dataset = datasets.find(
			(candidate) => candidate.id === index.datasetId,
		);
		if (!dataset)
			throw new Error(
				`${manifestPath} has no ${index.datasetId} dataset`,
			);
		if (
			dataset.summary.boundaryYears.length !== 1 ||
			dataset.summary.boundaryYears[0] !== 2011
		) {
			throw new Error(
				`${manifestPath}: ${index.datasetId} must declare boundary year 2011`,
			);
		}
		// The manifest's count is the compiled record count, checked below, so
		// the unit states exactly how many areas the ranks run across.
		const areaCount = dataset.summary.dataRecordCount;
		const areas = areaCount.toLocaleString("en-GB");
		const comparability = `A position within ${index.nation} alone. The ${index.otherNations} indices use different methods, domains and dates, so a rank or decile cannot be compared across nations.`;
		const metrics = [
			{
				id: `${index.datasetId}-rank`,
				label: `${index.label} rank`,
				field: index.rankField,
				unit: `rank of ${areas} ${index.areaNoun}, where 1 is the most deprived`,
				statistic: "rank" as const,
				note: "A rank records an order, not a distance: the gap between ranks 1 and 2 need not equal the gap between 100 and 101. Averaging ranks over areas produces a number with no meaning.",
				extra: index.rankNotes,
			},
			{
				id: `${index.datasetId}-decile`,
				label: `${index.label} decile`,
				field: index.decileField,
				unit: `decile, where 1 is the most deprived tenth of ${index.areaNoun}`,
				statistic: "decile" as const,
				note: `A decile is a band of ranks. Averaging deciles over areas produces a number with no meaning, and the share of a place's ${index.areaNoun} in each decile is the defensible summary instead.`,
				extra: index.decileNotes,
			},
		];
		return metrics.map((metric) => {
			const periods = localAuthorityFieldPeriods(
				index.path,
				metric.field,
				2011,
				index.geography,
			);
			const sourceGeography = {
				type: index.geography,
				boundaryYear: 2011,
			};
			const content = JSON.stringify({
				schemaVersion: 1,
				measureId: metric.id,
				sourceGeography,
				periods,
			});
			const measure: Measure = {
				id: metric.id,
				label: metric.label,
				valueKind: "ordinal",
				unit: metric.unit,
				aggregation: {
					kind: "non-aggregatable",
					statistic: metric.statistic,
					note: metric.note,
					available: false,
				},
				sources: [
					{
						datasetId: index.datasetId,
						periods: periods.map((period) => period.period),
						sourceGeography,
						coverage: {
							kind: "partial",
							countries: countriesFor(periods[0]?.records ?? []),
							recordCount: periods[0]?.records.length ?? 0,
							note: `${index.nation} only. The other three nations publish their own indices, which are not comparable with this one.`,
						},
					},
				],
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: false,
				},
				links: { data: `/v1/data/${metric.id}` },
				notes: [comparability, ...metric.extra],
			};
			if (periods[0]?.records.length !== areaCount) {
				throw new Error(
					`${index.path}: expected ${areaCount} ${index.areaNoun} from the manifest, found ${periods[0]?.records.length ?? 0}`,
				);
			}
			return {
				measure,
				artifact: {
					schemaVersion: 1 as const,
					contentHash: sha256(content),
					measureId: metric.id,
					sourceGeography,
					periods,
				},
			};
		});
	};

	const imdObservations = [
		...deprivationIndex({
			datasetId: "imd",
			path: imdPath,
			label: "Index of Multiple Deprivation",
			nation: "England",
			otherNations: "Welsh, Scottish and Northern Irish",
			geography: "lsoa",
			areaNoun: "LSOAs",
			rankField: "imdRank",
			decileField: "imdDecile",
			rankNotes: [
				"The published file itself contains 26 tied ranks; they are served as published rather than re-ranked.",
			],
			decileNotes: [
				"Deciles divide England's 32,844 LSOAs into ten near-equal groups by rank.",
			],
		}),
		...deprivationIndex({
			datasetId: "wimd",
			path: wimdPath,
			label: "Welsh Index of Multiple Deprivation",
			nation: "Wales",
			otherNations: "English, Scottish and Northern Irish",
			geography: "lsoa",
			areaNoun: "LSOAs",
			rankField: "wimdRank",
			decileField: "wimdDecile",
			rankNotes: [
				"Taken from the Welsh Government's published ranks. The separately published scores are rounded to one decimal place, so ranking them does not reproduce these ranks.",
			],
			decileNotes: [
				"Taken from the Welsh Government's published deciles.",
			],
		}),
		...deprivationIndex({
			datasetId: "simd",
			path: simdPath,
			label: "Scottish Index of Multiple Deprivation",
			nation: "Scotland",
			otherNations: "English, Welsh and Northern Irish",
			geography: "dataZone",
			areaNoun: "data zones",
			rankField: "simdRank",
			decileField: "simdDecile",
			rankNotes: [
				"SIMD 2020v2, taken from the Scottish Government's published data zone lookup, whose ranks agree with its separately published ranks workbook.",
			],
			decileNotes: [
				"Taken from the Scottish Government's published data zone lookup. Quintiles are also published there but are not offered as a measure.",
			],
		}),
	];
	const imdMeasures = imdObservations.map(({ measure }) => measure);
	return {
		measures: imdMeasures,
		artifacts: imdObservations.map(({ artifact }) => artifact),
	};
};
