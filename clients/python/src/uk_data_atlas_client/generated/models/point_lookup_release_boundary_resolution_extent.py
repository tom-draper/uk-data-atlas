from enum import StrEnum


class PointLookupReleaseBoundaryResolutionExtent(StrEnum):
    CLIPPED_TO_COASTLINE = "clipped-to-coastline"
    FULL_EXTENT_OF_REALM = "full-extent-of-realm"

    def __str__(self) -> str:
        return str(self.value)
