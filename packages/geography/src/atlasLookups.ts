/**
 * The atlas's containment and lineage lookups, as the API's geography
 * resolver answers them for the releases the atlas draws. The API compiles
 * them in its build and serves them; the atlas fetches them in place of
 * holding the crosswalks, so what the map shows is what the API would say.
 */
import {
	compileAreaContainment,
	compileConstituencyLadOverlaps,
	compileLsoaLadContainment,
	compileParishLadContainment,
	type ContainmentCrosswalk,
	type OverlapCrosswalk,
} from "./areaContainment";
import {
	compileAreaLineage,
	type AreaLineage,
	type LineageAnswer,
} from "./areaLineage";
import { encodeBoundaryMappings, encodeParishLadMappings } from "./mappings";

import type {
	AreaIdentity,
	GeographyEndpoint as Endpoint,
} from "./areaIdentity";

/** The parts of the API's geography resolver the lookups are compiled from. */
export type LookupResolver = {
	hasAreaRelease(geography: string, boundaryRelease: string): boolean;
	areaCodes(
		geography: string,
		boundaryRelease: string,
	): readonly string[] | undefined;
	crosswalkSummaries(): ReadonlyArray<{
		id: string;
		method: string;
		from: Endpoint;
		to: Endpoint;
	}>;
	crosswalk(id: string): unknown;
	sameArea(source: AreaIdentity, to: Endpoint): { code: string } | undefined;
	successorArea(
		source: AreaIdentity,
		to: Endpoint,
	): LineageAnswer | undefined;
};

/** The release the atlas draws for each year, by geography. */
export type AtlasVintages = Readonly<
	Record<
		"ward" | "lsoa" | "parish" | "localAuthority" | "constituency",
		Readonly<Record<number, string>>
	>
>;

/** The geographies the atlas carries data between years for. */
export const LINEAGE_GEOGRAPHIES = [
	"ward",
	"localAuthority",
	"constituency",
] as const;

/** The lookup files the atlas reads, by name. */
export const ATLAS_LOOKUP_FILES = [
	"area-lineage.json",
	"boundary-mappings.json",
	"constituency-lad-overlaps.json",
	"parish-lad-mappings.json",
] as const;

/** The LSOA lookup for one atlas year. */
export const lsoaLadMappingsFile = (year: number) =>
	`lsoa-lad-mappings-${year}.json`;

/** The local authority release constituency overlaps are given in. */
const OVERLAP_LAD_YEAR = 2025;

const releasesOf = (vintages: AtlasVintages, geography: keyof AtlasVintages) =>
	Object.entries(vintages[geography]).map(([year, release]) => ({
		year: Number(year),
		release,
	}));

/**
 * Every atlas lookup, by file name, compiled from the resolver. Throws where
 * the atlas draws a release the resolver does not compile.
 */
export const compileAtlasLookups = (
	resolver: LookupResolver,
	vintages: AtlasVintages,
): Map<string, string> => {
	for (const geography of Object.keys(vintages) as Array<keyof AtlasVintages>)
		for (const release of Object.values(vintages[geography]))
			if (!resolver.hasAreaRelease(geography, release))
				throw new Error(
					`${geography}/${release} is drawn by the atlas but not compiled by the API.`,
				);

	const lineage: Record<string, AreaLineage> = {};
	for (const geography of LINEAGE_GEOGRAPHIES) {
		const releases = [
			...new Set(Object.values(vintages[geography])),
		].sort();
		lineage[geography] = compileAreaLineage(
			geography,
			releases,
			(release) => resolver.areaCodes(geography, release) ?? [],
			(code, from, to) =>
				resolver.successorArea(
					{ geography, boundaryRelease: from, code },
					{ geography, boundaryRelease: to },
				),
		);
	}

	const wardReleases = releasesOf(vintages, "ward");
	const lsoaReleases = releasesOf(vintages, "lsoa");
	const parishReleases = releasesOf(vintages, "parish");
	const drawn = new Set(
		[...wardReleases, ...lsoaReleases, ...parishReleases].map(
			({ release }) => release,
		),
	);
	const artifact = (id: string) => {
		const crosswalk = resolver.crosswalk(id);
		if (!crosswalk)
			throw new Error(`The resolver lists ${id} but cannot read it.`);
		return crosswalk;
	};
	const crosswalks = resolver
		.crosswalkSummaries()
		.filter(
			({ from, to }) =>
				(from.geography === "ward" ||
					from.geography === "lsoa" ||
					from.geography === "parish") &&
				drawn.has(from.boundaryRelease) &&
				(to.geography === "localAuthority" ||
					to.geography === "constituency"),
		)
		.map(({ id }) => artifact(id) as ContainmentCrosswalk);
	const from = (geography: string) =>
		crosswalks.filter(
			(crosswalk) => crosswalk.from.geography === geography,
		);

	const containment = compileAreaContainment(wardReleases, from("ward"));

	// LSOAs are placed in the newest authorities; a published authority is
	// carried there by the resolver's lineage.
	const ladYears = Object.keys(vintages.localAuthority).map(Number);
	const newestLad = vintages.localAuthority[Math.max(...ladYears)]!;
	const lsoaToLad = compileLsoaLadContainment(
		lsoaReleases,
		from("lsoa"),
		(code, release) =>
			resolver.sameArea(
				{ geography: "localAuthority", boundaryRelease: release, code },
				{ geography: "localAuthority", boundaryRelease: newestLad },
			)?.code,
	);

	// Constituencies straddle authorities, so each is listed with the share of
	// it every authority holds, in the authorities the gazetteer speaks.
	const overlapLad = vintages.localAuthority[OVERLAP_LAD_YEAR];
	if (!overlapLad)
		throw new Error(
			`The atlas draws no ${OVERLAP_LAD_YEAR} local authorities to give constituency overlaps in.`,
		);
	const constituencyReleases = [
		...new Set(Object.values(vintages.constituency)),
	]
		.sort()
		.map((release) => ({
			release,
			codes: [...(resolver.areaCodes("constituency", release) ?? [])],
		}));
	const overlapCrosswalks = resolver
		.crosswalkSummaries()
		.filter(
			(summary) =>
				summary.from.geography === "constituency" &&
				summary.to.geography === "localAuthority" &&
				summary.to.boundaryRelease === overlapLad &&
				(summary.method === "area-overlap" ||
					summary.method === "population-overlap"),
		)
		.map(({ id }) => artifact(id) as OverlapCrosswalk);
	const constituencyOverlaps = compileConstituencyLadOverlaps(
		constituencyReleases,
		overlapCrosswalks,
	);

	const parishToLad = compileParishLadContainment(
		parishReleases,
		from("parish"),
	);

	return new Map([
		["area-lineage.json", JSON.stringify(lineage)],
		[
			"boundary-mappings.json",
			JSON.stringify(encodeBoundaryMappings(containment)),
		],
		[
			"constituency-lad-overlaps.json",
			JSON.stringify({
				version: 1,
				targetLocalAuthorityRelease: overlapLad,
				...constituencyOverlaps,
			}),
		],
		[
			"parish-lad-mappings.json",
			JSON.stringify(encodeParishLadMappings(parishToLad)),
		],
		...Object.entries(lsoaToLad).map(
			([year, mapping]) =>
				[
					lsoaLadMappingsFile(Number(year)),
					JSON.stringify({
						version: 1,
						year: Number(year),
						lsoaToLad: mapping,
					}),
				] as const,
		),
	]);
};
