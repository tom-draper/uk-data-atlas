"use client";

import type { CategoryDatasetId, MapOptions } from "@/lib/types/mapOptions";
import { renderCategoryLegend } from "../legendUtils";
import type { CategoryDisplayData, PartyDisplayData } from "./types";

interface CategoryLegendProps {
	displayOptions: MapOptions;
	overlayOpacity: number;
	isDark: boolean;
}

export function CategoryLegend({
	displayOptions,
	overlayOpacity,
	isDark,
	categories,
	datasetType,
	onClick,
	onRightClick,
}: CategoryLegendProps & {
	categories: CategoryDisplayData[];
	datasetType: CategoryDatasetId;
	onClick: (id: string) => void;
	onRightClick: (id: string) => void;
}) {
	const options = displayOptions[datasetType];
	return renderCategoryLegend(
		categories,
		options?.mode === "percentage",
		options?.selected,
		onClick,
		overlayOpacity,
		isDark,
		new Set(options?.excluded ?? []),
		onRightClick,
	);
}

export function PartyLegend({
	displayOptions,
	overlayOpacity,
	isDark,
	parties,
	datasetType,
	onClick,
	onRightClick,
}: CategoryLegendProps & {
	parties: PartyDisplayData[];
	datasetType: "general-election" | "local-election";
	onClick: (id: string) => void;
	onRightClick: (id: string) => void;
}) {
	const options = displayOptions[datasetType];
	return renderCategoryLegend(
		parties,
		options?.mode === "percentage",
		options?.selected,
		onClick,
		overlayOpacity,
		isDark,
		new Set(options?.excluded ?? []),
		onRightClick,
	);
}

export function NetworkLegend({
	displayOptions,
	overlayOpacity,
	isDark,
	items,
	onClick,
	onRightClick,
}: CategoryLegendProps & {
	items: { id: string; color: string; name: string }[];
	onClick: (id: string) => void;
	onRightClick: (id: string) => void;
}) {
	const options = displayOptions.network;
	return renderCategoryLegend(
		items,
		true,
		options?.selected,
		onClick,
		overlayOpacity,
		isDark,
		new Set(options?.excluded ?? []),
		onRightClick,
	);
}
