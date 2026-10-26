from enum import StrEnum


class SuppliedCountConversionEnvelopeDataMethod(StrEnum):
    AREA_WEIGHTED = "area-weighted"
    EXACT = "exact"
    POPULATION_WEIGHTED = "population-weighted"

    def __str__(self) -> str:
        return str(self.value)
