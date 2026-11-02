from enum import StrEnum


class FindSimilarAreasResponse200DataMethod(StrEnum):
    RANK_EUCLIDEAN = "rank-euclidean"
    ZSCORE_EUCLIDEAN = "zscore-euclidean"

    def __str__(self) -> str:
        return str(self.value)
