from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.lookup_point import LookupPoint
    from ..models.point_country import PointCountry
    from ..models.point_lookup_result import PointLookupResult


T = TypeVar("T", bound="PointContainmentBatchPointsItem")


@_attrs_define
class PointContainmentBatchPointsItem:
    """
    Attributes:
        country (PointCountry): The UK country the point lies in. `area-code` reads it from a matched area's GSS code;
            `country-boundary` tests the point against a country release, and a null `code` there means no UK country
            contains it.
        index (int):
        point (LookupPoint):
        results (list[PointLookupResult]): One per entry in releases, in the same order.
    """

    country: PointCountry
    index: int
    point: LookupPoint
    results: list[PointLookupResult]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        country = self.country.to_dict()

        index = self.index

        point = self.point.to_dict()

        results = []
        for results_item_data in self.results:
            results_item = results_item_data.to_dict()
            results.append(results_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "country": country,
                "index": index,
                "point": point,
                "results": results,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.lookup_point import LookupPoint
        from ..models.point_country import PointCountry
        from ..models.point_lookup_result import PointLookupResult

        d = dict(src_dict)
        country = PointCountry.from_dict(d.pop("country"))

        index = d.pop("index")

        point = LookupPoint.from_dict(d.pop("point"))

        results = []
        _results = d.pop("results")
        for results_item_data in _results:
            results_item = PointLookupResult.from_dict(results_item_data)

            results.append(results_item)

        point_containment_batch_points_item = cls(
            country=country,
            index=index,
            point=point,
            results=results,
        )

        point_containment_batch_points_item.additional_properties = d
        return point_containment_batch_points_item

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
