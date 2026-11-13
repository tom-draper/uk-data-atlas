/**
 * The registry of themes, topics and datasets on its own, without the dataset
 * loaders the package index also exports. Consumers that only need the
 * taxonomy (the API) import `@uk-data-atlas/datasets/registry`.
 */
export * from "./guides.ts";
export * from "./taxonomy.ts";
export * from "./tree.ts";
export * from "./sourceDatasets.ts";
export * from "./modules.ts";
