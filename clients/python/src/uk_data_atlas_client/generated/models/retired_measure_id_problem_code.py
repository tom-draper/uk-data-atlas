from enum import StrEnum


class RetiredMeasureIdProblemCode(StrEnum):
    RETIRED_MEASURE_ID = "retired_measure_id"

    def __str__(self) -> str:
        return str(self.value)
