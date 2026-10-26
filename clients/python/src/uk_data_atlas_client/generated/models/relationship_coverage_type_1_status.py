from enum import StrEnum


class RelationshipCoverageType1Status(StrEnum):
    UNSUPPORTED = "unsupported"

    def __str__(self) -> str:
        return str(self.value)
