import { FRONT_DOOR, type FrontDoorRoute } from "./content/frontDoor";
import {
	API_BASE_URL,
	allOperations,
	operationHref,
	type ApiContract,
	type DocsOperation,
} from "./openapi";
import { requestSamples, type CodeSample } from "./samples";

/** A front-door route joined to its operation in the spec. */
export interface FrontDoorExample {
	route: FrontDoorRoute;
	operation: DocsOperation;
	url: string;
	/** The page that documents the operation, relative to the site. */
	href: string;
	samples: CodeSample[];
	/** The request as one line of shell, for text that cannot wrap it. */
	curl: string;
}

export function frontDoorExamples(contract: ApiContract): FrontDoorExample[] {
	const operations = new Map(
		allOperations(contract).map((operation) => [operation.id, operation]),
	);
	return FRONT_DOOR.map((route) => {
		const operation = operations.get(route.operationId);
		if (!operation) {
			throw new Error(
				`The front door lists ${route.operationId}, which the spec does not define`,
			);
		}
		const url = `${API_BASE_URL}${route.request}`;
		const samples = requestSamples(url, "envelope", route.body);
		return {
			route,
			operation,
			url,
			href: operationHref(operation),
			samples,
			curl: samples[0].code.replace(/ \\\n\s*/g, " "),
		};
	});
}

export function frontDoorExample(
	contract: ApiContract,
	operationId: string,
): FrontDoorExample | undefined {
	return frontDoorExamples(contract).find(
		(example) => example.route.operationId === operationId,
	);
}
