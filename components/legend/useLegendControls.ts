import { useState } from "react";
import type { Dataset, PartyCode } from "@/lib/types";
import { isCategoryDataset } from "@/lib/datasets/categories";
import type {
	CategoryDatasetId,
	CategoryOptions,
	MapOptions,
} from "@/lib/types/mapOptions";
import type { ColorRangeDatasetKey, MapOptionsChangeHandler } from "./types";

type ElectionType = "general-election" | "local-election";

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
		activeDataset?.type === "general-election" ||
		activeDataset?.type === "local-election"
			? activeDataset.type
			: null;
	const electionOptions = electionType ? displayOptions[electionType] : null;
	const categoryType: CategoryDatasetId | null =
		activeDataset && isCategoryDataset(activeDataset.type)
			? activeDataset.type
			: null;
	const categoryOptions = categoryType ? displayOptions[categoryType] : null;

	const toggleCategory = (
		type: ElectionType | CategoryDatasetId,
		id: string,
	) => {
		const options = displayOptions[type];
		if (options.mode === "percentage" && options.selected === id) {
			onMapOptionsChange(type, { mode: "majority", selected: undefined });
		} else {
			// Selecting a crossed out category brings it back.
			onMapOptionsChange(type, {
				mode: "percentage",
				selected: id,
				excluded: (options.excluded ?? []).filter(
					(item) => item !== id,
				),
			});
		}
	};
	const toggleExcluded = (
		type: ElectionType | CategoryDatasetId,
		id: string,
	) => {
		const options = displayOptions[type];
		const excluded = options.excluded ?? [];
		if (excluded.includes(id)) {
			onMapOptionsChange(type, {
				excluded: excluded.filter((item) => item !== id),
			});
		} else if (options.mode === "percentage" && options.selected === id) {
			// Crossing out the selected category clears the selection.
			onMapOptionsChange(type, {
				mode: "majority",
				selected: undefined,
				excluded: [...excluded, id],
			});
		} else {
			onMapOptionsChange(type, { excluded: [...excluded, id] });
		}
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
	const handleElectionTurnoutRangeInput = (min: number, max: number) => {
		if (!electionType) return;
		setLiveOptions((previous) => {
			const base = previous || mapOptions;
			return {
				...base,
				[electionType]: {
					...base[electionType],
					turnoutRange: { min, max },
				},
			};
		});
	};
	const handleElectionTurnoutRangeChangeEnd = () => {
		if (liveOptions && electionType)
			onMapOptionsChange(electionType, {
				turnoutRange: liveOptions[electionType].turnoutRange ?? {
					min: 0,
					max: 100,
				},
			});
		setLiveOptions(null);
	};
	const handleCategoryRangeInput = (min: number, max: number) => {
		if (!categoryType) return;
		setLiveOptions((previous) => {
			const base = previous || mapOptions;
			return {
				...base,
				[categoryType]: {
					...base[categoryType],
					percentageRange: { min, max },
				},
			};
		});
	};
	const handleCategoryRangeChangeEnd = () => {
		if (liveOptions && categoryType)
			onMapOptionsChange(categoryType, {
				percentageRange: liveOptions[categoryType].percentageRange,
			});
		setLiveOptions(null);
	};

	return {
		displayOptions,
		electionType,
		electionOptions,
		showElectionPct: electionOptions?.mode === "percentage",
		showElectionTurnout: electionOptions?.metric === "turnout",
		categoryOptions,
		electionRange: {
			min: electionOptions?.percentageRange?.min ?? 0,
			max:
				(electionOptions as CategoryOptions | null)?.percentageRange
					?.max ?? 50,
		},
		electionTurnoutRange: electionOptions?.turnoutRange ?? {
			min: 0,
			max: 100,
		},
		categoryRange: {
			min: categoryOptions?.percentageRange?.min ?? 0,
			max: categoryOptions?.percentageRange?.max ?? 100,
		},
		handleRangeInput,
		handleRangeChangeEnd,
		handlePartyClick: (id: PartyCode) =>
			electionType && toggleCategory(electionType, id),
		handlePartyRightClick: (id: PartyCode) =>
			electionType && toggleExcluded(electionType, id),
		handleCategoryClick: (id: string) =>
			categoryType && toggleCategory(categoryType, id),
		handleCategoryRightClick: (id: string) =>
			categoryType && toggleExcluded(categoryType, id),
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
				excludedPointValues: (
					displayOptions.custom.excludedPointValues ?? []
				).filter((item) => item !== numericValue),
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
				excluded: (displayOptions.network?.excluded ?? []).filter(
					(item) => item !== id,
				),
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
		handleElectionTurnoutRangeInput,
		handleElectionTurnoutRangeChangeEnd,
		handleCategoryRangeInput,
		handleCategoryRangeChangeEnd,
	};
}
