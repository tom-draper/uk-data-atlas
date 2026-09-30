import type { BoundaryType } from "@/lib/types";
import type { AggregatedCustomData, CustomDataset } from "@/lib/types/custom";
import { areaInYear } from "@/lib/helpers/areaInYear";

interface SelectedCustomArea {
	code: string;
	type: BoundaryType;
	boundaryYear?: number;
}

interface CustomCodeMapper {
	getCodeForYear(
		type: BoundaryType,
		code: string,
		targetYear: number,
	): string | undefined;
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
	aggregatedData: Record<string, AggregatedCustomData | null> | null,
): CustomDatasetDisplayValue | null {
	if (selectedArea) {
		const found = areaInYear(
			codeMapper,
			selectedArea,
			dataset.boundaryYear,
			(code) => dataset.data[code] !== undefined,
		);
		const value =
			found?.status === "found" ? dataset.data[found.code] : undefined;
		if (value !== undefined) return { value, count: 1 };
		if (found?.status === "boundaries-changed") return null;

		if (selectedArea.type === "localAuthority") {
			let value = 0;
			let count = 0;
			for (const wardCode of codeMapper.getWardsForLad(
				selectedArea.code,
				dataset.boundaryYear,
			)) {
				const mappedWardCode = codeMapper.getCodeForYear(
					"ward",
					wardCode,
					dataset.boundaryYear,
				);
				const wardValue =
					dataset.data[wardCode] ??
					(mappedWardCode ? dataset.data[mappedWardCode] : undefined);
				if (wardValue !== undefined) {
					value += wardValue;
					count++;
				}
			}
			if (count > 0) return { value, count };
		}
	}

	const aggregate = aggregatedData?.[dataset.year];
	return aggregate
		? { value: aggregate.average, count: aggregate.count }
		: null;
}
