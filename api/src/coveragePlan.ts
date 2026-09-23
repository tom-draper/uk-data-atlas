import { countryForCode } from "./catalog/countries";
import type { Country, DataCatalog } from "./dataCatalog";
import {
	conversionCoverageOnto,
	type MeasureConversionPath,
} from "./measureCapability";
import { measureCoverage } from "./measureCoverage";
import { observationsFor } from "./observationArtifacts";
import type { RouteContext } from "./routing";
import { releaseKey } from "./geographyKeys";

type Measure = DataCatalog["measures"][number];

export type CoverageCountryPlan = {
	country: Country;
	/** Areas of the target release in this country. */
	areaCount: number;
	/** Areas of them this measure can be given a value for. */
	coveredAreaCount: number;
	status: "source-exact" | "converted" | "partial" | "missing";
	/** The partition the values come from, published on the release itself. */
	source?: {
		datasetId: string;
		geography: string;
		boundaryYear: number;
		periods: string[];
	};
	/** Or the conversion that reaches this country, where none is published. */
	conversion?: MeasureConversionPath;
	reason: string;
};

export type CoveragePlan = {
	measure: { id: string; unit: string; aggregation: Measure["aggregation"] };
	target: { geography: string; boundaryRelease: string; areaCount: number };
	countries: CoverageCountryPlan[];
	summary: {
		areaCount: number;
		coveredAreaCount: number;
		countriesServed: Country[];
		countriesMissing: Country[];
		/** Areas whose code names no country, so no country accounts for them. */
		unattributedAreaCount: number;
	};
	note: string;
};

/**
 * Group codes by the country their prefix names. A code no scheme recognises
 * is counted apart rather than dropped, so the countries always account for
 * the whole release.
 */
const countriesOf = (codes: Iterable<string>) => {
	const byCountry = new Map<Country, Set<string>>();
	const unattributed = new Set<string>();
	for (const code of codes) {
		let country: Country;
		try {
			country = countryForCode(code);
		} catch {
			unattributed.add(code);
			continue;
		}
		const held = byCountry.get(country) ?? new Set<string>();
		held.add(code);
		byCountry.set(country, held);
	}
	return Object.assign(byCountry, { unattributed });
};

/**
 * What a measure can answer on one release, country by country.
 *
 * The capability answer for a release is one word for the whole of it, and
 * for a United Kingdom release that hides the shape of the gap: ward
 * population is published for England and Wales and for neither Scotland nor
 * Northern Ireland, and a caller ranking wards needs to know that before
 * reading the ranking, not after. So each country is answered on its own,
 * from the areas a partition actually carries values for, or the areas a
 * published conversion reaches, and a country neither serves is named as
 * missing rather than left to be inferred from a short list.
 *
 * Nothing here fills a gap. A country without a source stays missing, which
 * is the answer a caller needs in order to go and find the data.
 */
