from enum import StrEnum


class ProblemAbsence(StrEnum):
    ABSENT_FROM_RELEASE = "absent-from-release"
    BEFORE_FIRST_RELEASE = "before-first-release"
    COUNTRY_NOT_COVERED = "country-not-covered"
    CROSSWALK_GEOGRAPHY_MISMATCH = "crosswalk-geography-mismatch"
    NOT_YET_CURRENT = "not-yet-current"
    NO_DATED_RELEASE = "no-dated-release"
    RELEASE_NOT_COMPILED = "release-not-compiled"
    SOURCE_AREAS_NOT_MAPPED = "source-areas-not-mapped"
    SUPERSEDED = "superseded"
    UNKNOWN = "unknown"
    UNKNOWN_GEOGRAPHY = "unknown-geography"
    UNKNOWN_RELEASE = "unknown-release"
    UNWEIGHTED_SPLIT = "unweighted-split"

    def __str__(self) -> str:
        return str(self.value)
