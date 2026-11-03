from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="ValidateAreaValuesPostedJsonBodyRowsItem")


@_attrs_define
class ValidateAreaValuesPostedJsonBodyRowsItem:
    """
    Attributes:
        area (str | Unset):
        parent (str | Unset):
    """

    area: str | Unset = UNSET
    parent: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        area = self.area

        parent = self.parent

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if area is not UNSET:
            field_dict["area"] = area
        if parent is not UNSET:
            field_dict["parent"] = parent

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        area = d.pop("area", UNSET)

        parent = d.pop("parent", UNSET)

        validate_area_values_posted_json_body_rows_item = cls(
            area=area,
            parent=parent,
        )

        validate_area_values_posted_json_body_rows_item.additional_properties = d
        return validate_area_values_posted_json_body_rows_item

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
