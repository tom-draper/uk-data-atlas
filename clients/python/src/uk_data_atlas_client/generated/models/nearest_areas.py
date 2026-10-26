from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.nearest_areas_relation import NearestAreasRelation
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.lookup_point import LookupPoint
    from ..models.nearest_areas_results_item import NearestAreasResultsItem


T = TypeVar("T", bound="NearestAreas")


@_attrs_define
class NearestAreas:
    """
    Attributes:
        distance_method (str):
        limit (int):
        note (str):
        point (LookupPoint):
        relation (NearestAreasRelation):
        results (list[NearestAreasResultsItem]):
        within (int):
        date (str | Unset):
    """

    distance_method: str
    limit: int
    note: str
    point: LookupPoint
    relation: NearestAreasRelation
    results: list[NearestAreasResultsItem]
    within: int
    date: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        distance_method = self.distance_method

        limit = self.limit

        note = self.note

        point = self.point.to_dict()

        relation = self.relation.value

        results = []
        for results_item_data in self.results:
            results_item = results_item_data.to_dict()
            results.append(results_item)

        within = self.within

        date = self.date

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "distanceMethod": distance_method,
                "limit": limit,
                "note": note,
                "point": point,
                "relation": relation,
                "results": results,
                "within": within,
            }
        )
        if date is not UNSET:
            field_dict["date"] = date

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.lookup_point import LookupPoint
        from ..models.nearest_areas_results_item import NearestAreasResultsItem

        d = dict(src_dict)
        distance_method = d.pop("distanceMethod")

        limit = d.pop("limit")

        note = d.pop("note")

        point = LookupPoint.from_dict(d.pop("point"))

        relation = NearestAreasRelation(d.pop("relation"))

        results = []
        _results = d.pop("results")
        for results_item_data in _results:
            results_item = NearestAreasResultsItem.from_dict(results_item_data)

            results.append(results_item)

        within = d.pop("within")

        date = d.pop("date", UNSET)

        nearest_areas = cls(
            distance_method=distance_method,
            limit=limit,
            note=note,
            point=point,
            relation=relation,
            results=results,
            within=within,
            date=date,
        )

        nearest_areas.additional_properties = d
        return nearest_areas

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
