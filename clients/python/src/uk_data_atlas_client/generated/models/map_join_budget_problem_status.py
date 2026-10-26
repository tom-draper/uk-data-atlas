from enum import IntEnum


class MapJoinBudgetProblemStatus(IntEnum):
    VALUE_422 = 422

    def __str__(self) -> str:
        return str(self.value)
