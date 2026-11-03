from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.point_containment_boundary_rule import PointContainmentBoundaryRule
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.lookup_point import LookupPoint
    from ..models.point_containment_postcode import PointContainmentPostcode
    from ..models.point_containment_results_item import PointContainmentResultsItem
    from ..models.point_country import PointCountry


T = TypeVar("T", bound="PointContainment")


@_attrs_define
class PointContainment:
    """
    Attributes:
        boundary_rule (PointContainmentBoundaryRule):
        country (PointCountry): The UK country the point lies in. `area-code` reads it from a matched area's GSS code;
            `country-boundary` tests the point against a country release, and a null `code` there means no UK country
            contains it.
        note (str):
        point (LookupPoint):
        results (list[PointContainmentResultsItem]): One per requested geography, in the order requested.
        date (str | Unset):
        postcode (PointContainmentPostcode | Unset): Present when the point is a postcode's centroid.
    """

    boundary_rule: PointContainmentBoundaryRule
    country: PointCountry
    note: str
    point: LookupPoint
    results: list[PointContainmentResultsItem]
    date: str | Unset = UNSET
    postcode: PointContainmentPostcode | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        boundary_rule = self.boundary_rule.value

        country = self.country.to_dict()

        note = self.note

        point = self.point.to_dict()

        results = []
        for results_item_data in self.results:
            results_item = results_item_data.to_dict()
            results.append(results_item)

        date = self.date

        postcode: dict[str, Any] | Unset = UNSET
        if not isinstance(self.postcode, Unset):
            postcode = self.postcode.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "boundaryRule": boundary_rule,
                "country": country,
                "note": note,
                "point": point,
                "results": results,
            }
        )
        if date is not UNSET:
            field_dict["date"] = date
        if postcode is not UNSET:
            field_dict["postcode"] = postcode

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.lookup_point import LookupPoint
        from ..models.point_containment_postcode import PointContainmentPostcode
        from ..models.point_containment_results_item import PointContainmentResultsItem
        from ..models.point_country import PointCountry

        d = dict(src_dict)
        boundary_rule = PointContainmentBoundaryRule(d.pop("boundaryRule"))

        country = PointCountry.from_dict(d.pop("country"))

        note = d.pop("note")

        point = LookupPoint.from_dict(d.pop("point"))

        results = []
        _results = d.pop("results")
        for results_item_data in _results:
            results_item = PointContainmentResultsItem.from_dict(results_item_data)

            results.append(results_item)

        date = d.pop("date", UNSET)

        _postcode = d.pop("postcode", UNSET)
        postcode: PointContainmentPostcode | Unset
        if isinstance(_postcode, Unset):
            postcode = UNSET
        else:
            postcode = PointContainmentPostcode.from_dict(_postcode)

        point_containment = cls(
            boundary_rule=boundary_rule,
            country=country,
            note=note,
            point=point,
            results=results,
            date=date,
            postcode=postcode,
        )

        point_containment.additional_properties = d
        return point_containment

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
