import { openapiDocumentHash, type OperationsArtifact } from "./operations";
import { publicPath, readPublicManifest } from "../storage/publicManifest";

/**
 * The operations compiled from `openapiDocument`. One compiled from an older
 * document is refused: it would answer a newly declared parameter with 400.
 */
export const readOperations = (
	apiRoot: string,
	openapiDocument: string,
): OperationsArtifact => {
	const artifact = readPublicManifest<OperationsArtifact>(
		apiRoot,
		"operations.json",
		"operations",
		"operations artifact",
	);
	if (
		artifact.inputs?.openapiDocument !==
		openapiDocumentHash(openapiDocument)
	) {
		throw new Error(
			`${publicPath(apiRoot, "operations.json")} was compiled from another openapi.yaml; run pnpm --dir ../.. data:build --only operations.`,
		);
	}
	return artifact;
};
