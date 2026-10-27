export type CrosswalkEndpointValidation =
	| {
			status: "verified";
			availableAreaCount: number;
			referencedCodeCount: number;
	  }
	| { status: "not-available"; reason: string };
