from enum import StrEnum


class PointLookupReleaseSelectionPolicy(StrEnum):
    LATEST_RELEASE_DATED_ON_OR_BEFORE = "latest-release-dated-on-or-before"
    PINNED = "pinned"

    def __str__(self) -> str:
        return str(self.value)
