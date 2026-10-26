from enum import StrEnum


class LookupPointPrecisionBasis(StrEnum):
    DECIMAL_PLACES = "decimal-places"
    DECIMAL_PLACES_AND_TRANSFORMATION = "decimal-places-and-transformation"
    GRID_REFERENCE_AND_TRANSFORMATION = "grid-reference-and-transformation"
    STATED_ACCURACY = "stated-accuracy"
    STATED_ACCURACY_AND_GRID_REFERENCE_AND_TRANSFORMATION = (
        "stated-accuracy-and-grid-reference-and-transformation"
    )
    STATED_ACCURACY_AND_TRANSFORMATION = "stated-accuracy-and-transformation"

    def __str__(self) -> str:
        return str(self.value)
