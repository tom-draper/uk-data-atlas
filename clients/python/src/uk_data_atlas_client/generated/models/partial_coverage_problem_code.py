from enum import StrEnum


class PartialCoverageProblemCode(StrEnum):
    PARTIAL_COVERAGE = "partial_coverage"

    def __str__(self) -> str:
        return str(self.value)
