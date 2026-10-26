from enum import StrEnum


class TerrainPointSourceUncertaintyMetric(StrEnum):
    RMSE = "rmse"
    STATED_ACCURACY = "stated_accuracy"

    def __str__(self) -> str:
        return str(self.value)
