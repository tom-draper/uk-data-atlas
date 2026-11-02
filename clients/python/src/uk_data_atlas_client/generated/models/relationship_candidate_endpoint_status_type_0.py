from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.relationship_candidate_endpoint_status_type_0_status import (
    RelationshipCandidateEndpointStatusType0Status,
)

T = TypeVar("T", bound="RelationshipCandidateEndpointStatusType0")


@_attrs_define
class RelationshipCandidateEndpointStatusType0:
    """
    Attributes:
        available_area_count (int):
        referenced_code_count (int):
        status (RelationshipCandidateEndpointStatusType0Status):
    """

    available_area_count: int
    referenced_code_count: int
    status: RelationshipCandidateEndpointStatusType0Status
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        available_area_count = self.available_area_count

        referenced_code_count = self.referenced_code_count

        status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "availableAreaCount": available_area_count,
                "referencedCodeCount": referenced_code_count,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        available_area_count = d.pop("availableAreaCount")

        referenced_code_count = d.pop("referencedCodeCount")

        status = RelationshipCandidateEndpointStatusType0Status(d.pop("status"))

        relationship_candidate_endpoint_status_type_0 = cls(
            available_area_count=available_area_count,
            referenced_code_count=referenced_code_count,
            status=status,
        )

        relationship_candidate_endpoint_status_type_0.additional_properties = d
        return relationship_candidate_endpoint_status_type_0

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
