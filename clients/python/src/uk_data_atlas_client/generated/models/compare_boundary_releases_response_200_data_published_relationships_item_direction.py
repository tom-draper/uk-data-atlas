from enum import StrEnum


class CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemDirection(
    StrEnum
):
    FORWARD = "forward"
    REVERSE = "reverse"

    def __str__(self) -> str:
        return str(self.value)
