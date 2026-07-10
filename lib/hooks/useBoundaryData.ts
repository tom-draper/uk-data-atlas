// hooks/useBoundaryData.ts
import { startTransition, useEffect, useRef, useState } from "react";
import { BoundaryData, BoundaryCodes, BoundaryGeojson } from "@lib/types";
import {
	BoundaryType,
	clearBoundaryCache,
	decodeBoundary,
	featureBbox,
	fetchRawBoundary,
	fetchRawBoundaryText,
	filterFeatures,
	filterIndexToLocation,
	GEOJSON_PATHS,
	IndexFeature,
	peekBoundaryText,
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

// Boundary types that back Scotland-/NI-only deprivation views (SIMD → dataZone,
// NIMDM → superOutputArea). Both chart sections are hidden by default, so we defer
// fetching and decoding their (large) topologies until the section is shown or the
// view becomes the active map dataset. Every other type loads eagerly because the
// chart panel aggregates it for the current location on first render.
const GATED_TYPES: ReadonlySet<BoundaryType> = new Set([
	"dataZone",
	"superOutputArea",
]);

const isTypeEnabled = (
	type: BoundaryType,
	enabled: Partial<Record<BoundaryType, boolean>> | undefined,
): boolean => !GATED_TYPES.has(type) || enabled?.[type] === true;

// Stable primitive key describing which gated types are currently enabled, so the
// reconcile effect can react to a section being toggled on/off without depending on
// a freshly-allocated object each render.
const gatedEnabledKey = (
	enabled: Partial<Record<BoundaryType, boolean>> | undefined,
): string =>
	[...GATED_TYPES]
		.filter((type) => enabled?.[type])
		.sort()
		.join("|");

// The geometry-free per-feature index the chart panel runs on: {type: {year: [...]}}.
type BoundaryIndex = Partial<Record<BoundaryType, Record<number, IndexFeature[]>>>;

const buildIndexFeatures = (
	features: BoundaryGeojson["features"],
): IndexFeature[] =>
	features.map((f) => ({
		properties: f.properties as unknown as Record<string, unknown>,
		bbox: featureBbox(f) ?? [Infinity, Infinity, -Infinity, -Infinity],
	}));

type DecodedActive = { path: string; geojson: BoundaryGeojson } | null;

/**
 * Assemble boundaryData for a location without decoding anything: the map's active
 * layer comes from the one cached decoded file (real geometry), every other entry
 * comes from the geometry-free index (properties + bbox). Both are cheap array
 * filters, so a location change does no geometry expansion at all.
 */
const assembleBoundaryData = (
	index: BoundaryIndex,
	decodedActive: DecodedActive,
	atLoc: string | null,
	activeBoundary: { type: BoundaryType; year: number } | undefined,
	enabledBoundaryTypes: Partial<Record<BoundaryType, boolean>> | undefined,
	getLadForWard: ((wardCode: string) => string | undefined) | undefined,
): BoundaryData => {
	const next = emptyBoundaryData();
	for (const entry of BOUNDARY_ENTRIES) {
		if (!isTypeEnabled(entry.type, enabledBoundaryTypes)) continue;
		const isActive =
			!!activeBoundary &&
			entry.type === activeBoundary.type &&
			entry.year === activeBoundary.year;
		if (isActive && decodedActive && decodedActive.path === entry.path) {
			next[entry.type][entry.year] = filterFeatures(
				decodedActive.geojson,
				atLoc,
				entry.type,
				getLadForWard,
			);
		} else {
			const idx = index[entry.type]?.[entry.year];
			if (idx) {
				next[entry.type][entry.year] = filterIndexToLocation(
					idx,
					atLoc,
					entry.type,
					getLadForWard,
				);
			}
		}
	}
	return next;
};

/**
 * Hook to load and filter boundary data.
 *
 * Memory / work model: each vintage is decoded exactly once, at load, into a
 * geometry-free {properties, bbox} index (~15 MB for everything). The chart panel
 * reads only properties, so it runs off that index — a location change re-filters
 * the index with no decode. The map needs real geometry, but only for its single
 * active layer, so we retain just that one file's compact raw text (~7 MB) and
 * parse + decode it on demand (one map decode per location change); switching the
 * active view fetches the one new file's text. All other raw text is dropped once
 * the index is built. Gated types (see GATED_TYPES) are indexed lazily when their
 * section or view is enabled.
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
	// Which gated boundary types are currently needed (section visible or active
	// viz). Types not listed in GATED_TYPES always load regardless of this value.
	enabledBoundaryTypes?: Partial<Record<BoundaryType, boolean>>,
	// The boundary the map is currently drawing. Its parsed topology is retained and
	// decoded on demand per location change; changing it parses the one new file.
	activeBoundary?: { type: BoundaryType; year: number },
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
	const gatedKey = gatedEnabledKey(enabledBoundaryTypes);
	const activeKey = activeBoundary
		? `${activeBoundary.type}:${activeBoundary.year}`
		: "";

	// Geometry-free index (all vintages) + the single active layer's raw text
	// (parsed + decoded transiently per location change). Refs, so they persist across
	// renders and aren't part of React state churn.
	const indexRef = useRef<BoundaryIndex>({});
	const activeTextRef = useRef<{ path: string; text: string } | null>(null);

	// What the currently-committed boundaryData reflects, so the reconcile effect can
	// skip redundant work.
	const lastFilteredLoc = useRef<string | null | undefined>(undefined);
	const lastGatedKey = useRef<string>("");
	const lastActiveKey = useRef<string>("");

	// Initial load: fetch every enabled topology, decode each once to build the index
	// + code sets + cross-year mappings, retain the active layer's geometry, then drop
	// the raw text.
	useEffect(() => {
		let mounted = true;
		const filterLoc = loc; // location at mount; the reconcile effect handles changes
		const activeEntries = BOUNDARY_ENTRIES.filter((entry) =>
			isTypeEnabled(entry.type, enabledBoundaryTypes),
		);
		const loadGatedKey = gatedEnabledKey(enabledBoundaryTypes);
		const loadActiveKey = activeBoundary
			? `${activeBoundary.type}:${activeBoundary.year}`
			: "";

		const load = async () => {
			setIsLoading(true);
			setError(null);

			// Kick off all fetches together (network parallelism); parse + decode is
			// serial below. Warm the cache with text only — parsing here then again in
			// the loop would parse every vintage twice.
			await Promise.all(
				activeEntries.map((entry) =>
					fetchRawBoundaryText(entry.path).catch(() => null),
				),
			);
			if (!mounted) return;

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

			// The active layer decoded once here for the initial assemble; only its raw
			// text is retained (in activeTextRef) for later re-slices.
			let activeDecodedForInit: DecodedActive = null;

			let firstError: Error | null = null;

			for (const entry of activeEntries) {
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

				// Geometry-free index for the chart panel.
				(indexRef.current[entry.type] ??= {})[entry.year] =
					buildIndexFeatures(features);

				// Retain the map's active layer as compact raw text; keep this decode
				// for the initial assemble only.
				if (
					activeBoundary &&
					entry.type === activeBoundary.type &&
					entry.year === activeBoundary.year
				) {
					const text = peekBoundaryText(entry.path);
					if (text !== undefined) {
						activeTextRef.current = { path: entry.path, text };
					}
					activeDecodedForInit = { path: entry.path, geojson: decoded };
				}
				// `decoded` otherwise drops out of scope (unless held above for mappings).
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

			// The index is built and the active layer's parsed topology retained; the
			// raw text is no longer needed. Location changes decode only the active
			// layer; a view change re-parses just the new active file.
			clearBoundaryCache();

			lastFilteredLoc.current = filterLoc;
			lastGatedKey.current = loadGatedKey;
			lastActiveKey.current = loadActiveKey;
			const assembled = assembleBoundaryData(
				indexRef.current,
				activeDecodedForInit,
				filterLoc,
				activeBoundary,
				enabledBoundaryTypes,
				getLadForWard,
			);
			startTransition(() => {
				setBoundaryData(assembled);
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
		// enabledBoundaryTypes / activeBoundary are read at mount; later changes are
		// handled by the reconcile effect below.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		addWardLadMappings,
		addLadWardMappings,
		addCodeMappings,
		addConstituencyWardMappings,
		getLadForWard,
	]);

	// Reconcile on location change, gated-section toggle, or active-view change.
	// A pure location change decodes nothing (index + active geometry are resident);
	// enabling a gated type indexes that one file; changing the active view decodes
	// that one file. Then boundaryData is re-assembled cheaply.
	useEffect(() => {
		if (!initialized) return;
		if (
			lastFilteredLoc.current === loc &&
			lastGatedKey.current === gatedKey &&
			lastActiveKey.current === activeKey
		) {
			return;
		}

		let cancelled = false;
		const activeEntry = activeBoundary
			? BOUNDARY_ENTRIES.find(
					(e) =>
						e.type === activeBoundary.type && e.year === activeBoundary.year,
				)
			: undefined;

		const reconcile = async () => {
			let fetched = false;

			// 1. Index any newly-enabled gated types that aren't indexed yet.
			for (const entry of BOUNDARY_ENTRIES) {
				if (!isTypeEnabled(entry.type, enabledBoundaryTypes)) continue;
				if (indexRef.current[entry.type]?.[entry.year]) continue;
				let raw: unknown;
				try {
					raw = await fetchRawBoundary(entry.path);
				} catch {
					continue;
				}
				if (cancelled) return;
				fetched = true;
				(indexRef.current[entry.type] ??= {})[entry.year] = buildIndexFeatures(
					decodeBoundary(raw).features ?? [],
				);
				if (activeEntry && entry.path === activeEntry.path) {
					const text = peekBoundaryText(entry.path);
					if (text !== undefined) {
						activeTextRef.current = { path: entry.path, text };
					}
				}
			}

			// 2. Fetch the active layer's text if the view switched to a new file.
			if (activeEntry && activeTextRef.current?.path !== activeEntry.path) {
				let text: string | null = null;
				try {
					text = await fetchRawBoundaryText(activeEntry.path);
				} catch {
					text = null;
				}
				if (cancelled) return;
				if (text !== null) {
					activeTextRef.current = { path: activeEntry.path, text };
					fetched = true;
				}
			}

			// Fetching re-populated the raw text cache; drop it — we keep only the
			// active layer's text (held in activeTextRef) plus the index.
			if (fetched) clearBoundaryCache();
			if (cancelled) return;

			// Parse + expand the active layer's geometry for this assemble only — the
			// single map decode per location/view change; everything else is index
			// filtering.
			const decodedActive =
				activeEntry && activeTextRef.current?.path === activeEntry.path
					? {
							path: activeTextRef.current.path,
							geojson: decodeBoundary(JSON.parse(activeTextRef.current.text)),
						}
					: null;

			lastFilteredLoc.current = loc;
			lastGatedKey.current = gatedKey;
			lastActiveKey.current = activeKey;
			const assembled = assembleBoundaryData(
				indexRef.current,
				decodedActive,
				loc,
				activeBoundary,
				enabledBoundaryTypes,
				getLadForWard,
			);
			startTransition(() => setBoundaryData(assembled));
		};

		reconcile().catch((err) => {
			if (!cancelled) {
				setError(
					err instanceof Error ? err : new Error("Failed to update boundaries"),
				);
			}
		});
		return () => {
			cancelled = true;
		};
		// enabledBoundaryTypes / activeBoundary are captured via the stable gatedKey /
		// activeKey primitives.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loc, gatedKey, activeKey, initialized, getLadForWard]);

	return {
		boundaryData,
		boundaryCodes,
		isLoading,
		error,
	};
}
