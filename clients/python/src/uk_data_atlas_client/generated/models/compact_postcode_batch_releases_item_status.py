from enum import StrEnum


class CompactPostcodeBatchReleasesItemStatus(StrEnum):
    AMBIGUOUS_RELEASE = "ambiguous-release"
    GEOMETRY_UNAVAILABLE = "geometry-unavailable"
    NO_RELEASE_FOR_DATE = "no-release-for-date"

    def __str__(self) -> str:
        return str(self.value)
