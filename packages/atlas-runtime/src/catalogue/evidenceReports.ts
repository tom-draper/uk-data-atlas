import { handleSyncRoutes } from "../api/syncRoutes";
import { handleMeasureReconciliationRoutes } from "../api/measureReconciliationRoutes";
import { handleCoveragePlanRoutes } from "../api/coveragePlanRoutes";
import { handleGeographyHealthRoutes } from "../api/geographyHealthRoutes";
import { handleGovernanceRoutes } from "../api/governanceRoutes";
import { handleAnalysisGeographyRoutes } from "../api/analysisGeographyRoutes";
import type { RouteRequest } from "../areas/routing";

/** Build-time report adapters. These are not registered HTTP operations. */
export const evidenceReport = (request: RouteRequest) => {
	const path = request.segments;
	if (path[1] === "measures") {
		if (path[3] === "reconciliation")
			return handleMeasureReconciliationRoutes(request);
		if (path[3] === "coverage-plan")
			return handleCoveragePlanRoutes(request);
		if (path[3] === "conversion-support")
			return handleAnalysisGeographyRoutes(request);
	}
	if (path[1] === "validation") return handleSyncRoutes(request);
	if (path[1] === "geography-health")
		return handleGeographyHealthRoutes(request);
	if (["corrections", "relationship-candidates"].includes(path[1] ?? ""))
		return handleGovernanceRoutes(request);
	return undefined;
};

export type { EvidenceDocument, EvidenceManifest } from "./evidenceDocuments";
