from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AreaMetricsArea")


@_attrs_define
class AreaMetricsArea:
    """One measurement, in three units.

    Attributes:
        hectares (float):
        km2 (float):
        m2 (float):
    """

    hectares: float
    km2: float
    m2: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        hectares = self.hectares

        km2 = self.km2

        m2 = self.m2

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "hectares": hectares,
                "km2": km2,
                "m2": m2,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        hectares = d.pop("hectares")

        km2 = d.pop("km2")

        m2 = d.pop("m2")

        area_metrics_area = cls(
            hectares=hectares,
            km2=km2,
            m2=m2,
        )

        area_metrics_area.additional_properties = d
        return area_metrics_area

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
