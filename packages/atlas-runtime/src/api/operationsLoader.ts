import { openapiDocumentHash, type OperationsArtifact } from "./operations.ts";
import { publicPath, readPublicManifest } from "../storage/publicManifest.ts";

/**
 * The operations compiled from `openapiDocument`. One compiled from an older
 * document is refused: it would answer a newly declared parameter with 400.
 */
export const readOperations = (
	repositoryRoot: string,
	openapiDocument: string,
): OperationsArtifact => {
	const artifact = readPublicManifest<OperationsArtifact>(
		repositoryRoot,
		"operations.json",
		"operations",
		"operations artifact",
	);
	if (
		artifact.inputs?.openapiDocument !==
		openapiDocumentHash(openapiDocument)
	) {
		throw new Error(
			`${publicPath(repositoryRoot, "operations.json")} was compiled from another openapi.yaml; run pnpm --dir ../.. data:build --only operations.`,
		);
	}
	return artifact;
};
