from enum import StrEnum


class LookupPointInputGridReferencePosition(StrEnum):
    CELL_CENTRE = "cell-centre"

    def __str__(self) -> str:
        return str(self.value)
