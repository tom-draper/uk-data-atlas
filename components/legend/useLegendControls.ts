import { useState } from "react";
import type { Dataset, EthnicityCode, PartyCode } from "@/lib/types";
import type { CategoryOptions, MapOptions } from "@/lib/types/mapOptions";
import type { ColorRangeDatasetKey, MapOptionsChangeHandler } from "./types";

type ElectionType = "generalElection" | "localElection";

export function useLegendControls(
	activeDataset: Dataset | null,
	mapOptions: MapOptions,
	onMapOptionsChange: MapOptionsChangeHandler,
) {
	const [liveOptions, setLiveOptions] = useState<MapOptions | null>(null);
	const displayOptions = liveOptions || mapOptions;

	const handleRangeInput = (
		datasetKey: ColorRangeDatasetKey,
		min: number,
		max: number,
	) => {
		setLiveOptions((previous) => {
			const base = previous || mapOptions;
			return {
				...base,
				[datasetKey]: { ...base[datasetKey], colorRange: { min, max } },
			};
		});
	};
	const handleRangeChangeEnd = (datasetKey: ColorRangeDatasetKey) => {
		const range = liveOptions?.[datasetKey]?.colorRange;
		if (range) onMapOptionsChange(datasetKey, { colorRange: range });
		setLiveOptions(null);
	};

	const electionType: ElectionType | null =
		activeDataset?.type === "generalElection" ||
		activeDataset?.type === "localElection"
			? activeDataset.type
			: null;
	const electionOptions = electionType ? displayOptions[electionType] : null;
	const ethnicityOptions = displayOptions.ethnicity;

	const toggleCategory = (
		type: ElectionType | "ethnicity",
		id: PartyCode | EthnicityCode,
	) => {
		const options = displayOptions[type];
		if (options.mode === "percentage" && options.selected === id) {
			onMapOptionsChange(type, { mode: "majority", selected: undefined });
		} else {
			onMapOptionsChange(type, { mode: "percentage", selected: id });
		}
	};
	const toggleExcluded = (
		type: ElectionType | "ethnicity",
		id: PartyCode | EthnicityCode,
	) => {
		const excluded = displayOptions[type].excluded ?? [];
		onMapOptionsChange(type, {
			excluded: excluded.includes(id)
				? excluded.filter((item) => item !== id)
				: [...excluded, id],
		});
	};

	const handleElectionRangeInput = (min: number, max: number) => {
		if (!electionType) return;
		setLiveOptions((previous) => {
			const base = previous || mapOptions;
			return {
				...base,
				[electionType]: {
					...base[electionType],
					percentageRange: { min, max },
				},
			};
		});
	};
	const handleElectionRangeChangeEnd = () => {
		if (liveOptions && electionType)
			onMapOptionsChange(electionType, {
				percentageRange: liveOptions[electionType].percentageRange,
			});
		setLiveOptions(null);
	};
	const handleEthnicityRangeInput = (min: number, max: number) => {
		setLiveOptions((previous) => {
			const base = previous || mapOptions;
			return {
				...base,
				ethnicity: { ...base.ethnicity, percentageRange: { min, max } },
			};
		});
	};
	const handleEthnicityRangeChangeEnd = () => {
		if (liveOptions)
			onMapOptionsChange("ethnicity", {
				percentageRange: liveOptions.ethnicity.percentageRange,
			});
		setLiveOptions(null);
	};

	return {
		displayOptions,
		electionType,
		electionOptions,
		showElectionPct: electionOptions?.mode === "percentage",
		showEthnicityPct:
			activeDataset?.type === "ethnicity" &&
			ethnicityOptions.mode === "percentage",
		electionRange: {
			min: electionOptions?.percentageRange?.min ?? 0,
			max:
				(electionOptions as CategoryOptions | null)?.percentageRange
					?.max ?? 100,
		},
		ethnicityRange: {
			min: ethnicityOptions.percentageRange?.min ?? 0,
			max:
				(ethnicityOptions as CategoryOptions).percentageRange?.max ??
				100,
		},
		handleRangeInput,
		handleRangeChangeEnd,
		handlePartyClick: (id: PartyCode) =>
			electionType && toggleCategory(electionType, id),
		handlePartyRightClick: (id: PartyCode) =>
			electionType && toggleExcluded(electionType, id),
		handleEthnicityClick: (id: EthnicityCode) =>
			activeDataset?.type === "ethnicity" &&
			toggleCategory("ethnicity", id),
		handleEthnicityRightClick: (id: EthnicityCode) =>
			activeDataset?.type === "ethnicity" &&
			toggleExcluded("ethnicity", id),
		handlePointLegendClick: (value: string) => {
			if (
				activeDataset?.type !== "custom" ||
				activeDataset.kind !== "points"
			)
				return;
			const numericValue = Number(value);
			if (!Number.isFinite(numericValue)) return;
			onMapOptionsChange("custom", {
				selectedPointValue:
					displayOptions.custom.selectedPointValue === numericValue
						? undefined
						: numericValue,
			});
		},
		handlePointLegendRightClick: (value: string) => {
			if (
				activeDataset?.type !== "custom" ||
				activeDataset.kind !== "points"
			)
				return;
			const numericValue = Number(value);
			if (!Number.isFinite(numericValue)) return;
			const excluded = displayOptions.custom.excludedPointValues ?? [];
			onMapOptionsChange("custom", {
				excludedPointValues: excluded.includes(numericValue)
					? excluded.filter((item) => item !== numericValue)
					: [...excluded, numericValue],
				selectedPointValue:
					displayOptions.custom.selectedPointValue === numericValue
						? undefined
						: displayOptions.custom.selectedPointValue,
			});
		},
		handleNetworkClick: (id: string) => {
			if (activeDataset?.type !== "network") return;
			onMapOptionsChange("network", {
				selected:
					displayOptions.network?.selected === id ? undefined : id,
			});
		},
		handleNetworkRightClick: (id: string) => {
			if (activeDataset?.type !== "network") return;
			const excluded = displayOptions.network?.excluded ?? [];
			onMapOptionsChange("network", {
				excluded: excluded.includes(id)
					? excluded.filter((item) => item !== id)
					: [...excluded, id],
				selected:
					displayOptions.network?.selected === id
						? undefined
						: displayOptions.network?.selected,
			});
		},
		handleElectionRangeInput,
		handleElectionRangeChangeEnd,
		handleEthnicityRangeInput,
		handleEthnicityRangeChangeEnd,
	};
}
