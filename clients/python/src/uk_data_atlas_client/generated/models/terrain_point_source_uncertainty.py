from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.terrain_point_source_uncertainty_metric import (
    TerrainPointSourceUncertaintyMetric,
)

T = TypeVar("T", bound="TerrainPointSourceUncertainty")


@_attrs_define
class TerrainPointSourceUncertainty:
    """
    Attributes:
        metric (TerrainPointSourceUncertaintyMetric):
        value_metres (float):
    """

    metric: TerrainPointSourceUncertaintyMetric
    value_metres: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        metric = self.metric.value

        value_metres = self.value_metres

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "metric": metric,
                "valueMetres": value_metres,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        metric = TerrainPointSourceUncertaintyMetric(d.pop("metric"))

        value_metres = d.pop("valueMetres")

        terrain_point_source_uncertainty = cls(
            metric=metric,
            value_metres=value_metres,
        )

        terrain_point_source_uncertainty.additional_properties = d
        return terrain_point_source_uncertainty

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
