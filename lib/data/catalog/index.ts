export type {
	DatasetDefinition,
	DatasetIngestionContract,
	DatasetLocationScope,
	DatasetPayloadLayout,
	DatasetReader,
	RegionalChunkLayout,
	DatasetSource,
} from "@uk-data-atlas/datasets/data/catalog/types";
export {
	codeKeyedFieldsFor,
	DEFAULT_CODE_KEYED_FIELDS,
} from "@uk-data-atlas/datasets/data/catalog/types";
export {
	validatePrecompiledDataset,
	type DatasetPrecompileSummary,
	type SourceArtifact,
} from "@uk-data-atlas/datasets/data/catalog/ingestion";
export { CATALOGUE_DATASET_DEFINITIONS } from "@uk-data-atlas/datasets/data/catalog/registry";
export {
	DATASET_SOURCES,
	boundaryCoverageMarkdown,
	datasetSourcesMarkdown,
} from "./sources";
export type {
	CatalogueDataset,
	CatalogueDatasetRecords,
	CatalogueDatasetType,
} from "@uk-data-atlas/datasets/data/catalog/generated";
