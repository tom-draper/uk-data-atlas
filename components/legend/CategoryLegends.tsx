"use client";

import type { MapOptions } from "@/lib/types/mapOptions";
import { renderCategoryLegend } from "../legendUtils";
import type { EthnicityDisplayData, PartyDisplayData } from "./types";

interface CategoryLegendProps {
	displayOptions: MapOptions;
	overlayOpacity: number;
	isDark: boolean;
}

export function EthnicityLegend({
	displayOptions,
	overlayOpacity,
	isDark,
	ethnicities,
	onClick,
	onRightClick,
}: CategoryLegendProps & {
	ethnicities: EthnicityDisplayData[];
	onClick: (id: string) => void;
	onRightClick: (id: string) => void;
}) {
	const options = displayOptions.ethnicity;
	return renderCategoryLegend(
		ethnicities,
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
	datasetType: "generalElection" | "localElection";
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
