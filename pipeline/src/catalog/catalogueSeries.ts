import { sha256 } from "@uk-data-atlas/artifacts";
import type {
	DataCatalog,
	MeasureSeriesIdentity,
} from "@uk-data-atlas/measures";

export const catalogueWithSeries = (
	catalog: DataCatalog,
	identities: Readonly<Record<string, MeasureSeriesIdentity>>,
): DataCatalog => {
	const measures = catalog.measures.map((measure) => {
		const series = identities[measure.id];
		if (!series)
			throw new Error(`Missing series identity for ${measure.id}.`);
		return { ...measure, series };
	});
	const content = {
		schemaVersion: catalog.schemaVersion,
		source: catalog.source,
		datasets: catalog.datasets,
		measures,
	};
	return { ...content, contentHash: sha256(JSON.stringify(content)) };
};
