from enum import StrEnum


class QueryRelationshipsPurpose(StrEnum):
    APPORTION = "apportion"
    IDENTITY = "identity"
    MEMBERSHIP = "membership"

    def __str__(self) -> str:
        return str(self.value)
