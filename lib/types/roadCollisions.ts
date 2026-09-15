export interface RoadCollisionCounts {
	/** Every reported collision the publisher assigns to the authority. */
	collisions: number;
	/** Collisions by the most severe injury the police recorded. */
	fatal: number;
	serious: number;
	slight: number;
}

export interface RoadCollisionsLADData extends RoadCollisionCounts {
	ladCode: string;
}

export interface RoadCollisionsLSOAData extends RoadCollisionCounts {
	lsoaCode: string;
}

export interface RoadCollisionsDataset {
	id: string;
	type: "roadCollisions";
	year: number;
	/** The months the provisional file covers, such as "January to June 2025". */
	period: string;
	boundaryType: "localAuthority";
	boundaryYear: number;
	data: Record<string, RoadCollisionsLADData>;
	/** Collisions whose authority field holds no local authority code. */
	excluded: Array<{ code: string; collisions: number }>;
	/**
	 * The same counts by the 2021 LSOA each collision is assigned to. Scotland
	 * has no LSOAs, so its collisions are not in this table.
	 */
	lsoaBoundaryYear: number;
	lsoas: Record<string, RoadCollisionsLSOAData>;
	/** Collisions with no LSOA code, by the nation of their authority code. */
	withoutLsoa: Record<string, number>;
}
