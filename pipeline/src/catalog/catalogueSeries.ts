import { sha256 } from "@uk-data-atlas/artifacts";
import type { DataCatalog } from "@uk-data-atlas/measures";

/**
 * Publish each measure's series identity and its weight's.
 *
 * A builder names the series its measure serves; one that serves a measure of
 * the same name with no dimensions leaves it out. The identity is written
 * after the other fields so the catalogue's layout does not depend on where a
 * builder put it.
 */
export const catalogueWithSeries = (catalog: DataCatalog): DataCatalog => {
	const identities = new Map(
		catalog.measures.map(({ id, series }) => [
			id,
			series ?? { measure: id },
		]),
	);
	const measures = catalog.measures.map(({ series: _, ...measure }) => {
		const weightId =
			measure.aggregation?.kind === "intensive"
				? measure.aggregation.weight.measureId
				: undefined;
		const weightSeries = weightId ? identities.get(weightId) : undefined;
		return {
			...measure,
			series: identities.get(measure.id)!,
			...(weightSeries ? { weightSeries } : {}),
		};
	});
	const content = {
		schemaVersion: catalog.schemaVersion,
		source: catalog.source,
		datasets: catalog.datasets,
		measures,
	};
	return { ...content, contentHash: sha256(JSON.stringify(content)) };
};
