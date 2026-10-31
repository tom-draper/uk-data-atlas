from enum import StrEnum


class CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemRelationshipPurpose(
    StrEnum
):
    IDENTITY = "identity"
    MEMBERSHIP = "membership"

    def __str__(self) -> str:
        return str(self.value)
