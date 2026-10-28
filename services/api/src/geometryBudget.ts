import type { GeoJsonGeometry } from "@uk-data-atlas/atlas-runtime/geometry";
import { countVertices } from "@uk-data-atlas/map-tiles/simplifyGeometry";
import { problem } from "@uk-data-atlas/atlas-runtime/api";

export const MAX_GEOMETRY_FEATURES = 1000;
export const MAX_GEOMETRY_SOURCE_VERTICES = 250_000;

export class GeometryBudget {
	private vertices = 0;
	add(geometry: GeoJsonGeometry): boolean {
		this.vertices += countVertices(geometry);
		return this.vertices <= MAX_GEOMETRY_SOURCE_VERTICES;
	}
}

export const geometryBudgetProblem = (geography: string, release: string) =>
	problem(
		422,
		"Geometry Budget Exceeded",
		"A geometry collection may contain at most 1,000 features and process at most 250,000 source vertices before simplification. Request fewer areas or a smaller page, omit geometry from a box query, or use the release downloads for larger collections.",
		{
			links: {
				downloads: `/v1/boundary-releases/${encodeURIComponent(geography)}/${encodeURIComponent(release)}`,
			},
		},
	);
