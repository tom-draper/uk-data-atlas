from enum import StrEnum


class BoundaryReleaseDownloadsType1Status(StrEnum):
    UNTILED = "untiled"

    def __str__(self) -> str:
        return str(self.value)
