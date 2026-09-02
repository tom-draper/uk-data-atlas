import type { BoundaryType } from "@/lib/types";
import type { AggregatedCustomData, CustomDataset } from "@/lib/types/custom";

interface SelectedCustomArea {
	code: string;
	type: BoundaryType;
}

interface CustomCodeMapper {
	getCodeForYear(type: BoundaryType, code: string, targetYear: number): string | undefined;
	getWardsForLad(localAuthorityCode: string, year: number): string[];
}

export interface CustomDatasetDisplayValue {
	value: number;
	count: number;
}

export function getCustomDatasetDisplayValue(
	dataset: CustomDataset,
	selectedArea: SelectedCustomArea | null,
	codeMapper: CustomCodeMapper,
	aggregatedData: Record<string, AggregatedCustomData> | null,
): CustomDatasetDisplayValue | null {
	if (selectedArea) {
		const directValue = dataset.data[selectedArea.code];
		if (directValue !== undefined) return { value: directValue, count: 1 };

		const mappedCode = codeMapper.getCodeForYear(
			selectedArea.type,
			selectedArea.code,
			dataset.boundaryYear,
		);
		const mappedValue = mappedCode ? dataset.data[mappedCode] : undefined;
		if (mappedValue !== undefined) return { value: mappedValue, count: 1 };

		if (selectedArea.type === "localAuthority") {
			let value = 0;
			let count = 0;
			for (const wardCode of codeMapper.getWardsForLad(selectedArea.code, dataset.boundaryYear)) {
				const mappedWardCode = codeMapper.getCodeForYear(
					"ward",
					wardCode,
					dataset.boundaryYear,
				);
				const wardValue = dataset.data[wardCode] ?? (mappedWardCode ? dataset.data[mappedWardCode] : undefined);
				if (wardValue !== undefined) {
					value += wardValue;
					count++;
				}
			}
			if (count > 0) return { value, count };
		}
	}

	const aggregate = aggregatedData?.[dataset.year];
	return aggregate ? { value: aggregate.average, count: aggregate.count } : null;
}
