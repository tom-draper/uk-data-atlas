import type { CodeMapper } from "../data/boundaries/codeMapper";
import type { SelectedArea } from "../types/areas";

export type LadResolver = Partial<
	Pick<CodeMapper, "getLadForWard" | "getCodeForYear">
>;

/**
 * The local authority containing the selected area. Wards resolve through the
 * shared ward→LAD mapping first, because the hovered map record only carries
 * a `ladCode` when the active dataset happens to provide one.
 */
export function selectedAreaLadCode(
	selectedArea: SelectedArea | null,
	codeMapper: LadResolver | undefined,
): string | undefined {
	if (!selectedArea) return undefined;
	switch (selectedArea.type) {
		case "localAuthority":
			return selectedArea.code;
		case "ward":
			return (
				codeMapper?.getLadForWard?.(selectedArea.code) ??
				(selectedArea.data?.ladCode || undefined)
			);
		default:
			return undefined;
	}
}

/**
 * Finds a local-authority-keyed record for the selected area, mapping the LAD
 * code into the dataset's boundary vintage when the direct code is absent.
 */
export function selectedAreaLadRecord<T>(
	data: Record<string, T> | undefined,
	selectedArea: SelectedArea | null,
	codeMapper: LadResolver | undefined,
	boundaryYear: number,
): T | undefined {
	const ladCode = selectedAreaLadCode(selectedArea, codeMapper);
	if (!ladCode || !data) return undefined;
	const direct = data[ladCode];
	if (direct !== undefined) return direct;
	const mapped = codeMapper?.getCodeForYear?.(
		"localAuthority",
		ladCode,
		boundaryYear,
	);
	return mapped ? data[mapped] : undefined;
}
