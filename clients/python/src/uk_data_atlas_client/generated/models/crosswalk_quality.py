from enum import StrEnum


class CrosswalkQuality(StrEnum):
    DERIVED = "derived"
    PUBLISHER_SUPPLIED = "publisher-supplied"

    def __str__(self) -> str:
        return str(self.value)
