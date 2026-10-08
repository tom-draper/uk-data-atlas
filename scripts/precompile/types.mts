import type {
	CATALOGUE_DATASET_DEFINITIONS,
	SourceArtifact,
} from "../../lib/data/catalog";
import type { DatasetPayloadLayout } from "../../lib/data/catalog/types";

export type CatalogueDefinition =
	(typeof CATALOGUE_DATASET_DEFINITIONS)[number];

/** Compiled payloads kept for region chunk generation, by output file. */
export type CompiledDatasets = Map<
	string,
	{ data: unknown; layout?: DatasetPayloadLayout }
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
	canReuse: boolean;
	existingManifest: ExistingManifest;
	existingDatasets: Map<string, ExistingManifestDataset>;
	sourceRelease: SourceRelease | undefined;
};
