from enum import StrEnum


class BoundaryReleaseDownloadsType0Status(StrEnum):
    AVAILABLE = "available"

    def __str__(self) -> str:
        return str(self.value)
