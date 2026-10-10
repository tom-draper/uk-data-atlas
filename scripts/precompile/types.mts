import type {
	CATALOGUE_DATASET_DEFINITIONS,
	SourceArtifact,
} from "../../lib/data/catalog";
import type { DatasetPayloadLayout } from "../../lib/data/catalog/types";

export type CatalogueDefinition =
	(typeof CATALOGUE_DATASET_DEFINITIONS)[number];

/**
 * How to get the compiled payloads that region chunk generation reads, by
 * output file. A payload from this run is already in memory. One reused from an
 * earlier run stays on disk until chunks are actually cut from it, which they
 * are not when the chunks themselves can be reused.
 */
export type CompiledDatasets = Map<
	string,
	{ load: () => Promise<unknown>; layout?: DatasetPayloadLayout }
>;

export type CompiledOutput = {
	bytes: number;
	sha256: string;
	modifiedAt?: number;
};

export type SourceFileStamp = { bytes: number; modifiedAt: number };

export type SourceRelease = {
	validatedAt: number;
	files: Set<string>;
};

export type FileSnapshot = SourceFileStamp & {
	path: string;
	sha256?: string;
};

export type ExistingManifestDataset = {
	type: string;
	output: string;
	source: unknown;
	contract: unknown;
	inputs: SourceArtifact[];
	summary: unknown;
	compiled: CompiledOutput;
	/** What the dataset was compiled by; see scripts/precompile-fingerprint.mjs. */
	fingerprint?: string;
};

export type AtlasAssetsCache = {
	inputs: FileSnapshot[];
	outputs: {
		gazetteerCore: CompiledOutput;
		matchIndex: CompiledOutput;
	};
};

export type RoadSafetyCache = {
	input: SourceFileStamp;
	gazetteerCore: CompiledOutput;
	outputs: {
		dataset: CompiledOutput;
		points: CompiledOutput;
	};
};

export type RegionChunksCache = {
	datasets: Record<string, CompiledOutput>;
	/** The fingerprint of each regional dataset, which holds its chunk layout. */
	datasetFingerprints?: Record<string, string>;
	gazetteerCore: CompiledOutput;
	outputs: FileSnapshot[];
};

export type ExistingManifest = {
	precompiler?: { fingerprint?: string };
	datasets?: ExistingManifestDataset[];
	artifacts?: {
		atlasAssets?: AtlasAssetsCache;
		roadSafety?: RoadSafetyCache;
		regionChunks?: RegionChunksCache;
	};
};

/** What an earlier run left behind, and whether this run may trust it. */
export type ReuseContext = {
	/** Whether the pipeline that built the other artifacts is unchanged. */
	canReuse: boolean;
	/** What each dataset would be compiled by now, by type. */
	datasetFingerprints: Readonly<Record<string, string>>;
	existingManifest: ExistingManifest;
	existingDatasets: Map<string, ExistingManifestDataset>;
	sourceRelease: SourceRelease | undefined;
};
