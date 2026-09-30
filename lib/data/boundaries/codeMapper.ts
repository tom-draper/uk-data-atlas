import {
	followLineage,
	followLineageFromCode,
	listedReleases,
	type AreaLineage,
} from "../../../api/src/resolver/areaLineage";
import { BOUNDARY_CATALOG } from "./catalog";
import type { CodeType, YearCode } from "./mappings";

/** The geographies whose areas are carried across years by a lineage. */
export const LINEAGE_TYPES = [
	"ward",
	"localAuthority",
	"constituency",
] as const;
export type LineageType = (typeof LINEAGE_TYPES)[number];

export interface CodeMapper {
	/**
	 * The code of the same area in the target year's boundaries, as the API's
	 * geography resolver answers it, or undefined where no area of that year
	 * is the same. Pass the year the code is from where it is known, as for a
	 * hovered area; otherwise it is inferred from the code.
	 */
	getCodeForYear(
		type: CodeType,
		code: string,
		targetYear: YearCode,
		fromYear?: YearCode,
	): string | undefined;
	/** Whether the lineage for a geography has loaded, holding every year given. */
	hasAreaLineage(type: CodeType, ...years: YearCode[]): boolean;
	getLadForWard(wardCode: string): string | undefined;
	getConstituencyForWard(
		wardCode: string,
		constituencyYear: YearCode,
	): string | undefined;
	getWardsForLad(ladCode: string, year: YearCode): string[];
	getWardsForConstituency(
		constituencyCode: string,
		wardYear: YearCode,
	): string[];
	getMappingGeneration(): number;
}

/** Resolves a boundary code into the dataset's boundary vintage. */
export type CodeYearResolver = Pick<CodeMapper, "getCodeForYear">;

/** Finds the wards belonging to larger statistical areas. */
export type WardMembershipResolver = Pick<
	CodeMapper,
	"getWardsForLad" | "getWardsForConstituency"
>;

/** Resolves a ward directly or through the larger area which contains it. */
export type WardDataResolver = CodeYearResolver & WardMembershipResolver;

/** Signals that asynchronously loaded mappings have changed. */
export type MappingGenerationReader = Pick<CodeMapper, "getMappingGeneration">;

/** Read-only resolver required by population charts that aggregate wards. */
export type PopulationCodeResolver = WardDataResolver & MappingGenerationReader;

/** The release a year's boundaries are served from: the asset's directory. */
const catalogRelease = (type: CodeType, year: YearCode) =>
	(BOUNDARY_CATALOG[type].vintages as Record<number, string>)[year]
		?.split("/")
		.at(-2);

/** Mutable, framework-independent boundary-code lookup. */
export class CodeMapperStore implements CodeMapper {
	private wardToLad: Record<string, string> = {};
	private ladToWards: Record<number, Record<string, string[]>> = {};
	private constituencyToWards: Record<number, Record<string, string[]>> = {};
	private wardToConstituencies: Record<number, Record<string, string[]>> = {};
	// Constituency mappings arrive asynchronously. Consumers use this token in
	// their aggregate cache keys so an empty result produced before they arrive
	// cannot be retained after the mappings are available.
	private mappingGeneration = 0;
	private lineages: Partial<
		Record<
			LineageType,
			{ lineage: AreaLineage; listed: Map<string, number[]> }
		>
	> = {};

	constructor(
		private readonly releaseForYear: (
			type: CodeType,
			year: YearCode,
		) => string | undefined = catalogRelease,
	) {}

	/** Load the API resolver's lineage for one geography. */
	setAreaLineage = (type: LineageType, lineage: AreaLineage): void => {
		this.lineages[type] = { lineage, listed: listedReleases(lineage) };
		this.mappingGeneration++;
	};

	hasAreaLineage = (type: CodeType, ...years: YearCode[]): boolean => {
		const lineage = this.lineages[type as LineageType]?.lineage;
		return (
			lineage !== undefined &&
			years.every((year) => {
				const release = this.releaseForYear(type, year);
				return (
					release !== undefined && lineage.releases.includes(release)
				);
			})
		);
	};

