import {
	HousingAffordabilityDataset,
	HousingAffordabilityLADData,
} from "@/lib/types/housingAffordability";
import { parseCsv } from "@/lib/helpers/parseCsv";

export async function loadHousingAffordability(
	content: string,
): Promise<Record<string, HousingAffordabilityDataset>> {
	const { data } = await parseCsv<Record<string, string>>(content, {
		header: true,
	});

	const records: Record<string, HousingAffordabilityLADData> = {};
	for (const row of data) {
		const ladCode = row.areacd?.trim();
		const ladName = row.areanm?.trim();
		const value = row.value?.trim();
		const ratio = Number(value);
		if (!ladCode || !ladName || !value || !Number.isFinite(ratio)) continue;
		records[ladCode] = { ladCode, ladName, ratio };
	}

	return {
		2025: {
			id: "housingAffordability2025",
			type: "housingAffordability",
			year: 2025,
			boundaryType: "localAuthority",
			boundaryYear: 2025,
			data: records,
		},
	};
}
