from enum import StrEnum


class AnalysisGeographyListEnvelopeDataAnalysisGeographiesItemConversionType1StepsItemDirection(
    StrEnum
):
    FORWARD = "forward"
    REVERSE = "reverse"

    def __str__(self) -> str:
        return str(self.value)
