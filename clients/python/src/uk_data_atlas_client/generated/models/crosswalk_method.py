from enum import StrEnum


class CrosswalkMethod(StrEnum):
    AREA_OVERLAP = "area-overlap"
    BEST_FIT = "best-fit"
    CLEAN_CONTAINMENT = "clean-containment"
    EXTENT_CONTINUITY = "extent-continuity"
    GEOMETRIC_CONTAINMENT = "geometric-containment"
    OFFICIAL_LOOKUP = "official-lookup"
    POPULATION_OVERLAP = "population-overlap"

    def __str__(self) -> str:
        return str(self.value)
