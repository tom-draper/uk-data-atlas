from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.find_similar_areas_response_200_data_measures_item_source_geography import (
        FindSimilarAreasResponse200DataMeasuresItemSourceGeography,
    )


T = TypeVar("T", bound="FindSimilarAreasResponse200DataMeasuresItem")


@_attrs_define
class FindSimilarAreasResponse200DataMeasuresItem:
    """
    Attributes:
        id (str):
        mean (float):
        period (str):
        source_geography (FindSimilarAreasResponse200DataMeasuresItemSourceGeography):
        standard_deviation (float):
    """

    id: str
    mean: float
    period: str
    source_geography: FindSimilarAreasResponse200DataMeasuresItemSourceGeography
    standard_deviation: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        mean = self.mean

        period = self.period

        source_geography = self.source_geography.to_dict()

        standard_deviation = self.standard_deviation

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "mean": mean,
                "period": period,
                "sourceGeography": source_geography,
                "standardDeviation": standard_deviation,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.find_similar_areas_response_200_data_measures_item_source_geography import (
            FindSimilarAreasResponse200DataMeasuresItemSourceGeography,
        )

        d = dict(src_dict)
        id = d.pop("id")

        mean = d.pop("mean")

        period = d.pop("period")

        source_geography = (
            FindSimilarAreasResponse200DataMeasuresItemSourceGeography.from_dict(
                d.pop("sourceGeography")
            )
        )

        standard_deviation = d.pop("standardDeviation")

        find_similar_areas_response_200_data_measures_item = cls(
            id=id,
            mean=mean,
            period=period,
            source_geography=source_geography,
            standard_deviation=standard_deviation,
        )

        find_similar_areas_response_200_data_measures_item.additional_properties = d
        return find_similar_areas_response_200_data_measures_item

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
