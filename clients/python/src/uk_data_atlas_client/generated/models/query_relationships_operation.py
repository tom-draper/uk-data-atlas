from enum import StrEnum


class QueryRelationshipsOperation(StrEnum):
    CODE_TRANSLATION = "code-translation"
    CONTAINMENT_AGGREGATION = "containment-aggregation"
    IDENTITY_JOIN = "identity-join"
    MEMBERSHIP_JOIN = "membership-join"
    WEIGHTED_ALLOCATION = "weighted-allocation"

    def __str__(self) -> str:
        return str(self.value)
