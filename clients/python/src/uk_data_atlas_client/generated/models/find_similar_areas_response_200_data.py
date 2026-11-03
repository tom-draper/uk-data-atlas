from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.find_similar_areas_response_200_data_method import (
    FindSimilarAreasResponse200DataMethod,
)

if TYPE_CHECKING:
    from ..models.find_similar_areas_response_200_data_areas_item import (
        FindSimilarAreasResponse200DataAreasItem,
    )
    from ..models.find_similar_areas_response_200_data_measures_item import (
        FindSimilarAreasResponse200DataMeasuresItem,
    )
    from ..models.find_similar_areas_response_200_data_target import (
        FindSimilarAreasResponse200DataTarget,
    )


T = TypeVar("T", bound="FindSimilarAreasResponse200Data")


@_attrs_define
class FindSimilarAreasResponse200Data:
    """
    Attributes:
        areas (list[FindSimilarAreasResponse200DataAreasItem]):
        dropped_area_count (int):
        measures (list[FindSimilarAreasResponse200DataMeasuresItem]):
        method (FindSimilarAreasResponse200DataMethod):
        target (FindSimilarAreasResponse200DataTarget):
    """

    areas: list[FindSimilarAreasResponse200DataAreasItem]
    dropped_area_count: int
    measures: list[FindSimilarAreasResponse200DataMeasuresItem]
    method: FindSimilarAreasResponse200DataMethod
    target: FindSimilarAreasResponse200DataTarget
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        areas = []
        for areas_item_data in self.areas:
            areas_item = areas_item_data.to_dict()
            areas.append(areas_item)

        dropped_area_count = self.dropped_area_count

        measures = []
        for measures_item_data in self.measures:
            measures_item = measures_item_data.to_dict()
            measures.append(measures_item)

        method = self.method.value

        target = self.target.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "areas": areas,
                "droppedAreaCount": dropped_area_count,
                "measures": measures,
                "method": method,
                "target": target,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.find_similar_areas_response_200_data_areas_item import (
            FindSimilarAreasResponse200DataAreasItem,
        )
        from ..models.find_similar_areas_response_200_data_measures_item import (
            FindSimilarAreasResponse200DataMeasuresItem,
        )
        from ..models.find_similar_areas_response_200_data_target import (
            FindSimilarAreasResponse200DataTarget,
        )

        d = dict(src_dict)
        areas = []
        _areas = d.pop("areas")
        for areas_item_data in _areas:
            areas_item = FindSimilarAreasResponse200DataAreasItem.from_dict(
                areas_item_data
            )

            areas.append(areas_item)

        dropped_area_count = d.pop("droppedAreaCount")

        measures = []
        _measures = d.pop("measures")
        for measures_item_data in _measures:
            measures_item = FindSimilarAreasResponse200DataMeasuresItem.from_dict(
                measures_item_data
            )

            measures.append(measures_item)

        method = FindSimilarAreasResponse200DataMethod(d.pop("method"))

        target = FindSimilarAreasResponse200DataTarget.from_dict(d.pop("target"))

        find_similar_areas_response_200_data = cls(
            areas=areas,
            dropped_area_count=dropped_area_count,
            measures=measures,
            method=method,
            target=target,
        )

        find_similar_areas_response_200_data.additional_properties = d
        return find_similar_areas_response_200_data

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
