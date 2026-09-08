import type { CodeMapping, CodeType, YearCode } from "./mappings";

export interface CodeMapper {
	getCodeForYear(
		type: CodeType,
		code: string,
		targetYear: YearCode,
	): string | undefined;
	getWardsForLad(ladCode: string, year: YearCode): string[];
	getWardsForConstituency(
		constituencyCode: string,
		wardYear: YearCode,
	): string[];
	getMappingGeneration(): number;
}

type CodeMappings = Record<CodeType, CodeMapping>;
type ReverseCodeMappings = Record<CodeType, Record<string, Set<string>>>;

const emptyCodeMappings = (): CodeMappings => ({
	ward: {},
	localAuthority: {},
	constituency: {},
	lsoa: {},
	dataZone: {},
	superOutputArea: {},
	country: {},
	localPlanningAuthority: {},
	region: {},
	countyAndUnitaryAuthority: {},
	integratedCareBoard: {},
	msoa: {},
	communitySafetyPartnership: {},
	policeForceArea: {},
	combinedAuthority: {},
	itl1: {},
	itl2: {},
	itl3: {},
	majorTownAndCity: {},
	scottishParliamentaryConstituency: {},
	scottishParliamentaryRegion: {},
	seneddConstituency: {},
	seneddElectoralRegion: {},
	localHealthBoard: {},
	nhsEnglandRegion: {},
	subIntegratedCareBoardLocation: {},
	fireAndRescueAuthority: {},
	nationalPark: {},
	countyElectoralDivision: {},
	travelToWorkArea: {},
	parish: {},
});

/** Mutable, framework-independent boundary-code lookup. */
export class CodeMapperStore implements CodeMapper {
	private wardToLad: Record<string, string> = {};
	private ladToWards: Record<number, Record<string, string[]>> = {};
	private constituencyToWards: Record<number, Record<string, string[]>> = {};
	// Constituency mappings arrive asynchronously. Consumers use this token in
	// their aggregate cache keys so an empty result produced before they arrive
	// cannot be retained after the mappings are available.
	private mappingGeneration = 0;
	private codeMappings = emptyCodeMappings();
	// Built per geography on first read rather than alongside the forward
	// mappings. The precompiled file carries 124k ward pairs, so maintaining it
	// eagerly cost ~15k Sets (5 MB) on every load for a lookup only the
	// highlight helpers below ever perform.
	private reverseMappings: Partial<ReverseCodeMappings> = {};

	getLadForWard = (wardCode: string): string | undefined => {
		const direct = this.wardToLad[wardCode];
		if (direct) return direct;
		for (const equivalentCode of Object.values(
			this.codeMappings.ward[wardCode] ?? {},
		)) {
			const lad = this.wardToLad[equivalentCode];
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

	addLadWardMapping = (
		year: YearCode,
		ladCode: string,
		wardCodes: string[],
	): void => {
		if (!year || !ladCode || !wardCodes.length) return;
		(this.ladToWards[year] ??= {})[ladCode] = wardCodes;
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
			this.mappingGeneration++;
		}
	};

	getMappingGeneration = (): number => this.mappingGeneration;

	getWardsForConstituency = (
		constituencyCode: string,
		wardYear: YearCode,
	): string[] => {
		const direct = this.constituencyToWards[wardYear]?.[constituencyCode];
		if (direct?.length) return direct;
		const currentCode =
			this.codeMappings.constituency[constituencyCode]?.[2024];
		return currentCode
			? (this.constituencyToWards[wardYear]?.[currentCode] ?? [])
			: [];
	};

	/**
	 * Which codes map *to* each code, for one geography. Derived from the
	 * forward mappings the first time something asks, and kept in step by the
	 * add methods only once it exists.
	 */
	private reverseFor = (type: CodeType): Record<string, Set<string>> => {
		const cached = this.reverseMappings[type];
		if (cached) return cached;

		const reverse: Record<string, Set<string>> = {};
		for (const [fromCode, yearMap] of Object.entries(
			this.codeMappings[type],
		)) {
			for (const toCode of Object.values(yearMap)) {
				(reverse[toCode] ??= new Set()).add(fromCode);
			}
		}
		this.reverseMappings[type] = reverse;
		return reverse;
	};

	addCodeMapping = (
		type: CodeType,
		fromCode: string,
		toYear: YearCode,
		toCode: string,
	): void => {
		if (!fromCode || !toYear || !toCode) return;
		(this.codeMappings[type][fromCode] ??= {})[toYear] = toCode;
		const reverse = this.reverseMappings[type];
		if (reverse) (reverse[toCode] ??= new Set()).add(fromCode);
	};

	addCodeMappings = (type: CodeType, mappings: CodeMapping): void => {
		Object.assign(this.codeMappings[type], mappings);
		const reverse = this.reverseMappings[type];
		if (!reverse) return;
		for (const [fromCode, yearMap] of Object.entries(mappings)) {
			for (const toCode of Object.values(yearMap)) {
				(reverse[toCode] ??= new Set()).add(fromCode);
			}
		}
	};

	getCodeForYear = (
		type: CodeType,
		code: string,
		targetYear: YearCode,
	): string | undefined => this.codeMappings[type][code]?.[targetYear];

	getAllEquivalentCodes = (
		type: CodeType,
		code: string,
	): Array<{ year: YearCode; code: string }> =>
		Object.entries(this.codeMappings[type][code] ?? {}).map(
			([year, mappedCode]) => ({
				year: Number(year),
				code: mappedCode,
			}),
		);

	findSourceCodes = (
		type: CodeType,
		targetCode: string,
		targetYear: YearCode,
	): string[] =>
		[...(this.reverseFor(type)[targetCode] ?? [])].filter(
			(sourceCode) =>
				this.codeMappings[type][sourceCode]?.[targetYear] ===
				targetCode,
		);

	getHighlightCodes = (type: CodeType, code: string): Set<string> => {
		const codes = new Set<string>([code]);
		for (const mappedCode of Object.values(
			this.codeMappings[type][code] ?? {},
		))
			codes.add(mappedCode);
		for (const sourceCode of this.reverseFor(type)[code] ?? []) {
			codes.add(sourceCode);
			for (const mappedCode of Object.values(
				this.codeMappings[type][sourceCode] ?? {},
			))
				codes.add(mappedCode);
		}
		return codes;
	};

	clearAllMappings = (): void => {
		this.wardToLad = {};
		this.ladToWards = {};
		this.constituencyToWards = {};
		this.mappingGeneration++;
		this.codeMappings = emptyCodeMappings();
		this.reverseMappings = {};
	};

	clearWardLadMap = (): void => {
		this.wardToLad = {};
	};
	clearLadWardMap = (): void => {
		this.ladToWards = {};
	};

	clearCodeMappings = (type?: CodeType): void => {
		if (type) {
			this.codeMappings[type] = {};
			delete this.reverseMappings[type];
		} else {
			this.codeMappings = emptyCodeMappings();
			this.reverseMappings = {};
		}
	};

	getMappingCounts = () => {
		const ladToWards: Record<number, number> = {};
		for (const [year, mappings] of Object.entries(this.ladToWards)) {
			ladToWards[Number(year)] = Object.keys(mappings).length;
		}
		return {
			wardToLad: Object.keys(this.wardToLad).length,
			ladToWards,
			ward: Object.keys(this.codeMappings.ward).length,
			localAuthority: Object.keys(this.codeMappings.localAuthority)
				.length,
			constituency: Object.keys(this.codeMappings.constituency).length,
		};
	};
}
