from enum import StrEnum


class AreaWithRelationshipsChildSelectionType1Kind(StrEnum):
    RELEASE = "release"

    def __str__(self) -> str:
        return str(self.value)
