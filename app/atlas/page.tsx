import { Suspense } from "react";
import type { Metadata } from "next";
import AtlasClient from "@/components/AtlasClient";
import LoadingDisplay from "@/components/displays/LoadingDisplay";

export const metadata: Metadata = {
	title: "Explore - UK Data Atlas",
	description:
		"Explore interactive maps of UK elections, demographics, house prices, crime, income, ethnicity and more. Filter by region, ward or constituency.",
	openGraph: {
		title: "Explore - UK Data Atlas",
		description:
			"Interactive maps of UK elections, demographics, house prices, crime, income, ethnicity and more.",
	},
};

export default function MapsPage() {
	return (
		<Suspense fallback={<LoadingDisplay />}>
			<AtlasClient />
		</Suspense>
	);
}
