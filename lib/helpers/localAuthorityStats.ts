import type { SelectedArea } from "@/lib/types";
import { selectedAreaLadCode, type LadResolver } from "./selectedAreaLad";

type LocalAuthorityDataset<DataRecord> = {
	year: number;
	data: Record<string, DataRecord>;
};

/**
 * Select a chart's whole-location aggregate or the record for the selected
 * area's local authority. Each chart supplies the small projection that turns
 * its source record into the fields it displays.
 */
export function localAuthorityStats<DataRecord, Stats>(
	dataset: LocalAuthorityDataset<DataRecord>,
	aggregatedData: Record<number, Stats> | null,
	selectedArea: SelectedArea | null,
	codeMapper: LadResolver | undefined,
	project: (record: DataRecord) => Stats,
): Stats | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;
	const ladCode = selectedAreaLadCode(selectedArea, codeMapper);
	const record = ladCode ? dataset.data[ladCode] : undefined;
	return record === undefined ? null : project(record);
}
