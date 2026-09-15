export interface RoadCollisionsLADData {
	ladCode: string;
	/** Every reported collision the publisher assigns to the authority. */
	collisions: number;
	/** Collisions by the most severe injury the police recorded. */
	fatal: number;
	serious: number;
	slight: number;
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
}
