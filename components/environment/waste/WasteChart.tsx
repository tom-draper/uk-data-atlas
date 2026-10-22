"use client";

import ValueCard from "@/components/ValueCard";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { wasteCard } from "@/lib/datasets/waste";

export default function WasteChart(props: ChartComponentProps) {
	const options = useCurrentMapOptions().waste;
	return <ValueCard {...props} card={wasteCard(options)} />;
}
