// hooks/useBoundaryData.ts
import { startTransition, useEffect, useRef, useState } from "react";
import { BoundaryData, BoundaryCodes, BoundaryGeojson } from "@lib/types";
import {
	BoundaryType,
	decodeBoundary,
	fetchRawBoundary,
	filterFeatures,
	GEOJSON_PATHS,
	PROPERTY_KEYS,
} from "../data/boundaries/boundaries";
import {
	extractWardLadMappings,
	buildCrossYearMappings,
	buildConstituencyWardMappings,
} from "./useCodeMapper";
import type { CodeMapping, CodeType, YearCode } from "./useCodeMapper";

const emptyBoundaryData = (): BoundaryData => ({
	ward: {},
	constituency: {},
	localAuthority: {},
	lsoa: {},
	dataZone: {},
	superOutputArea: {},
});

const emptyBoundaryCodes = (): NonNullable<BoundaryCodes> => ({
	ward: {},
	constituency: {},
	localAuthority: {},
	lsoa: {},
	dataZone: {},
	superOutputArea: {},
});

// Flattened list of every boundary file we can load: { type, year, path }.
interface BoundaryEntry {
	type: BoundaryType;
	year: number;
	path: string;
}
const BOUNDARY_ENTRIES: BoundaryEntry[] = (
	Object.keys(GEOJSON_PATHS) as BoundaryType[]
).flatMap((type) =>
	Object.entries(GEOJSON_PATHS[type]).map(([year, path]) => ({
		type,
		year: Number(year),
		path: path as string,
	})),
);

const CODE_KEYS_BY_TYPE: Record<BoundaryType, readonly string[]> = {
	ward: PROPERTY_KEYS.wardCode,
	constituency: PROPERTY_KEYS.constituencyCode,
	localAuthority: PROPERTY_KEYS.ladCode,
	lsoa: PROPERTY_KEYS.lsoaCode,
	dataZone: PROPERTY_KEYS.dataZoneCode,
	superOutputArea: PROPERTY_KEYS.soaCode,
};

// Build the set of all area codes in a decoded file (from feature properties only).
const extractCodeSet = (
	type: BoundaryType,
	features: BoundaryGeojson["features"],
): Set<string> => {
	const keys = CODE_KEYS_BY_TYPE[type];
	const codeProp = keys.find(
		(key) => (features[0]?.properties as any)?.[key] !== undefined,
	);
	if (!codeProp) return new Set<string>();
	return new Set(
		features.flatMap((f) => {
			const v = (f.properties as any)[codeProp];
			return v ? [v] : [];
		}),
	);
};

// A lightweight, geometry-free copy of features. Cross-year mappings only read
// properties (codes + names), so we keep these instead of full geometry.
type PropsOnly = { features: { properties: any }[] };
const propsOnly = (features: BoundaryGeojson["features"]): PropsOnly => ({
	features: features.map((f) => ({ properties: f.properties })),
});

// Cross-year mappings are built for code-based boundary types only.
const CROSS_YEAR_TYPES: readonly BoundaryType[] = [
	"ward",
	"constituency",
	"localAuthority",
];

/**
 * Hook to load and filter boundary data.
 *
 * Memory model: the compact raw TopoJSON for every vintage is cached, but the
 * decoded (coordinate-expanded) GeoJSON is only ever held transiently — one file
 * at a time — long enough to extract code sets, cross-year mappings, and the
 * geometry filtered to the selected location. Only the filtered slice is retained.
 * Changing location re-decodes from the cached TopoJSON without re-fetching.
 */
