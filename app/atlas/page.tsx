import { Suspense } from "react";
import AtlasClient from "@/components/AtlasClient";
import LoadingDisplay from "@/components/displays/LoadingDisplay";

export default function MapsPage() {
	return (
		<Suspense fallback={<LoadingDisplay />}>
			<AtlasClient />
		</Suspense>
	);
}
