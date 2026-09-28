import type { Measure } from "../dataCatalog";
import { countriesFor } from "./countries";
import { localAuthorityFieldPeriods } from "./localAuthorityFields";
import type { CatalogManifest, CompiledMeasure } from "./manifest";
import { sha256 } from "./values";

/** Net territorial greenhouse gas emissions by local authority. */
export const compileEmissions = (
	{ manifestPath, datasets }: CatalogManifest,
	ghgEmissionsPath: string,
): CompiledMeasure => {
	const emissions = datasets.find(
		(dataset) => dataset.id === "ghg-emissions",
	);
	if (!emissions)
		throw new Error(`${manifestPath} has no ghg-emissions dataset`);
	const emissionsPeriods = localAuthorityFieldPeriods(
		ghgEmissionsPath,
		"totalKtCO2e",
		2025,
	);
	const emissionsRecordCount = emissionsPeriods.reduce(
		(total, period) => total + period.records.length,
		0,
	);
	if (emissionsRecordCount !== emissions.summary.dataRecordCount) {
		throw new Error(
			`${ghgEmissionsPath}: expected ${emissions.summary.dataRecordCount} records from the manifest, found ${emissionsRecordCount}`,
		);
	}
	if (emissionsPeriods.length !== emissions.summary.datasetCount) {
		throw new Error(
			`${ghgEmissionsPath}: expected ${emissions.summary.datasetCount} periods from the manifest, found ${emissionsPeriods.length}`,
		);
	}
	if (
		emissions.summary.boundaryYears.length !== 1 ||
		emissions.summary.boundaryYears[0] !== 2025
	) {
		throw new Error(
			`${manifestPath}: ghg-emissions must declare boundary year 2025`,
		);
	}
	const emissionsMeasure: Measure = {
		id: "ghg-emissions",
		label: "Greenhouse gas emissions",
		valueKind: "quantity",
		unit: "kt CO2e",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		sources: [
			{
				datasetId: "ghg-emissions",
				periods: emissionsPeriods.map((period) => period.period),
				sourceGeography: { type: "localAuthority", boundaryYear: 2025 },
				coverage: {
					kind: "source-reported",
					countries: countriesFor(emissionsPeriods[0]?.records ?? []),
					recordCount: emissionsPeriods[0]?.records.length ?? 0,
					note: "Published source records cover all four UK nations for every available period, restated on one code vintage by the publisher.",
				},
			},
		],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: true,
		},
		links: { data: "/v1/data/ghg-emissions" },
		notes: [
			"Values are net territorial emissions across every sector and gas. Land use, land use change and forestry is a net sink in most rural authorities, so their totals are lower than their gross emissions. No published authority-year is negative, but nothing in the method prevents it.",
			"Emissions per resident are not served. They are a ratio, and a ratio cannot be summed over areas or compared between authorities of different size without recomputing it from the underlying totals.",
			"Local authority totals exclude sources the publisher cannot attribute to an area, such as aviation and shipping, so they do not sum to the national inventory.",
		],
	};
	const emissionsObservationsContent = JSON.stringify({
		schemaVersion: 1,
		measureId: "ghg-emissions",
		sourceGeography: { type: "localAuthority", boundaryYear: 2025 },
		periods: emissionsPeriods,
	});
	return {
		measure: emissionsMeasure,
		artifact: {
			schemaVersion: 1,
			contentHash: sha256(emissionsObservationsContent),
			measureId: "ghg-emissions",
			sourceGeography: { type: "localAuthority", boundaryYear: 2025 },
			periods: emissionsPeriods,
		},
	};
};
