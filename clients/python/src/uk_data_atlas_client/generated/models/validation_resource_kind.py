from enum import StrEnum


class ValidationResourceKind(StrEnum):
    ATLAS = "atlas"
    BOUNDARY_RELEASE = "boundary-release"
    CROSSWALK = "crosswalk"
    MEASURE = "measure"
    MEASURE_SOURCE = "measure-source"

    def __str__(self) -> str:
        return str(self.value)
