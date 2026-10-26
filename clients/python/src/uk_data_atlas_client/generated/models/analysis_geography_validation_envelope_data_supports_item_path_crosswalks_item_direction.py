from enum import StrEnum


class AnalysisGeographyValidationEnvelopeDataSupportsItemPathCrosswalksItemDirection(
    StrEnum
):
    FORWARD = "forward"
    REVERSE = "reverse"

    def __str__(self) -> str:
        return str(self.value)
