import type { Measure } from "../dataCatalog";
import { onApril2023Authorities } from "./authorityChanges";
import { countriesFor } from "./countries";
import { localAuthorityFieldPeriods } from "./localAuthorityFields";
import type { CatalogManifest } from "./manifest";
import { sha256 } from "./values";

/**
 * The census breakdowns, published as counts rather than shares.
 *
 * A count of people or households is extensive, so it adds over areas and
 * needs no weight. Publishing the categories and their denominator lets a
 * caller derive any share they want and know exactly what it is a share
 * of, which is safer than the API dividing for them and leaving the
 * universe implicit.
 */
export const compileCensus = (
	{ manifestPath, datasets }: CatalogManifest,
	travelToWorkPath: string,
	carAvailabilityPath: string,
	qualificationPath: string,
	ethnicityPath: string,
	populationCodes: Set<string>,
) => {
	const censusBreakdowns = [
		{
			datasetId: "travel-to-work",
			field: "breakdown",
			sourceBoundaryYear: 2025,
			unit: "people in employment",
			universe:
				"Usual residents aged 16 and over in employment in the week before the census. Those not in employment, and anyone aged under 16, are excluded.",
			categories: [
				["car", "car", "Travel to work by car or van"],
				["home", "workFromHome", "Work mainly at or from home"],
				[
					"public-transport",
					"publicTransport",
					"Travel to work by public transport",
				],
				["on-foot", "onFoot", "Travel to work on foot"],
				["bicycle", "bicycle", "Travel to work by bicycle"],
				["taxi", "taxi", "Travel to work by taxi"],
				["motorcycle", "motorcycle", "Travel to work by motorcycle"],
				["other", "other", "Travel to work by another method"],
				["total", "total", "People in employment"],
			],
			notes: [
				"Driving and being a passenger are one category here; the census counts them apart.",
				"Working mainly at or from home is a method of travel in the census, not an absence of one.",
			],
		},
		{
			datasetId: "car-availability",
			field: "breakdown",
			sourceBoundaryYear: 2025,
			unit: "households",
			universe:
				"Households, not people. A household with four residents and one car counts once.",
			categories: [
				["none", "noCar", "Households with no car or van"],
				["one", "oneCar", "Households with one car or van"],
				["two", "twoCars", "Households with two cars or vans"],
				[
					"three-or-more",
					"threeOrMoreCars",
					"Households with three or more cars or vans",
				],
				["total", "total", "Households"],
			],
			notes: [
				"The top category is open-ended, so the table gives no count of vehicles.",
			],
		},
		{
			datasetId: "qualification",
			field: "breakdown",
			sourceBoundaryYear: 2025,
			unit: "usual residents aged 16 and over",
			universe:
				"Usual residents aged 16 and over. Residents under 16, whom the table records as 'Does not apply', are excluded.",
			categories: [
				["none", "noQualifications", "No qualifications"],
				[
					"level-1",
					"level1",
					"Highest qualification: level 1 and entry level",
				],
				["level-2", "level2", "Highest qualification: level 2"],
				[
					"apprenticeship",
					"apprenticeship",
					"Highest qualification: apprenticeship",
				],
				["level-3", "level3", "Highest qualification: level 3"],
				[
					"level-4-plus",
					"level4Plus",
					"Highest qualification: level 4 or above",
				],
				["other", "other", "Highest qualification: other"],
				["total", "total", "Usual residents aged 16 and over"],
			],
			notes: [
				"Each resident is counted once, at their highest qualification. Level 4 or above includes degrees and higher degrees; level 3 includes two or more A levels.",
				"Apprenticeship is its own category, whatever level the apprenticeship was.",
				"Other covers vocational or work-related qualifications, and qualifications achieved outside England or Wales whose level is not stated or known.",
			],
		},
		{
			datasetId: "ethnicity",
			field: "",
			sourceBoundaryYear: 2024,
			unit: "usual residents",
			universe:
				"All usual residents, as they identified themselves. The nineteen categories are exhaustive, so they sum to the whole resident population.",
			categories: [
				[
					"bangladeshi",
					"Asian, Asian British or Asian Welsh.Bangladeshi.population",
					"Ethnic group: Bangladeshi",
				],
				[
					"chinese",
					"Asian, Asian British or Asian Welsh.Chinese.population",
					"Ethnic group: Chinese",
				],
				[
					"indian",
					"Asian, Asian British or Asian Welsh.Indian.population",
					"Ethnic group: Indian",
				],
				[
					"pakistani",
					"Asian, Asian British or Asian Welsh.Pakistani.population",
					"Ethnic group: Pakistani",
				],
				[
					"other-asian",
					"Asian, Asian British or Asian Welsh.Other Asian.population",
					"Ethnic group: Other Asian",
				],
				[
					"african",
					"Black, Black British, Black Welsh, Caribbean or African.African.population",
					"Ethnic group: African",
				],
				[
					"caribbean",
					"Black, Black British, Black Welsh, Caribbean or African.Caribbean.population",
					"Ethnic group: Caribbean",
				],
				[
					"other-black",
					"Black, Black British, Black Welsh, Caribbean or African.Other Black.population",
					"Ethnic group: Other Black",
				],
				[
					"white-and-asian",
					"Mixed or Multiple ethnic groups.White and Asian.population",
					"Ethnic group: White and Asian",
				],
				[
					"white-and-black-african",
					"Mixed or Multiple ethnic groups.White and Black African.population",
					"Ethnic group: White and Black African",
				],
				[
					"white-and-black-caribbean",
					"Mixed or Multiple ethnic groups.White and Black Caribbean.population",
					"Ethnic group: White and Black Caribbean",
				],
				[
					"other-mixed",
					"Mixed or Multiple ethnic groups.Other Mixed or Multiple ethnic groups.population",
					"Ethnic group: Other Mixed or Multiple ethnic groups",
				],
				[
					"white-british",
					"White.English, Welsh, Scottish, Northern Irish or British.population",
					"Ethnic group: English, Welsh, Scottish, Northern Irish or British",
				],
				["irish", "White.Irish.population", "Ethnic group: Irish"],
				[
					"gypsy-or-irish-traveller",
					"White.Gypsy or Irish Traveller.population",
					"Ethnic group: Gypsy or Irish Traveller",
				],
				["roma", "White.Roma.population", "Ethnic group: Roma"],
				[
					"other-white",
					"White.Other White.population",
					"Ethnic group: Other White",
				],
				[
					"arab",
					"Other ethnic group.Arab.population",
					"Ethnic group: Arab",
				],
				[
					"any-other",
					"Other ethnic group.Any other ethnic group.population",
					"Ethnic group: Any other ethnic group",
				],
			],
			notes: [
				"The census's five high-level groups are not served separately; each is the sum of its categories, which is exact for a count.",
				"ONS perturbs census cell counts to protect confidentiality, so a sum of these categories can differ by a few residents from a population total published in another table.",
				'The White category "English, Welsh, Scottish, Northern Irish or British" is one census tick-box, not a statement about nationality.',
			],
		},
	] as const;

	const censusPaths = {
		"travel-to-work": travelToWorkPath,
		"car-availability": carAvailabilityPath,
		qualification: qualificationPath,
		ethnicity: ethnicityPath,
	};
	const CENSUS_BOUNDARY_YEAR = 2023;
	const englandAndWales2023 = [...populationCodes].filter(
		(code) => code.startsWith("E") || code.startsWith("W"),
	);
	const censusObservations = censusBreakdowns.flatMap((breakdown) => {
		const dataset = datasets.find(
			(candidate) => candidate.id === breakdown.datasetId,
		);
		if (!dataset)
			throw new Error(
				`${manifestPath} has no ${breakdown.datasetId} dataset`,
			);
		if (
			dataset.summary.boundaryYears.length !== 1 ||
			dataset.summary.boundaryYears[0] !== breakdown.sourceBoundaryYear
		) {
			throw new Error(
				`${manifestPath}: ${breakdown.datasetId} must declare boundary year ${breakdown.sourceBoundaryYear}`,
			);
		}
		const path = censusPaths[breakdown.datasetId];
		return breakdown.categories.map(([suffix, field, label]) => {
			const measureId = `${breakdown.datasetId}-${suffix}`;
			const periods = localAuthorityFieldPeriods(
				path,
				breakdown.field ? `${breakdown.field}.${field}` : field,
				breakdown.sourceBoundaryYear,
			).map((period) => {
				try {
					return onApril2023Authorities(period, englandAndWales2023);
				} catch (error) {
					throw new Error(
						`${path}: ${measureId} ${period.period}: ${(error as Error).message}`,
					);
				}
			});
			const content = JSON.stringify({
				schemaVersion: 1,
				measureId,
				sourceGeography: {
					type: "localAuthority",
					boundaryYear: CENSUS_BOUNDARY_YEAR,
				},
				periods,
			});
			return {
				measure: {
					id: measureId,
					label,
					valueKind: "count",
					unit: breakdown.unit,
					aggregation: {
						kind: "extensive",
						operation: "sum",
						available: true,
					},
					sources: [
						{
							datasetId: breakdown.datasetId,
							periods: periods.map((period) => period.period),
							sourceGeography: {
								type: "localAuthority",
								boundaryYear: CENSUS_BOUNDARY_YEAR,
							},
							coverage: {
								kind: "partial",
								countries: countriesFor(
									periods[0]?.records ?? [],
								),
								recordCount: periods[0]?.records.length ?? 0,
								note: "Published source records cover England and Wales only; this endpoint does not infer Scottish or Northern Irish values.",
							},
						},
					],
					availability: {
						sourceExact: true,
						conversion: false,
						aggregation: true,
					},
					links: { data: `/v1/data/${measureId}` },
					notes: [
						breakdown.universe,
						...breakdown.notes,
						"The census reports on 2021 boundaries. The four authorities created in April 2023 are compiled by summing their predecessors, which is exact for a count, and the districts they replaced are not served, so no resident is counted twice. The partition is on April 2023 codes, which Barnsley and Sheffield changed in 2025.",
					],
				} satisfies Measure,
				artifact: {
					schemaVersion: 1 as const,
					contentHash: sha256(content),
					measureId,
					sourceGeography: {
						type: "localAuthority" as const,
						boundaryYear: CENSUS_BOUNDARY_YEAR,
					},
					periods,
				},
			};
		});
	});
	const censusMeasures = censusObservations.map(({ measure }) => measure);
	return {
		measures: censusMeasures,
		artifacts: censusObservations.map(({ artifact }) => artifact),
	};
};
