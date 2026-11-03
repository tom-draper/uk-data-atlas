from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.postcode_lookup_boundary_rule import PostcodeLookupBoundaryRule
from ..models.postcode_lookup_date_basis import PostcodeLookupDateBasis
from ..models.postcode_lookup_status import PostcodeLookupStatus
from ..models.postcode_lookup_user_type import PostcodeLookupUserType
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.lookup_point import LookupPoint
    from ..models.point_country import PointCountry
    from ..models.postcode_lookup_centroid_type_1 import PostcodeLookupCentroidType1
    from ..models.postcode_lookup_results_item import PostcodeLookupResultsItem
    from ..models.postcode_lookup_source import PostcodeLookupSource


T = TypeVar("T", bound="PostcodeLookup")


@_attrs_define
class PostcodeLookup:
    """
    Attributes:
        centroid (None | PostcodeLookupCentroidType1):
        country (str): The country code the directory assigns, including L93000001 for the Channel Islands and M83000003
            for the Isle of Man.
        introduced (str): YYYY-MM
        postcode (str): The postcode as the directory writes it, such as `SW1A 1AA`.
        results (list[PostcodeLookupResultsItem]): One per requested geography, in the order requested; empty when the
            postcode has no centroid.
        source (PostcodeLookupSource):
        status (PostcodeLookupStatus):
        user_type (PostcodeLookupUserType): A large user is a single address receiving enough mail for its own postcode.
        boundary_rule (PostcodeLookupBoundaryRule | Unset):
        caution (str | Unset):
        date (str | Unset):
        date_basis (PostcodeLookupDateBasis | Unset):
        detail (str | Unset):
        note (str | Unset):
        point (LookupPoint | Unset):
        point_country (PointCountry | Unset): The UK country the point lies in. `area-code` reads it from a matched
            area's GSS code; `country-boundary` tests the point against a country release, and a null `code` there means no
            UK country contains it.
        terminated (str | Unset): YYYY-MM, when terminated.
    """

    centroid: None | PostcodeLookupCentroidType1
    country: str
    introduced: str
    postcode: str
    results: list[PostcodeLookupResultsItem]
    source: PostcodeLookupSource
    status: PostcodeLookupStatus
    user_type: PostcodeLookupUserType
    boundary_rule: PostcodeLookupBoundaryRule | Unset = UNSET
    caution: str | Unset = UNSET
    date: str | Unset = UNSET
    date_basis: PostcodeLookupDateBasis | Unset = UNSET
    detail: str | Unset = UNSET
    note: str | Unset = UNSET
    point: LookupPoint | Unset = UNSET
    point_country: PointCountry | Unset = UNSET
    terminated: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.postcode_lookup_centroid_type_1 import PostcodeLookupCentroidType1

        centroid: dict[str, Any] | None
        if isinstance(self.centroid, PostcodeLookupCentroidType1):
            centroid = self.centroid.to_dict()
        else:
            centroid = self.centroid

        country = self.country

        introduced = self.introduced

        postcode = self.postcode

        results = []
        for results_item_data in self.results:
            results_item = results_item_data.to_dict()
            results.append(results_item)

        source = self.source.to_dict()

        status = self.status.value

        user_type = self.user_type.value

        boundary_rule: str | Unset = UNSET
        if not isinstance(self.boundary_rule, Unset):
            boundary_rule = self.boundary_rule.value

        caution = self.caution

        date = self.date

        date_basis: str | Unset = UNSET
        if not isinstance(self.date_basis, Unset):
            date_basis = self.date_basis.value

        detail = self.detail

        note = self.note

        point: dict[str, Any] | Unset = UNSET
        if not isinstance(self.point, Unset):
            point = self.point.to_dict()

        point_country: dict[str, Any] | Unset = UNSET
        if not isinstance(self.point_country, Unset):
            point_country = self.point_country.to_dict()

        terminated = self.terminated

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "centroid": centroid,
                "country": country,
                "introduced": introduced,
                "postcode": postcode,
                "results": results,
                "source": source,
                "status": status,
                "userType": user_type,
            }
        )
        if boundary_rule is not UNSET:
            field_dict["boundaryRule"] = boundary_rule
        if caution is not UNSET:
            field_dict["caution"] = caution
        if date is not UNSET:
            field_dict["date"] = date
        if date_basis is not UNSET:
            field_dict["dateBasis"] = date_basis
        if detail is not UNSET:
            field_dict["detail"] = detail
        if note is not UNSET:
            field_dict["note"] = note
        if point is not UNSET:
            field_dict["point"] = point
        if point_country is not UNSET:
            field_dict["pointCountry"] = point_country
        if terminated is not UNSET:
            field_dict["terminated"] = terminated

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.lookup_point import LookupPoint
        from ..models.point_country import PointCountry
        from ..models.postcode_lookup_centroid_type_1 import PostcodeLookupCentroidType1
        from ..models.postcode_lookup_results_item import PostcodeLookupResultsItem
        from ..models.postcode_lookup_source import PostcodeLookupSource

        d = dict(src_dict)

        def _parse_centroid(data: object) -> None | PostcodeLookupCentroidType1:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                centroid_type_1 = PostcodeLookupCentroidType1.from_dict(data)

                return centroid_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | PostcodeLookupCentroidType1, data)

        centroid = _parse_centroid(d.pop("centroid"))

        country = d.pop("country")

        introduced = d.pop("introduced")

        postcode = d.pop("postcode")

        results = []
        _results = d.pop("results")
        for results_item_data in _results:
            results_item = PostcodeLookupResultsItem.from_dict(results_item_data)

            results.append(results_item)

        source = PostcodeLookupSource.from_dict(d.pop("source"))

        status = PostcodeLookupStatus(d.pop("status"))

        user_type = PostcodeLookupUserType(d.pop("userType"))

        _boundary_rule = d.pop("boundaryRule", UNSET)
        boundary_rule: PostcodeLookupBoundaryRule | Unset
        if isinstance(_boundary_rule, Unset):
            boundary_rule = UNSET
        else:
            boundary_rule = PostcodeLookupBoundaryRule(_boundary_rule)

        caution = d.pop("caution", UNSET)

        date = d.pop("date", UNSET)

        _date_basis = d.pop("dateBasis", UNSET)
        date_basis: PostcodeLookupDateBasis | Unset
        if isinstance(_date_basis, Unset):
            date_basis = UNSET
        else:
            date_basis = PostcodeLookupDateBasis(_date_basis)

        detail = d.pop("detail", UNSET)

        note = d.pop("note", UNSET)

        _point = d.pop("point", UNSET)
        point: LookupPoint | Unset
        if isinstance(_point, Unset):
            point = UNSET
        else:
            point = LookupPoint.from_dict(_point)

        _point_country = d.pop("pointCountry", UNSET)
        point_country: PointCountry | Unset
        if isinstance(_point_country, Unset):
            point_country = UNSET
        else:
            point_country = PointCountry.from_dict(_point_country)

        terminated = d.pop("terminated", UNSET)

        postcode_lookup = cls(
            centroid=centroid,
            country=country,
            introduced=introduced,
            postcode=postcode,
            results=results,
            source=source,
            status=status,
            user_type=user_type,
            boundary_rule=boundary_rule,
            caution=caution,
            date=date,
            date_basis=date_basis,
            detail=detail,
            note=note,
            point=point,
            point_country=point_country,
            terminated=terminated,
        )

        postcode_lookup.additional_properties = d
        return postcode_lookup

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
