from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AreaChildrenGeometryWithoutGeometryItem")


@_attrs_define
class AreaChildrenGeometryWithoutGeometryItem:
    """
    Attributes:
        boundary_release (str):
        code (str):
        geography (str):
        id (str):
        reason (str):
    """

    boundary_release: str
    code: str
    geography: str
    id: str
    reason: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        boundary_release = self.boundary_release

        code = self.code

        geography = self.geography

        id = self.id

        reason = self.reason

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "boundaryRelease": boundary_release,
                "code": code,
                "geography": geography,
                "id": id,
                "reason": reason,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        boundary_release = d.pop("boundaryRelease")

        code = d.pop("code")

        geography = d.pop("geography")

        id = d.pop("id")

        reason = d.pop("reason")

        area_children_geometry_without_geometry_item = cls(
            boundary_release=boundary_release,
            code=code,
            geography=geography,
            id=id,
            reason=reason,
        )

        area_children_geometry_without_geometry_item.additional_properties = d
        return area_children_geometry_without_geometry_item

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
