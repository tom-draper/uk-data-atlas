/**
 * The table of datasets each `data/source` folder feeds lives in
 * `packages/datasets`, where the dist generator reads it too (docs/data-organisation.md,
 * task 12). The tests import it from here.
 */
export {
	DATASET_SOURCES,
	SUPPORT_SOURCES,
	type DatasetSource,
} from "@uk-data-atlas/datasets/registry";
