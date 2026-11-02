from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.terrain_point_interpolation import TerrainPointInterpolation
from ..models.terrain_point_status import TerrainPointStatus
from ..models.terrain_point_unit import TerrainPointUnit

if TYPE_CHECKING:
    from ..models.terrain_point_source import TerrainPointSource


T = TypeVar("T", bound="TerrainPoint")


@_attrs_define
class TerrainPoint:
    """
    Attributes:
        interpolation (TerrainPointInterpolation):
        source (TerrainPointSource):
        status (TerrainPointStatus):
        unit (TerrainPointUnit):
        value (float | None):
        x (float):
        y (float):
    """

    interpolation: TerrainPointInterpolation
    source: TerrainPointSource
    status: TerrainPointStatus
    unit: TerrainPointUnit
    value: float | None
    x: float
    y: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        interpolation = self.interpolation.value

        source = self.source.to_dict()

        status = self.status.value

        unit = self.unit.value

        value: float | None
        value = self.value

        x = self.x

        y = self.y

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "interpolation": interpolation,
                "source": source,
                "status": status,
                "unit": unit,
                "value": value,
                "x": x,
                "y": y,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.terrain_point_source import TerrainPointSource

        d = dict(src_dict)
        interpolation = TerrainPointInterpolation(d.pop("interpolation"))

        source = TerrainPointSource.from_dict(d.pop("source"))

        status = TerrainPointStatus(d.pop("status"))

        unit = TerrainPointUnit(d.pop("unit"))

        def _parse_value(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        value = _parse_value(d.pop("value"))

        x = d.pop("x")

        y = d.pop("y")

        terrain_point = cls(
            interpolation=interpolation,
            source=source,
            status=status,
            unit=unit,
            value=value,
            x=x,
            y=y,
        )

        terrain_point.additional_properties = d
        return terrain_point

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
