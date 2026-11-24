"use client";

import { useEffect, useState } from "react";
import {
	councilDataZones,
	type CouncilDataZones,
	type DataZoneRelease,
	fetchDataZoneLadMappings,
} from "@/lib/data/boundaries/dataZoneLadMappings";

export type CouncilDataZonesState =
	| { status: "idle" | "loading" | "failed" }
	| { status: "ready"; dataZones: CouncilDataZones | undefined };

/**
 * The data zones of a council, once the lookup has loaded. Idle when no
 * council is given, so the lookup is only fetched for the nations that need
 * it.
 */
export function useCouncilDataZones(
	ladCode: string | undefined,
): CouncilDataZonesState {
	const [releases, setReleases] = useState<
		DataZoneRelease[] | "failed" | null
	>(null);

	useEffect(() => {
		if (!ladCode || releases) return;
		let cancelled = false;
		fetchDataZoneLadMappings()
			.then((loaded) => {
				if (!cancelled) setReleases(loaded);
			})
			.catch((error: unknown) => {
				console.warn(
					"[dataZone] data zone/LAD mapping unavailable:",
					error,
				);
				if (!cancelled) setReleases("failed");
			});
		return () => {
			cancelled = true;
		};
	}, [ladCode, releases]);

	if (!ladCode) return { status: "idle" };
	if (releases === "failed") return { status: "failed" };
	if (!releases) return { status: "loading" };
	return { status: "ready", dataZones: councilDataZones(releases, ladCode) };
}
