import type { CodeMapper } from "@/lib/data/boundaries/codeMapper";
import { LINEAGE_TYPES } from "@/lib/data/boundaries/codeMapper";
import type { BoundaryType } from "@/lib/types";

export type AreaInYear =
	/**
	 * `realigned` where the area found succeeded the picked one across a
	 * small redrawing, rather than being the same area.
	 */
	| { status: "found"; code: string; realigned?: true }
	/** No area of that year's boundaries is the same as the one picked. */
	| { status: "boundaries-changed" };

type PickedArea = { type: BoundaryType; code: string; boundaryYear?: number };

/**
 * Where a picked area's figures are in a dataset of another boundary year.
 *
 * An area picked from the map knows its boundary year, so once the resolver's
 * lineage has loaded the answer is exact: the code the same area has in that
 * year, or that no area of that year is the same one, even where one carries
 * its code. Otherwise the code is looked up as it is, then as the lineage
 * infers it.
 */
export const areaInYear = (
	mapper:
		| (Pick<CodeMapper, "getCodeForYear"> &
				Partial<Pick<CodeMapper, "hasAreaLineage" | "isRealigned">>)
		| undefined,
	area: PickedArea,
	targetYear: number,
	holds: (code: string) => boolean,
): AreaInYear | undefined => {
	const tracked = (LINEAGE_TYPES as readonly string[]).includes(area.type);
	if (
		mapper &&
		tracked &&
		area.boundaryYear !== undefined &&
		mapper.hasAreaLineage?.(area.type, area.boundaryYear, targetYear)
	) {
		const code = mapper.getCodeForYear(
			area.type,
			area.code,
			targetYear,
			area.boundaryYear,
		);
		if (code === undefined) return { status: "boundaries-changed" };
		return mapper.isRealigned?.(
			area.type,
			area.code,
			targetYear,
			area.boundaryYear,
		)
			? { status: "found", code, realigned: true }
			: { status: "found", code };
	}
	if (holds(area.code)) return { status: "found", code: area.code };
	const mapped = mapper?.getCodeForYear(area.type, area.code, targetYear);
	return mapped && holds(mapped)
		? { status: "found", code: mapped }
		: undefined;
};
