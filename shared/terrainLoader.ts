import {
	createRemoteTerrainProvider,
	type AsyncTerrainProvider,
} from "./terrainProvider";

export type TerrainLoaderOptions = {
	terrainRemoteEndpoint?: string;
	terrainCoverageEndpoint?: string;
	terrainRemoteTimeoutMs?: number;
	terrainRemoteConcurrency?: number;
};

/** Create the optional remote preview without implying a persisted raster. */
export const createTerrainAsyncProvider = (
	options: TerrainLoaderOptions,
): AsyncTerrainProvider | undefined =>
	options.terrainRemoteEndpoint
		? createRemoteTerrainProvider({
				endpoint: options.terrainRemoteEndpoint,
				coverageEndpoint: options.terrainCoverageEndpoint,
				timeoutMs: options.terrainRemoteTimeoutMs,
				maxConcurrent: options.terrainRemoteConcurrency,
				source: {
					id: "ea-lidar-composite-dtm-2m",
					version: "remote-preview",
					provenance: "remote-preview",
					crs: "EPSG:27700",
					horizontalDatum: "OSGB36",
					horizontalTransformation: "OSTN15",
					verticalDatum: "ODN",
					verticalModel: "OSGM15",
					resolutionMetres: 2,
					noData: -3.4028235e38,
					uncertainty: { metric: "rmse", valueMetres: 0.15 },
					coverage: {
						kind: "bbox",
						bbox: [80000, 4000, 658081.8635, 666000],
						footprintHash: "remote-ea-2022-coverage",
					},
				},
			})
		: undefined;
