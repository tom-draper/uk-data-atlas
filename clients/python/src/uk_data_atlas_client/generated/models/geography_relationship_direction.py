from enum import StrEnum


class GeographyRelationshipDirection(StrEnum):
    FROM = "from"
    TO = "to"

    def __str__(self) -> str:
        return str(self.value)