export function useBoundaryData(
	selectedLocation?: string,
	codeMapper?: {
		getLadForWard: (wardCode: string) => string | undefined;
		addWardLadMappings: (mappings: Record<string, string>) => void;
		addLadWardMappings: (
			year: YearCode,
			mappings: Record<string, string[]>,
		) => void;
		addCodeMappings: (type: CodeType, mappings: CodeMapping) => void;
		addConstituencyWardMappings: (
			year: YearCode,
			mappings: Record<string, string[]>,
		) => void;
	},
) {
	const [boundaryData, setBoundaryData] = useState<BoundaryData>(
		emptyBoundaryData,
	);
	const [boundaryCodes, setBoundaryCodes] = useState<BoundaryCodes>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [initialized, setInitialized] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const addWardLadMappings = codeMapper?.addWardLadMappings;
	const addLadWardMappings = codeMapper?.addLadWardMappings;
	const addCodeMappings = codeMapper?.addCodeMappings;
	const getLadForWard = codeMapper?.getLadForWard;
	const addConstituencyWardMappings = codeMapper?.addConstituencyWardMappings;

	const loc = selectedLocation || null;

	// The location the currently-committed filteredData corresponds to. Lets the
	// location-change effect skip redundant re-filters (including the initial one
	// the load effect already performed).
	const lastFilteredLoc = useRef<string | null | undefined>(undefined);

	// Initial load: fetch every raw topology (in parallel), then decode them one at
	// a time to extract codes + mappings + the current location's filtered slice.
	useEffect(() => {
		let mounted = true;
		const filterLoc = loc; // location at mount; the effect below reconciles changes

		const load = async () => {
			setIsLoading(true);
			setError(null);

			// Kick off all fetches together (network parallelism); decode is serial.
			await Promise.all(
				BOUNDARY_ENTRIES.map((entry) =>
					fetchRawBoundary(entry.path).catch(() => null),
				),
			);
			if (!mounted) return;

			const filtered = emptyBoundaryData();
			const codes = emptyBoundaryCodes();
			const wardToLad: Record<string, string> = {};
			const ladToWardsByYear: Record<number, Record<string, string[]>> = {};
			const propsByType: Partial<
				Record<BoundaryType, Record<number, PropsOnly>>
			> = {};

			// Geometry retained only long enough to build constituency->ward mappings.
			const latestWardYear = Math.max(
				...Object.keys(GEOJSON_PATHS.ward).map(Number),
			);
			let latestWardGeojson: BoundaryGeojson | null = null;
			const constituencyGeojson: Record<number, BoundaryGeojson> = {};

			let firstError: Error | null = null;

			for (const entry of BOUNDARY_ENTRIES) {
				let raw: unknown;
				try {
					raw = await fetchRawBoundary(entry.path);
				} catch (err) {
					firstError =
						firstError ??
						(err instanceof Error
							? err
							: new Error(`Failed to load ${entry.type} ${entry.year}`));
					continue;
				}
				if (!mounted) return;

				const decoded = decodeBoundary(raw);
				const features = decoded.features ?? [];

				codes[entry.type][entry.year] = extractCodeSet(entry.type, features);

				if (CROSS_YEAR_TYPES.includes(entry.type) && features.length) {
					(propsByType[entry.type] ??= {})[entry.year] = propsOnly(features);
				}

				if (entry.type === "ward" && features.length) {
					const { wardToLad: w2l, ladToWards } = extractWardLadMappings(
						features,
						PROPERTY_KEYS.wardCode,
						PROPERTY_KEYS.ladCode,
					);
					Object.assign(wardToLad, w2l);
					if (Object.keys(ladToWards).length > 0) {
						ladToWardsByYear[entry.year] = ladToWards;
					}
					if (entry.year === latestWardYear) latestWardGeojson = decoded;
				}
				if (entry.type === "constituency") {
					constituencyGeojson[entry.year] = decoded;
				}

				filtered[entry.type][entry.year] = filterFeatures(
					decoded,
					filterLoc,
					entry.type,
					getLadForWard,
				);
				// `decoded` drops out of scope here unless retained above for mappings.
			}

			// Dispatch ward<->LAD mappings (single call to avoid extra state churn).
			if (addWardLadMappings && Object.keys(wardToLad).length > 0) {
				addWardLadMappings(wardToLad);
			}
			for (const [year, mappings] of Object.entries(ladToWardsByYear)) {
				addLadWardMappings?.(Number(year), mappings);
			}

			// Cross-year code mappings (name-based) per code boundary type.
			if (addCodeMappings) {
				for (const type of CROSS_YEAR_TYPES) {
					const group = propsByType[type];
					if (!group) continue;
					const years = Object.keys(group).map(Number);
					const crossYear = buildCrossYearMappings(
						group as unknown as Record<number, BoundaryGeojson>,
						type,
						years,
					);
					if (Object.keys(crossYear).length > 0) {
						addCodeMappings(type, crossYear);
					}
				}
			}

			// Constituency->ward mappings via centroid tests (needs real geometry).
			// Built against the latest ward year only; see original rationale.
			if (addConstituencyWardMappings && latestWardGeojson?.features) {
				const merged: Record<string, string[]> = {};
				for (const conData of Object.values(constituencyGeojson)) {
					if (conData?.features) {
						Object.assign(
							merged,
							buildConstituencyWardMappings(latestWardGeojson, conData),
						);
					}
				}
				if (Object.keys(merged).length > 0) {
					addConstituencyWardMappings(latestWardYear, merged);
				}
			}

			if (!mounted) return;
			lastFilteredLoc.current = filterLoc;
			startTransition(() => {
				setBoundaryData(filtered);
				setBoundaryCodes(codes);
			});
			if (firstError) setError(firstError);
			setIsLoading(false);
			setInitialized(true);
		};

		load().catch((err) => {
			if (mounted) {
				setError(
					err instanceof Error ? err : new Error("Failed to load boundaries"),
				);
				setIsLoading(false);
			}
		});

		return () => {
			mounted = false;
		};
	}, [
		addWardLadMappings,
		addLadWardMappings,
		addCodeMappings,
		addConstituencyWardMappings,
		getLadForWard,
	]);

	// Location changes: re-filter from the cached raw topologies without refetching
	// or rebuilding mappings. Skips the initial location (already filtered above).
	useEffect(() => {
		if (!initialized) return;
		if (lastFilteredLoc.current === loc) return;

		let cancelled = false;
		const refilter = async () => {
			const next = emptyBoundaryData();
			for (const entry of BOUNDARY_ENTRIES) {
				let raw: unknown;
				try {
					raw = await fetchRawBoundary(entry.path);
				} catch {
					continue;
				}
				if (cancelled) return;
				next[entry.type][entry.year] = filterFeatures(
					decodeBoundary(raw),
					loc,
					entry.type,
					getLadForWard,
				);
			}
			if (cancelled) return;
			lastFilteredLoc.current = loc;
			startTransition(() => setBoundaryData(next));
		};

		refilter();
		return () => {
			cancelled = true;
		};
	}, [loc, initialized, getLadForWard]);

	return {
		boundaryData,
		boundaryCodes,
		isLoading,
		error,
	};
}
