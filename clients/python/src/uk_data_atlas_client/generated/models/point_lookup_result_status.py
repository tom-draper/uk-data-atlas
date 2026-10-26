from enum import StrEnum


class PointLookupResultStatus(StrEnum):
    AMBIGUOUS_RELEASE = "ambiguous-release"
    GEOMETRY_UNAVAILABLE = "geometry-unavailable"
    MATCHED = "matched"
    NO_MATCH = "no-match"
    NO_RELEASE_FOR_DATE = "no-release-for-date"
    OUTSIDE_COVERAGE = "outside-coverage"

    def __str__(self) -> str:
        return str(self.value)
