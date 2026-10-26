from enum import StrEnum


class ValidationCheckId(StrEnum):
    AREA_COVERAGE = "area-coverage"
    AREA_IDENTITIES = "area-identities"
    ARTIFACT_INTEGRITY = "artifact-integrity"
    BEST_FIT_VERIFIED = "best-fit-verified"
    CANDIDATES_REVIEWED = "candidates-reviewed"
    COMPONENTS_SUM_TO_TOTAL = "components-sum-to-total"
    CONTAINMENT_VERIFIED = "containment-verified"
    CONTINUITY_EXTENT = "continuity-extent"
    COUNTRIES_DECLARED = "countries-declared"
    ENDPOINTS_VERIFIED = "endpoints-verified"
    GEOMETRY_POSITIONED = "geometry-positioned"
    GEOMETRY_SERVABLE = "geometry-servable"
    LICENCE_RECORDED = "licence-recorded"
    MEASURE_DEFINITION = "measure-definition"
    POPULATION_COVERAGE = "population-coverage"
    RECORDS_RESOLVE = "records-resolve"
    REGISTRY_LINKS = "registry-links"
    RELEASE_COVERAGE = "release-coverage"
    SINGLE_PARENT = "single-parent"
    SLIVER_SEPARATION = "sliver-separation"
    SOURCE_NAMES_CONSISTENT = "source-names-consistent"
    TARGETS_PRESENT = "targets-present"
    VALUES_VALID = "values-valid"
    WEIGHTS_SUM_TO_ONE = "weights-sum-to-one"

    def __str__(self) -> str:
        return str(self.value)
