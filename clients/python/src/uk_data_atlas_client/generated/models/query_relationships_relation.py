from enum import StrEnum


class QueryRelationshipsRelation(StrEnum):
    CONTAINS = "contains"
    EQUIVALENT_TO = "equivalent-to"
    MERGED_FROM = "merged-from"
    OVERLAPS = "overlaps"
    PREDECESSOR = "predecessor"
    SPLIT_FROM = "split-from"
    SUCCESSOR = "successor"
    WITHIN = "within"

    def __str__(self) -> str:
        return str(self.value)
