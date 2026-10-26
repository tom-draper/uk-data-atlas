from enum import StrEnum


class CrosswalkWeightingType0Status(StrEnum):
    NOT_APPLICABLE = "not-applicable"
    NOT_PROVIDED = "not-provided"

    def __str__(self) -> str:
        return str(self.value)
