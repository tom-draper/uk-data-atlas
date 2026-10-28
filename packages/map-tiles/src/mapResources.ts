import type { GeometryTier } from "./simplifyGeometry";
import type { TileBox } from "./tileGrid";
import type { TOPOLOGY_METHOD } from "./topologyTiers";

export type MapResourceDescriptor = {
	id: string;
	geography: string;
	boundaryRelease: string;
	title: string;
	/** Borders are compiled once and shared, not redrawn for each area. */
	topology: "shared-arc";
	areaCount: number;
	arcCount: number;
	bounds: TileBox;
	tiles: {
		artifact: string;
		href: string;
		format: "pmtiles-3";
		tileFormat: "mvt-2.1";
		layer: string;
		minZoom: number;
		maxZoom: number;
		zooms: Array<{
			minZoom: number;
			maxZoom: number;
			tier: GeometryTier;
			toleranceM: number;
		}>;
		tileCount: number;
		bytes: number;
		contentHash: string;
	};
	tiers: Array<{
		tier: GeometryTier;
		toleranceM: number;
		coordinates: number;
		refinedArcs: number;
	}>;
	/**
	 * The flat form: every area of one tier as a whole-release download, with
	 * the ids the tiles and join tables use. Every tier is published as
	 * GeoParquet, `full` included, because a warehouse chooses its own detail;
	 * the coarser tiers a browser can hold are published as GeoJSON too.
	 */
	features: Array<{
		tier: GeometryTier;
		toleranceM: number;
		format: "geoparquet-1.1" | "geojson";
		/**
		 * The stored file. Absent for the `full` tier, which is built from the
		 * geometry store when it is asked for (see `fullDetail.ts`).
		 */
		artifact?: string;
		href: string;
		rowCount: number;
		coordinates: number;
		/** The size and hash of the download itself, once any encoding is undone. */
		bytes: number;
		contentHash: string;
		/** Present when the file is stored gzipped: its size as stored. */
		gzipBytes?: number;
	}>;
	generalisation: typeof TOPOLOGY_METHOD;
	geometrySource: Record<string, unknown>;
	attribution: {
		text: string;
		publisher: string;
		sourceUrl: string;
		licence: { name: string; url?: string };
		href: string;
	};
};

export type MapResources = {
	assetBaseUrl?: string;
	tileBaseUrl?: string;
	resources: MapResourceDescriptor[];
	/**
	 * Releases the build could not tile, such as one that is not a coverage.
	 * One whose areas could still be read is downloadable whole at full
	 * detail, listed in `features`.
	 */
	unavailable?: Array<{
		geography: string;
		boundaryRelease: string;
		reason: string;
		features?: MapResourceDescriptor["features"];
	}>;
};
