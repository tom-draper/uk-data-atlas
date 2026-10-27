import { handleSyncRoutes } from "./syncRoutes";
import { handleMeasureQualityRoutes } from "./measureQualityRoutes";
import { handleMeasureCoverageRoutes } from "./measureCoverageRoutes";
import { handleMeasureCompatibilityRoutes } from "./measureCompatibilityRoutes";
import { handleMeasureReconciliationRoutes } from "./measureReconciliationRoutes";
import { handleCoveragePlanRoutes } from "./coveragePlanRoutes";
import { handleGeographyHealthRoutes } from "./geographyHealthRoutes";
import { handleRelationshipRepairRoutes } from "./relationshipRepairRoutes";
import { handleGovernanceRoutes } from "./governanceRoutes";
import { handleAnalysisGeographyRoutes } from "./analysisGeographyRoutes";
import type { RouteRequest } from "./routing";

/** Build-time report adapters. These are not registered HTTP operations. */
export const evidenceReport = (request: RouteRequest) => {
	const path = request.segments;
	if (path[1] === "measures") {
		if (path[3] === "quality") return handleMeasureQualityRoutes(request);
		if (path[3] === "coverage") return handleMeasureCoverageRoutes(request);
		if (path[3] === "compatibility")
			return handleMeasureCompatibilityRoutes(request);
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
	if (path[1] === "relationship-repairs")
		return handleRelationshipRepairRoutes(request);
	if (["corrections", "relationship-candidates"].includes(path[1] ?? ""))
		return handleGovernanceRoutes(request);
	return undefined;
};

export type { EvidenceDocument, EvidenceManifest } from "./evidenceDocuments";
