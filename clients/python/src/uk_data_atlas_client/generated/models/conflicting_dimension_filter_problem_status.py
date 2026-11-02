from enum import IntEnum


class ConflictingDimensionFilterProblemStatus(IntEnum):
    VALUE_400 = 400

    def __str__(self) -> str:
        return str(self.value)
