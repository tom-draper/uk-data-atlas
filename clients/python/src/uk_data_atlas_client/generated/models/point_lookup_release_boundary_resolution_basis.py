from enum import StrEnum


class PointLookupReleaseBoundaryResolutionBasis(StrEnum):
    ONS_RELEASE_NAME = "ons-release-name"

    def __str__(self) -> str:
        return str(self.value)
