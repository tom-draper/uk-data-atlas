from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AreaChildrenGeometryCollectionGeneralisationMethod")


@_attrs_define
class AreaChildrenGeometryCollectionGeneralisationMethod:
    """
    Attributes:
        parts (str):
        rule (str):
        shared_borders (str):
        threshold (str):
    """

    parts: str
    rule: str
    shared_borders: str
    threshold: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        parts = self.parts

        rule = self.rule

        shared_borders = self.shared_borders

        threshold = self.threshold

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "parts": parts,
                "rule": rule,
                "sharedBorders": shared_borders,
                "threshold": threshold,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        parts = d.pop("parts")

        rule = d.pop("rule")

        shared_borders = d.pop("sharedBorders")

        threshold = d.pop("threshold")

        area_children_geometry_collection_generalisation_method = cls(
            parts=parts,
            rule=rule,
            shared_borders=shared_borders,
            threshold=threshold,
        )

        area_children_geometry_collection_generalisation_method.additional_properties = d
        return area_children_geometry_collection_generalisation_method

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
