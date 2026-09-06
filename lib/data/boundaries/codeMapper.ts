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
});

const emptyReverseMappings = (): ReverseCodeMappings => ({
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
});

/** Mutable, framework-independent boundary-code lookup. */
export class CodeMapperStore implements CodeMapper {
	private wardToLad: Record<string, string> = {};
	private ladToWards: Record<number, Record<string, string[]>> = {};
	private constituencyToWards: Record<number, Record<string, string[]>> = {};
	private codeMappings = emptyCodeMappings();
	private reverseMappings: ReverseCodeMappings = emptyReverseMappings();

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
		if (year)
			Object.assign((this.constituencyToWards[year] ??= {}), mappings);
	};

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

	addCodeMapping = (
		type: CodeType,
		fromCode: string,
		toYear: YearCode,
		toCode: string,
	): void => {
		if (!fromCode || !toYear || !toCode) return;
		(this.codeMappings[type][fromCode] ??= {})[toYear] = toCode;
		(this.reverseMappings[type][toCode] ??= new Set()).add(fromCode);
	};

	addCodeMappings = (type: CodeType, mappings: CodeMapping): void => {
		Object.assign(this.codeMappings[type], mappings);
		for (const [fromCode, yearMap] of Object.entries(mappings)) {
			for (const toCode of Object.values(yearMap)) {
				(this.reverseMappings[type][toCode] ??= new Set()).add(
					fromCode,
				);
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
		[...(this.reverseMappings[type][targetCode] ?? [])].filter(
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
		for (const sourceCode of this.reverseMappings[type][code] ?? []) {
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
		this.codeMappings = emptyCodeMappings();
		this.reverseMappings = emptyReverseMappings();
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
			this.reverseMappings[type] = {};
		} else {
			this.codeMappings = emptyCodeMappings();
			this.reverseMappings = emptyReverseMappings();
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
