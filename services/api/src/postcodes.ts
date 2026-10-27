export {
	compactPostcode,
	NORTHERN_IRELAND_EXCLUSION,
	parsePostcode,
} from "../../../shared/postcodeRules";
export type { ParsedPostcode } from "../../../shared/postcodeRules";

export type {
	PostcodeSource,
	PostcodeIndexArtifact,
	PostcodeShard,
} from "../../../shared/postcodeIndexTypes";

export * from "../../../shared/postcodeIndex";

export { postcodeLookupPoint } from "../../../shared/postcodeLookupPoint";
