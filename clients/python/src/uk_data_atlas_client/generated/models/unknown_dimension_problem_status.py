from enum import IntEnum


class UnknownDimensionProblemStatus(IntEnum):
    VALUE_400 = 400

    def __str__(self) -> str:
        return str(self.value)
