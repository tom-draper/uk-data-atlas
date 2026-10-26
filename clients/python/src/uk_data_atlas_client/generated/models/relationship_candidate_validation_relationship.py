from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="RelationshipCandidateValidationRelationship")


@_attrs_define
class RelationshipCandidateValidationRelationship:
    """
    Attributes:
        missing_value_feature_count (int):
        multi_target_source_count (int):
        source_code_count (int):
        source_feature_count (int):
        target_code_count (int):
    """

    missing_value_feature_count: int
    multi_target_source_count: int
    source_code_count: int
    source_feature_count: int
    target_code_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        missing_value_feature_count = self.missing_value_feature_count

        multi_target_source_count = self.multi_target_source_count

        source_code_count = self.source_code_count

        source_feature_count = self.source_feature_count

        target_code_count = self.target_code_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "missingValueFeatureCount": missing_value_feature_count,
                "multiTargetSourceCount": multi_target_source_count,
                "sourceCodeCount": source_code_count,
                "sourceFeatureCount": source_feature_count,
                "targetCodeCount": target_code_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        missing_value_feature_count = d.pop("missingValueFeatureCount")

        multi_target_source_count = d.pop("multiTargetSourceCount")

        source_code_count = d.pop("sourceCodeCount")

        source_feature_count = d.pop("sourceFeatureCount")

        target_code_count = d.pop("targetCodeCount")

        relationship_candidate_validation_relationship = cls(
            missing_value_feature_count=missing_value_feature_count,
            multi_target_source_count=multi_target_source_count,
            source_code_count=source_code_count,
            source_feature_count=source_feature_count,
            target_code_count=target_code_count,
        )

        relationship_candidate_validation_relationship.additional_properties = d
        return relationship_candidate_validation_relationship

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
