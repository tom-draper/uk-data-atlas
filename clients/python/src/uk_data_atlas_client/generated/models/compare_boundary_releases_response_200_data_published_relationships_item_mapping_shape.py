from enum import StrEnum


class CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMappingShape(
    StrEnum
):
    MANY_TO_MANY = "many-to-many"
    MANY_TO_ONE = "many-to-one"
    NO_MAPPINGS = "no-mappings"
    ONE_TO_MANY = "one-to-many"
    ONE_TO_ONE = "one-to-one"

    def __str__(self) -> str:
        return str(self.value)
