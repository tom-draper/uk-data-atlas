import type { CodeYearResolver } from "@/lib/data/boundaries/codeMapper";
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
