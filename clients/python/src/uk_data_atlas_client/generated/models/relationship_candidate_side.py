from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="RelationshipCandidateSide")


@_attrs_define
class RelationshipCandidateSide:
    """
    Attributes:
        boundary_release (str):
        code_property (str):
        geography (str):
        name_property (str):
    """

    boundary_release: str
    code_property: str
    geography: str
    name_property: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        boundary_release = self.boundary_release

        code_property = self.code_property

        geography = self.geography

        name_property = self.name_property

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "boundaryRelease": boundary_release,
                "codeProperty": code_property,
                "geography": geography,
                "nameProperty": name_property,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        boundary_release = d.pop("boundaryRelease")

        code_property = d.pop("codeProperty")

        geography = d.pop("geography")

        name_property = d.pop("nameProperty")

        relationship_candidate_side = cls(
            boundary_release=boundary_release,
            code_property=code_property,
            geography=geography,
            name_property=name_property,
        )

        relationship_candidate_side.additional_properties = d
        return relationship_candidate_side

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
