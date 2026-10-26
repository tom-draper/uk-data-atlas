from enum import StrEnum


class MapJoinBudgetProblemTitle(StrEnum):
    MAP_JOIN_BUDGET_EXCEEDED = "Map Join Budget Exceeded"

    def __str__(self) -> str:
        return str(self.value)
