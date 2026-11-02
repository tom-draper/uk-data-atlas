from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.find_similar_areas_response_200_data_areas_item_values import (
        FindSimilarAreasResponse200DataAreasItemValues,
    )


T = TypeVar("T", bound="FindSimilarAreasResponse200DataAreasItem")


@_attrs_define
class FindSimilarAreasResponse200DataAreasItem:
    """
    Attributes:
        area_code (str):
        distance (float):
        rank (int):
        values (FindSimilarAreasResponse200DataAreasItemValues):
    """

    area_code: str
    distance: float
    rank: int
    values: FindSimilarAreasResponse200DataAreasItemValues
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        area_code = self.area_code

        distance = self.distance

        rank = self.rank

        values = self.values.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "areaCode": area_code,
                "distance": distance,
                "rank": rank,
                "values": values,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.find_similar_areas_response_200_data_areas_item_values import (
            FindSimilarAreasResponse200DataAreasItemValues,  # noqa: PLC0415
        )

        d = dict(src_dict)
        area_code = d.pop("areaCode")

        distance = d.pop("distance")

        rank = d.pop("rank")

        values = FindSimilarAreasResponse200DataAreasItemValues.from_dict(
            d.pop("values")
        )

        find_similar_areas_response_200_data_areas_item = cls(
            area_code=area_code,
            distance=distance,
            rank=rank,
            values=values,
        )

        find_similar_areas_response_200_data_areas_item.additional_properties = d
        return find_similar_areas_response_200_data_areas_item

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
