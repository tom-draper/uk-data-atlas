// hooks/useBoundaryData.ts
import {
	startTransition,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type { BoundaryData, BoundaryGeojson } from "@lib/types";
import type { BoundaryType } from "../data/boundaries/catalog";
import {
	EMPTY_BOUNDARY_DATA,
	fetchBoundaryPropertyGroup,
} from "../data/boundaries/propertyLoader";
import {
	completedBoundaryTypes,
	mergeBoundaryGroups,
	type BoundaryGroupResult,
} from "../data/boundaries/loadState";
import {
	deriveBoundaryMappings,
	seedBoundaryMappings,
	type BoundaryMappingTarget,
} from "../data/boundaries/mappingSeeder";
import { extractWardCodes } from "../data/boundaries/wardCodes";
import { requiredBoundaryTypes } from "../datasets/boundaryRequirements";
import {
	fetchConstituencyLadOverlaps,
	type ConstituencyLadOverlaps,
} from "../data/boundaries/constituencyLadOverlaps";
import { getCachedFilteredBoundaryData } from "../data/boundaries/locationFilter";
import {
	DEFAULT_VISIBILITY,
	getVisibilitySnapshot,
	subscribeVisibility,
} from "../context/ChartVisibilityContext";

/**
 * Hook to load and filter boundary data
 * Now accepts the full codeMapper from useCodeMapper()
 */
export function useBoundaryData(
	activeBoundaryType?: BoundaryType,
	selectedLocation?: string,
	codeMapper?: BoundaryMappingTarget,
) {
	const [rawData, setRawData] = useState<BoundaryData>(EMPTY_BOUNDARY_DATA);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const [constituencyLadOverlaps, setConstituencyLadOverlaps] =
		useState<ConstituencyLadOverlaps | null>(null);

	// Kept separately because filtering is memoized independently of loading.
	const getLadForWard = codeMapper?.getLadForWard;

	// Only the geographies the visible charts can actually aggregate against,
	// rather than every boundary the catalogue serves. Subscribed rather than
	// read once, so enabling a chart loads what it needs.
	const visibility = useSyncExternalStore(
		subscribeVisibility,
		getVisibilitySnapshot,
		() => DEFAULT_VISIBILITY,
	);
	const requiredKey = useMemo(
		() =>
			[...requiredBoundaryTypes(visibility, [activeBoundaryType])]
				.sort()
				.join(","),
		[visibility, activeBoundaryType],
	);
	const loadedTypes = useRef(new Set<BoundaryType>());

	useEffect(() => {
		let mounted = true;

		const loadBoundaries = () => {
			setIsLoading(true);
			setError(null);

			const precompiledMappings = codeMapper
				? seedBoundaryMappings(codeMapper)
				: Promise.resolve(false);

			// Fetch only what is newly required; anything already held stays.
			const wanted = requiredKey
				? (requiredKey.split(",") as BoundaryType[])
				: [];
			const missing = wanted.filter(
				(type) => !loadedTypes.current.has(type),
			);
			const overlaps = wanted.includes("constituency")
				? fetchConstituencyLadOverlaps().catch((error) => {
						console.warn(
							"[boundaries] Falling back to constituency bbox filtering:",
							error,
						);
						return null;
					})
				: Promise.resolve(null);

			Promise.all([
				precompiledMappings,
				Promise.all(
					missing.map(async (type) => {
						const { data, failures } =
							await fetchBoundaryPropertyGroup(type);
						return [type, { data, failures }] as const;
					}),
				),
				overlaps,
			])
				.then(([mappingsApplied, groups, loadedOverlaps]) => {
					if (!mounted) return;
					const boundaryGroups = groups as BoundaryGroupResult[];
					if (loadedOverlaps)
						setConstituencyLadOverlaps(loadedOverlaps);

					for (const type of completedBoundaryTypes(boundaryGroups))
						loadedTypes.current.add(type);
					const fetched = Object.fromEntries(
						boundaryGroups.map(([type, { data }]) => [type, data]),
					) as Partial<
						Record<BoundaryType, Record<number, BoundaryGeojson>>
					>;

					// Whatever did load is still worth drawing, so keep it and
					// report the gaps alongside rather than instead.
					const failures = boundaryGroups.flatMap(
						([, { failures: groupFailures }]) => groupFailures,
					);
					if (failures.length > 0) {
						setError(new Error(failures.join("; ")));
					}

					startTransition(() => {
						setRawData((previous) =>
							mergeBoundaryGroups(previous, boundaryGroups),
						);
						setIsLoading(false);
					});

					if (!mappingsApplied && codeMapper)
						deriveBoundaryMappings(fetched, codeMapper);
				})
				.catch((err) => {
					if (mounted) {
						setError(
							err instanceof Error
								? err
								: new Error("Failed to load boundaries"),
						);
						setIsLoading(false);
					}
				});
		};

		loadBoundaries();

		return () => {
			mounted = false;
		};
	}, [requiredKey, codeMapper]);

	const loc = selectedLocation || null;

	const filteredData = useMemo<BoundaryData>(() => {
		if (isLoading) return EMPTY_BOUNDARY_DATA;
		return getCachedFilteredBoundaryData(
			rawData,
			loc,
			getLadForWard,
			constituencyLadOverlaps,
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [rawData, loc, constituencyLadOverlaps]);

	const wardCodes = useMemo(
		() => extractWardCodes(rawData, isLoading),
		[rawData, isLoading],
	);

	return {
		boundaryData: filteredData,
		wardCodes,
		constituencyLadOverlaps,
		isLoading,
		error,
	};
}
