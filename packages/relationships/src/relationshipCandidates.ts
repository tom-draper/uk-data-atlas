export type CandidateSide = {
	geography: string;
	boundaryRelease: string;
	codeProperty: string;
	nameProperty: string;
};

export type CandidateTarget =
	| CandidateSide
	| {
			geography?: string;
			codeProperty: string;
			nameProperty: string;
	  };

export type RelationshipCandidate = {
	id: string;
	input: string;
	from: CandidateSide;
	to: CandidateTarget;
	status: "eligible" | "needs-review" | "not-available";
	publishedCrosswalkId?: string;
	validation: {
		endpoints: {
			from: {
				status: "verified";
				availableAreaCount: number;
				referencedCodeCount: number;
			};
			to:
				| {
						status: "verified";
						availableAreaCount: number;
						referencedCodeCount: number;
				  }
				| { status: "not-available"; reason: string };
		};
		relationship: {
			sourceFeatureCount: number;
			sourceCodeCount: number;
			targetCodeCount: number;
			multiTargetSourceCount: number;
			missingValueFeatureCount: number;
		};
		reasons: string[];
	};
};

export type RelationshipCandidateInventory = {
	schemaVersion: 1;
	contentHash: string;
	candidates: RelationshipCandidate[];
};

export type PublishedRelationship = {
	id: string;
	from: { geography: string; boundaryRelease: string };
	to: { geography: string; boundaryRelease: string };
};
