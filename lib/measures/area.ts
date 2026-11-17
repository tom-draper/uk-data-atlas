import type {
	CodeMapper,
	CodeYearResolver,
} from "@/lib/data/boundaries/codeMapper";
import {
	selectedAreaLadCode,
	type LadResolver,
} from "@/lib/helpers/selectedAreaLad";
import type { SelectedArea } from "@/lib/types";

/**
 * The code of the area a measure read at `geography` and `boundaryYear`
 * should show for the selected area. A ward shows its local authority where
 * the measure is held by authority. Undefined when nothing fits.
 */
export function areaForMeasure(
	selectedArea: SelectedArea | null,
	geography: string,
	boundaryYear: number,
	codeMapper: (CodeYearResolver & LadResolver) | undefined,
): string | undefined {
	if (!selectedArea) return undefined;
	if (geography === "localAuthority") {
		const code = selectedAreaLadCode(selectedArea, codeMapper);
		return code
			? (codeMapper?.getCodeForYear(
					"localAuthority",
					code,
					boundaryYear,
				) ?? code)
			: undefined;
	}
	return selectedArea.type === geography ? selectedArea.code : undefined;
}

type WardMembers = Pick<
	CodeMapper,
	"getWardsForLad" | "getWardsForConstituency"
> &
	Pick<CodeMapper, "getCodeForYear">;

/**
 * The wards inside a selected local authority or constituency, as the codes
 * a ward measure of `boundaryYear` holds them under, for a measure whose
 * figure for such an area is its wards combined. Undefined for any other
 * measure or area, and empty while the ward membership has not loaded.
 */
export function wardsWithin(
	selectedArea: SelectedArea | null,
	geography: string,
	boundaryYear: number,
	codeMapper: WardMembers | undefined,
): string[] | undefined {
	if (!selectedArea || geography !== "ward") return undefined;
	if (
		selectedArea.type !== "localAuthority" &&
		selectedArea.type !== "constituency"
	)
		return undefined;
	if (!codeMapper) return [];
	const wards =
		selectedArea.type === "localAuthority"
			? codeMapper.getWardsForLad(selectedArea.code, boundaryYear)
			: codeMapper.getWardsForConstituency(
					selectedArea.code,
					boundaryYear,
				);
	const held = wards.map(
		(code) => codeMapper.getCodeForYear("ward", code, boundaryYear) ?? code,
	);
	return Array.from(new Set<string>(held));
}
