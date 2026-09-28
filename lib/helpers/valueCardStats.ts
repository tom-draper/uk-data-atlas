import type { ValueCardConfig, ValueCardStats } from "@/lib/datasets/valueCard";
import type { SelectedArea } from "@/lib/types/areas";
import { selectedAreaLadCode, type LadResolver } from "./selectedAreaLad";

export interface ResolvedValueCardStats {
	stats: ValueCardStats;
	/** True when a smaller area is shown its local authority's figures. */
	viaLocalAuthority: boolean;
}

type CardDataset = {
	boundaryType: string;
	boundaryYear: number;
	data: Record<string, unknown>;
};

const found = (
	stats: ValueCardStats | null,
	viaLocalAuthority = false,
): ResolvedValueCardStats | null =>
	stats ? { stats, viaLocalAuthority } : null;

/**
 * The figures a value card shows for the selected area. Local authority
 * datasets resolve a ward through the shared ward→LAD mapping and a code of
 * another vintage through the code mapper; the aggregate stands in when no
 * area is selected, and the active dataset may fall back to the map's own
 * hover record.
 */
export function resolveValueCardStats(
	config: ValueCardConfig,
	dataset: CardDataset,
	aggregate: unknown,
	selectedArea: SelectedArea | null,
	codeMapper: LadResolver | undefined,
	isActive: boolean,
): ResolvedValueCardStats | null {
	if (!selectedArea)
		return aggregate ? found(config.fromAggregate(aggregate)) : null;

	if (dataset.boundaryType === "localAuthority") {
		const ladCode = selectedAreaLadCode(selectedArea, codeMapper);
		if (ladCode) {
			const mapped = codeMapper?.getCodeForYear?.(
				"localAuthority",
				ladCode,
				dataset.boundaryYear,
			);
			const stats =
				config.fromRecord(dataset, ladCode) ??
				(mapped ? config.fromRecord(dataset, mapped) : null);
			if (stats)
				return found(stats, selectedArea.type !== "localAuthority");
		}
	} else if (selectedArea.type === dataset.boundaryType) {
		const stats = config.fromRecord(dataset, selectedArea.code);
		if (stats) return found(stats);
	}

	return isActive && config.fromHover
		? found(config.fromHover(selectedArea.data))
		: null;
}
