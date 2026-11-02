from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AreaNeighboursMethod")


@_attrs_define
class AreaNeighboursMethod:
    """
    Attributes:
        limits (str):
        rule (str):
        shared_border (str):
        unshared (str):
    """

    limits: str
    rule: str
    shared_border: str
    unshared: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        limits = self.limits

        rule = self.rule

        shared_border = self.shared_border

        unshared = self.unshared

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "limits": limits,
                "rule": rule,
                "sharedBorder": shared_border,
                "unshared": unshared,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        limits = d.pop("limits")

        rule = d.pop("rule")

        shared_border = d.pop("sharedBorder")

        unshared = d.pop("unshared")

        area_neighbours_method = cls(
            limits=limits,
            rule=rule,
            shared_border=shared_border,
            unshared=unshared,
        )

        area_neighbours_method.additional_properties = d
        return area_neighbours_method

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
