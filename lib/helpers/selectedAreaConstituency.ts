import type { CodeMapper } from "../data/boundaries/codeMapper";
import type { SelectedArea } from "../types/areas";

export type ConstituencyResolver = Partial<
	Pick<CodeMapper, "getCodeForYear" | "getConstituencyForWard">
>;

/**
 * Finds a constituency-keyed record for the selected area. Wards use the
 * shared best-fit membership, so the returned record is always a
 * constituency-level figure and never an invented ward estimate.
 */
export function selectedAreaConstituencyRecord<T>(
	data: Record<string, T> | undefined,
	selectedArea: SelectedArea | null,
	codeMapper: ConstituencyResolver | undefined,
	boundaryYear: number,
): T | undefined {
	if (!selectedArea || !data) return undefined;
	const constituencyCode =
		selectedArea.type === "constituency"
			? selectedArea.code
			: selectedArea.type === "ward"
				? codeMapper?.getConstituencyForWard?.(
						selectedArea.code,
						boundaryYear,
					)
				: undefined;
	if (!constituencyCode) return undefined;

	const direct = data[constituencyCode];
	if (direct !== undefined) return direct;
	const mapped = codeMapper?.getCodeForYear?.(
		"constituency",
		constituencyCode,
		boundaryYear,
	);
	return mapped ? data[mapped] : undefined;
}
