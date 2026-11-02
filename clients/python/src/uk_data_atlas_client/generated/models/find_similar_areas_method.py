from enum import StrEnum


class FindSimilarAreasMethod(StrEnum):
    RANK_EUCLIDEAN = "rank-euclidean"
    ZSCORE_EUCLIDEAN = "zscore-euclidean"

    def __str__(self) -> str:
        return str(self.value)