	/**
	 * The same area's code in every year its lineage holds, the code itself
	 * among them, for a lookup keyed on some other year's codes.
	 */
	private sameAreaCodes = (type: LineageType, code: string): Set<string> => {
		const codes = new Set([code]);
		const entry = this.lineages[type];
		for (const release of entry?.lineage.releases ?? []) {
			const same = followLineageFromCode(
				entry!.lineage,
				entry!.listed,
				code,
				release,
			);
			if (same) codes.add(same);
		}
		return codes;
	};

	getLadForWard = (wardCode: string): string | undefined => {
		const direct = this.wardToLad[wardCode];
		if (direct) return direct;
		for (const sameCode of this.sameAreaCodes("ward", wardCode)) {
			const lad = this.wardToLad[sameCode];
			if (lad) return lad;
		}
		return undefined;
	};

	addWardLadMapping = (
		wardCode: string,
		localAuthorityCode: string,
	): void => {
		if (wardCode && localAuthorityCode)
			this.wardToLad[wardCode] = localAuthorityCode;
	};

	addWardLadMappings = (mappings: Record<string, string>): void => {
		Object.assign(this.wardToLad, mappings);
	};

	getWardsForLad = (ladCode: string, year: YearCode): string[] => {
		const direct = this.ladToWards[year]?.[ladCode];
		if (direct?.length) return direct;
		for (const fallbackYear of [2024, 2022, 2021, 2023]) {
			if (fallbackYear === year) continue;
			const result = this.ladToWards[fallbackYear]?.[ladCode];
			if (result?.length) return result;
		}
		return [];
	};

	addLadWardMappings = (
		year: YearCode,
		mappings: Record<string, string[]>,
	): void => {
		if (year) Object.assign((this.ladToWards[year] ??= {}), mappings);
	};

	addConstituencyWardMappings = (
		year: YearCode,
		mappings: Record<string, string[]>,
	): void => {
		if (year) {
			Object.assign((this.constituencyToWards[year] ??= {}), mappings);
			const reverse = (this.wardToConstituencies[year] ??= {});
			for (const [constituency, wards] of Object.entries(mappings))
				for (const ward of wards) {
					const constituencies = (reverse[ward] ??= []);
					if (!constituencies.includes(constituency))
						constituencies.push(constituency);
				}
			this.mappingGeneration++;
		}
	};

	/**
	 * Finds the best-fit constituency containing a ward. Split wards use the
	 * one membership chosen for ward-data aggregation, so callers must label
	 * the resulting figure as constituency-level rather than ward-level.
	 */
	getConstituencyForWard = (
		wardCode: string,
		constituencyYear: YearCode,
	): string | undefined => {
		const candidates = new Set<string>();
		for (const code of this.sameAreaCodes("ward", wardCode))
			for (const memberships of Object.values(this.wardToConstituencies))
				for (const constituency of memberships[code] ?? [])
					candidates.add(constituency);

		for (const constituency of candidates) {
			const mapped = this.getCodeForYear(
				"constituency",
				constituency,
				constituencyYear,
			);
			if (mapped) return mapped;
		}
		return candidates.values().next().value;
	};

	getMappingGeneration = (): number => this.mappingGeneration;

	getWardsForConstituency = (
		constituencyCode: string,
		wardYear: YearCode,
	): string[] => {
		const direct = this.constituencyToWards[wardYear]?.[constituencyCode];
		if (direct?.length) return direct;
		const currentCode = this.getCodeForYear(
			"constituency",
			constituencyCode,
			2024,
		);
		return currentCode
			? (this.constituencyToWards[wardYear]?.[currentCode] ?? [])
			: [];
	};

	getCodeForYear = (
		type: CodeType,
		code: string,
		targetYear: YearCode,
		fromYear?: YearCode,
	): string | undefined => {
		const entry = this.lineages[type as LineageType];
		const to = this.releaseForYear(type, targetYear);
		if (!entry || !to) return undefined;
		const from =
			fromYear === undefined
				? undefined
				: this.releaseForYear(type, fromYear);
		return from
			? followLineage(entry.lineage, code, from, to)
			: followLineageFromCode(entry.lineage, entry.listed, code, to);
	};

	clearAllMappings = (): void => {
		this.wardToLad = {};
		this.ladToWards = {};
		this.constituencyToWards = {};
		this.wardToConstituencies = {};
		this.lineages = {};
		this.mappingGeneration++;
	};
}
