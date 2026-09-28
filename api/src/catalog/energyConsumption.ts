import type {
	Measure,
	MeasureObservationArtifact,
	MeasureSource,
	SourceGeography,
} from "../dataCatalog";
import { countriesFor } from "./countries";
import { localAuthorityFieldPeriods } from "./localAuthorityFields";
import type { CatalogManifest } from "./manifest";
import { sha256 } from "./values";

/**
 * Metered electricity and gas consumption by local authority.
 *
 * These are settlement-reconciled meter readings rather than a model, so a
 * total adds up over areas exactly. Mean and median consumption per meter are
 * published alongside and deliberately not served: both are ratios, and
 * neither sums nor averages over a group of authorities.
 *
 * Great Britain only. Northern Ireland runs its own electricity and gas
 * markets and is not in the publisher's collection, so it is declared absent
 * rather than served as a gap in a UK series.
 */
const SOURCE_GEOGRAPHY: SourceGeography = {
	type: "localAuthority",
	boundaryYear: 2025,
};

const FUELS = [
	{
		fuel: "electricity",
		label: "Electricity",
		dataset: "electricity-consumption",
		note: "Domestic meters cover both standard and Economy 7 tariffs. Electricity used off the meter, such as generation consumed where it is produced, is not in these figures.",
	},
	{
		fuel: "gas",
		label: "Gas",
		dataset: "gas-consumption",
		note: "Figures are weather corrected, as the publisher's headline series is, so a cold year does not read as a rise in demand. Consumption away from the mains grid, such as bottled or tanked gas, is not metered and not counted.",
	},
] as const;

const SEGMENTS = [
	{ id: "", label: "", field: "allMetersGwh", segment: "every meter" },
	{
		id: "-domestic",
		label: " (domestic)",
		field: "domesticGwh",
		segment: "domestic meters",
	},
	{
		id: "-non-domestic",
		label: " (non-domestic)",
		field: "nonDomesticGwh",
		segment: "non-domestic meters",
	},
] as const;

const SHARED_NOTES = [
	"Consumption is measured where the meter is, so output consumed by a large industrial site raises the authority it stands in rather than the one that owns the activity.",
	"Consumption per meter is not served. It is a ratio, so it cannot be summed over areas, and comparing it between authorities of different meter mixes is not a like-for-like comparison.",
	"Great Britain only. Northern Ireland has separate electricity and gas markets and is not in this collection.",
];

export const compileEnergyConsumption = (
	{ manifestPath, datasets }: CatalogManifest,
	paths: Record<(typeof FUELS)[number]["dataset"], string>,
): { measures: Measure[]; artifacts: MeasureObservationArtifact[] } => {
	const measures: Measure[] = [];
	const artifacts: MeasureObservationArtifact[] = [];

	for (const fuel of FUELS) {
		const dataset = datasets.find(
			(candidate) => candidate.id === fuel.dataset,
		);
		if (!dataset)
			throw new Error(`${manifestPath} has no ${fuel.dataset} dataset`);
		const path = paths[fuel.dataset];
		for (const segment of SEGMENTS) {
			const measureId = `${fuel.fuel}-consumption${segment.id}`;
			const periods = localAuthorityFieldPeriods(
				path,
				segment.field,
				SOURCE_GEOGRAPHY.boundaryYear,
			);
			// Every authority with no mains supply at all is published as a
			// zero in all but one year, where the publisher left the cells
			// blank. A blank is not a measurement, so it is absent here and
			// named rather than read as the zero the other years show.
			const counts = [
				...new Set(periods.map((period) => period.records.length)),
			].sort((left, right) => left - right);
			const shortest = periods.reduce((fewest, period) =>
				period.records.length < fewest.records.length ? period : fewest,
			);
			const fullest = periods.reduce((most, period) =>
				period.records.length > most.records.length ? period : most,
			);
			const missing =
				counts.length > 1
					? fullest.records
							.map((record) => record.areaCode)
							.filter(
								(code) =>
									!shortest.records.some(
										(record) => record.areaCode === code,
									),
							)
					: [];
			const source: MeasureSource = {
				datasetId: fuel.dataset,
				periods: periods.map((period) => period.period),
				sourceGeography: SOURCE_GEOGRAPHY,
				observationArtifact: `${measureId}-observations`,
				coverage: {
					kind: "partial",
					countries: countriesFor(fullest.records),
					recordCount: fullest.records.length,
					note:
						`Published source records cover Great Britain only; Northern Ireland runs separate energy markets and this endpoint does not infer its values.` +
						(missing.length > 0
							? ` ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} absent from ${shortest.period}, where the publisher left the cells blank rather than recording the zero its other years show.`
							: ""),
				},
			};
			const content = JSON.stringify({
				schemaVersion: 1,
				measureId,
				sourceGeography: SOURCE_GEOGRAPHY,
				periods,
			});
			artifacts.push({
				schemaVersion: 1,
				contentHash: sha256(content),
				measureId,
				sourceGeography: SOURCE_GEOGRAPHY,
				periods,
			});
			measures.push({
				id: measureId,
				label: `${fuel.label} consumption${segment.label}`,
				valueKind: "quantity",
				unit: "GWh",
				aggregation: {
					kind: "extensive",
					operation: "sum",
					available: true,
				},
				sources: [source],
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: true,
				},
				links: { data: `/v1/data/${measureId}` },
				notes: [
					`Metered ${fuel.fuel} consumption across ${segment.segment}, in GWh.`,
					fuel.note,
					...SHARED_NOTES,
				],
			});
		}
	}

	return { measures, artifacts };
};
