export type TerrainProduct = {
	id: string;
	label: string;
	kind: "raster" | "vector";
	measurement: string;
	unit: string;
	availability: {
		status: "not-published";
		reason: string;
	};
	/** The intended service scope, never a claim that the data exists today. */
	intendedCoverage: {
		countries: Array<"GB-ENG" | "GB-NIR" | "GB-SCT" | "GB-WLS">;
	};
	dependsOn?: string[];
	notes?: string[];
};

export type TerrainCatalogue = {
	schemaVersion: 1;
	contentHash: string;
	publicationRequirements: readonly string[];
	products: TerrainProduct[];
};
