from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.relationship_candidate_validation_endpoints import (
        RelationshipCandidateValidationEndpoints,
    )
    from ..models.relationship_candidate_validation_relationship import (
        RelationshipCandidateValidationRelationship,
    )


T = TypeVar("T", bound="RelationshipCandidateValidation")


@_attrs_define
class RelationshipCandidateValidation:
    """
    Attributes:
        endpoints (RelationshipCandidateValidationEndpoints):
        reasons (list[str]):
        relationship (RelationshipCandidateValidationRelationship):
    """

    endpoints: RelationshipCandidateValidationEndpoints
    reasons: list[str]
    relationship: RelationshipCandidateValidationRelationship
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        endpoints = self.endpoints.to_dict()

        reasons = self.reasons

        relationship = self.relationship.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "endpoints": endpoints,
                "reasons": reasons,
                "relationship": relationship,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.relationship_candidate_validation_endpoints import (
            RelationshipCandidateValidationEndpoints,
        )
        from ..models.relationship_candidate_validation_relationship import (
            RelationshipCandidateValidationRelationship,
        )

        d = dict(src_dict)
        endpoints = RelationshipCandidateValidationEndpoints.from_dict(
            d.pop("endpoints")
        )

        reasons = cast(list[str], d.pop("reasons"))

        relationship = RelationshipCandidateValidationRelationship.from_dict(
            d.pop("relationship")
        )

        relationship_candidate_validation = cls(
            endpoints=endpoints,
            reasons=reasons,
            relationship=relationship,
        )

        relationship_candidate_validation.additional_properties = d
        return relationship_candidate_validation

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