export const coveragePlan = (
	context: RouteContext,
	measure: Measure,
	target: { geography: string; boundaryRelease: string },
): CoveragePlan | undefined => {
	const { dataCatalog, measureCompatibilityInventory } = context;
	if (!dataCatalog || !measureCompatibilityInventory)
		return undefined;
	const areas = context.geographyResolver.releaseAreas(target.geography, target.boundaryRelease);
	if (!areas) return undefined;
	const targetByCountry = countriesOf(areas.keys());
	const coverage = measureCoverage(
		dataCatalog,
		measureCompatibilityInventory,
		measure.id,
	);
	const artifacts = {
		populationObservations: context.populationObservations,
		populationLocalAuthorityObservations:
			context.populationLocalAuthorityObservations,
		measureObservations: context.measureObservations,
	};

	// What each partition published on the release itself carries, taken from
	// its observations rather than its declared coverage, so a partition that
	// names a country but holds no area of it is not counted as serving it.
	const served = new Map<
		Country,
		{ codes: Set<string>; source: CoverageCountryPlan["source"] }
	>();
	for (const source of measure.sources) {
		if (source.sourceGeography.type !== target.geography) continue;
		const joinable = coverage?.sources
			.find(
				(candidate) =>
					candidate.dataset.id === source.datasetId &&
					candidate.sourceGeography.boundaryYear ===
						source.sourceGeography.boundaryYear,
			)
			?.boundaryCoverage.find(
				(candidate) =>
					candidate.boundaryRelease === target.boundaryRelease,
			);
		if (!joinable?.eligibleForCodeJoin) continue;
		const codes = new Set(
			source.periods.flatMap(
				(period) =>
					observationsFor(measure.id, source, period, artifacts)
						?.records.map((record) => record.areaCode)
						.filter((code) => areas.has(code)) ?? [],
			),
		);
		for (const [country, inCountry] of countriesOf(codes)) {
			const held = served.get(country);
			if (held && held.codes.size >= inCountry.size) continue;
			served.set(country, {
				codes: inCountry,
				source: {
					datasetId: source.datasetId,
					geography: source.sourceGeography.type,
					boundaryYear: source.sourceGeography.boundaryYear,
					periods: source.periods,
				},
			});
		}
	}

	// Where nothing is published on the release, a conversion the convert
	// route would accept may still reach some of it.
	const converted = new Map<
		Country,
		{ codes: Set<string>; path: MeasureConversionPath }
	>();
	for (const { path, targets } of conversionCoverageOnto(
		context,
		measure,
		target,
	)) {
		for (const [country, inCountry] of countriesOf(
			[...targets].filter((code) => areas.has(code)),
		)) {
			const held = converted.get(country);
			if (held && held.codes.size >= inCountry.size) continue;
			converted.set(country, { codes: inCountry, path });
		}
	}

	const countries = [...targetByCountry]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([country, codes]): CoverageCountryPlan => {
			const release = releaseKey(target.geography, target.boundaryRelease);
			const source = served.get(country);
			if (source && source.codes.size === codes.size)
				return {
					country,
					areaCount: codes.size,
					coveredAreaCount: source.codes.size,
					status: "source-exact",
					source: source.source,
					reason: `${source.source!.datasetId} publishes a value for every ${target.geography} of ${release} in ${country}.`,
				};
			const conversion = converted.get(country);
			const bestConversion =
				conversion &&
				(!source || conversion.codes.size > source.codes.size)
					? conversion
					: undefined;
			if (bestConversion)
				return {
					country,
					areaCount: codes.size,
					coveredAreaCount: bestConversion.codes.size,
					status:
						bestConversion.codes.size === codes.size
							? "converted"
							: "partial",
					conversion: bestConversion.path,
					reason: `${bestConversion.path.source.datasetId} reaches ${bestConversion.codes.size} of ${codes.size} through ${bestConversion.path.crosswalk.id}, ${bestConversion.path.method}.`,
				};
			if (source)
				return {
					country,
					areaCount: codes.size,
					coveredAreaCount: source.codes.size,
					status: "partial",
					source: source.source,
					reason: `${source.source!.datasetId} publishes a value for ${source.codes.size} of the ${codes.size} ${target.geography} areas of ${release} in ${country}.`,
				};
			const elsewhere = measure.sources.filter((candidate) =>
				candidate.coverage.countries.includes(country),
			);
			return {
				country,
				areaCount: codes.size,
				coveredAreaCount: 0,
				status: "missing",
				reason:
					elsewhere.length > 0
						? `This measure covers ${country} on ${[
								...new Set(
									elsewhere.map(
										(candidate) =>
											`${candidate.sourceGeography.type} ${candidate.sourceGeography.boundaryYear}`,
									),
								),
							].join(
								" and ",
							)}, but no published crosswalk converts that onto ${release}.`
						: `No published source of this measure covers ${country}.`,
			};
		});

	const coveredAreaCount = countries.reduce(
		(total, country) => total + country.coveredAreaCount,
		0,
	);
	return {
		measure: {
			id: measure.id,
			unit: measure.unit,
			aggregation: measure.aggregation,
		},
		target: { ...target, areaCount: areas.size },
		countries,
		summary: {
			areaCount: areas.size,
			coveredAreaCount,
			unattributedAreaCount: targetByCountry.unattributed.size,
			countriesServed: countries
				.filter((country) => country.coveredAreaCount > 0)
				.map((country) => country.country),
			countriesMissing: countries
				.filter((country) => country.coveredAreaCount === 0)
				.map((country) => country.country),
		},
		note: "Each country is answered from the areas a source or conversion actually carries. A country with no source is reported missing; no value is estimated to fill it.",
	};
};
