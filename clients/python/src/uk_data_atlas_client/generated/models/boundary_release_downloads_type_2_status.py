from enum import StrEnum


class BoundaryReleaseDownloadsType2Status(StrEnum):
    UNAVAILABLE = "unavailable"

    def __str__(self) -> str:
        return str(self.value)
