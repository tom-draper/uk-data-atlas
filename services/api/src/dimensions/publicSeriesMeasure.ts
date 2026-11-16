import {
	dimensionCatalogue,
	type DataCatalog,
	type Measure,
	type MeasureDimensions,
	type Series,
} from "@uk-data-atlas/measures";

/** A selected series' measure as it is named in API responses. */
export const publicSeriesMeasure = (
	measure: Measure,
	series: Series | undefined,
	publicId: string,
	catalog: DataCatalog,
	dimensions?: MeasureDimensions,
) => {
	if (
		!series ||
		(measure.id === publicId &&
			Object.keys(series.dimensions).length === 0 &&
			!series.datasetId)
	)
		return measure;
	const query = new URLSearchParams(series.dimensions);
	if (series.datasetId) query.set("datasetId", series.datasetId);
	return {
		...measure,
		id: publicId,
		label: dimensions
			? (dimensionCatalogue(catalog, dimensions).measure(publicId)
					?.label ?? measure.label)
			: measure.label,
		seriesLabel: measure.label,
		links: {
			...measure.links,
			data: `/v1/data/${publicId}${query.size ? `?${query}` : ""}`,
		},
	};
};
