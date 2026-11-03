from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.map_resource_join_join import MapResourceJoinJoin
    from ..models.map_resource_join_measure import MapResourceJoinMeasure
    from ..models.map_resource_join_provenance import MapResourceJoinProvenance
    from ..models.map_resource_join_source_geography import (
        MapResourceJoinSourceGeography,
    )
    from ..models.map_resource_join_values_item import MapResourceJoinValuesItem


T = TypeVar("T", bound="MapResourceJoin")


@_attrs_define
class MapResourceJoin:
    """
    Attributes:
        areas_without_value (int): Areas in the release the measure publishes no value for. They are in the tiles and
            absent from this table, and a renderer should draw them as having no data rather than as zero.
        join (MapResourceJoinJoin):
        layer (str): The tile layer these values are numbered for.
        measure (MapResourceJoinMeasure):
        period (str):
        provenance (MapResourceJoinProvenance):
        source_geography (MapResourceJoinSourceGeography):
        values (list[MapResourceJoinValuesItem]):
    """

    areas_without_value: int
    join: MapResourceJoinJoin
    layer: str
    measure: MapResourceJoinMeasure
    period: str
    provenance: MapResourceJoinProvenance
    source_geography: MapResourceJoinSourceGeography
    values: list[MapResourceJoinValuesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        areas_without_value = self.areas_without_value

        join = self.join.to_dict()

        layer = self.layer

        measure = self.measure.to_dict()

        period = self.period

        provenance = self.provenance.to_dict()

        source_geography = self.source_geography.to_dict()

        values = []
        for values_item_data in self.values:
            values_item = values_item_data.to_dict()
            values.append(values_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "areasWithoutValue": areas_without_value,
                "join": join,
                "layer": layer,
                "measure": measure,
                "period": period,
                "provenance": provenance,
                "sourceGeography": source_geography,
                "values": values,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.map_resource_join_join import MapResourceJoinJoin
        from ..models.map_resource_join_measure import MapResourceJoinMeasure
        from ..models.map_resource_join_provenance import MapResourceJoinProvenance
        from ..models.map_resource_join_source_geography import (
            MapResourceJoinSourceGeography,
        )
        from ..models.map_resource_join_values_item import MapResourceJoinValuesItem

        d = dict(src_dict)
        areas_without_value = d.pop("areasWithoutValue")

        join = MapResourceJoinJoin.from_dict(d.pop("join"))

        layer = d.pop("layer")

        measure = MapResourceJoinMeasure.from_dict(d.pop("measure"))

        period = d.pop("period")

        provenance = MapResourceJoinProvenance.from_dict(d.pop("provenance"))

        source_geography = MapResourceJoinSourceGeography.from_dict(
            d.pop("sourceGeography")
        )

        values = []
        _values = d.pop("values")
        for values_item_data in _values:
            values_item = MapResourceJoinValuesItem.from_dict(values_item_data)

            values.append(values_item)

        map_resource_join = cls(
            areas_without_value=areas_without_value,
            join=join,
            layer=layer,
            measure=measure,
            period=period,
            provenance=provenance,
            source_geography=source_geography,
            values=values,
        )

        map_resource_join.additional_properties = d
        return map_resource_join

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
