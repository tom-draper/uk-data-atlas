from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.postcode_batch_postcodes_item_status import (
    PostcodeBatchPostcodesItemStatus,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.lookup_point import LookupPoint
    from ..models.point_country import PointCountry
    from ..models.point_lookup_result import PointLookupResult
    from ..models.postcode_batch_postcodes_item_postcode import (
        PostcodeBatchPostcodesItemPostcode,
    )


T = TypeVar("T", bound="PostcodeBatchPostcodesItem")


@_attrs_define
class PostcodeBatchPostcodesItem:
    """
    Attributes:
        index (int):
        input_ (str): The postcode as given.
        status (PostcodeBatchPostcodesItemStatus):
        caution (str | Unset):
        detail (str | Unset):
        point (LookupPoint | Unset):
        point_country (PointCountry | Unset): The UK country the point lies in. `area-code` reads it from a matched
            area's GSS code; `country-boundary` tests the point against a country release, and a null `code` there means no
            UK country contains it.
        postcode (PostcodeBatchPostcodesItemPostcode | Unset): The directory's record, as `/postcodes/{postcode}` gives
            it, for a placed or not-placed postcode.
        results (list[PointLookupResult] | Unset): One per entry in releases, in the same order.
    """

    index: int
    input_: str
    status: PostcodeBatchPostcodesItemStatus
    caution: str | Unset = UNSET
    detail: str | Unset = UNSET
    point: LookupPoint | Unset = UNSET
    point_country: PointCountry | Unset = UNSET
    postcode: PostcodeBatchPostcodesItemPostcode | Unset = UNSET
    results: list[PointLookupResult] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        index = self.index

        input_ = self.input_

        status = self.status.value

        caution = self.caution

        detail = self.detail

        point: dict[str, Any] | Unset = UNSET
        if not isinstance(self.point, Unset):
            point = self.point.to_dict()

        point_country: dict[str, Any] | Unset = UNSET
        if not isinstance(self.point_country, Unset):
            point_country = self.point_country.to_dict()

        postcode: dict[str, Any] | Unset = UNSET
        if not isinstance(self.postcode, Unset):
            postcode = self.postcode.to_dict()

        results: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.results, Unset):
            results = []
            for results_item_data in self.results:
                results_item = results_item_data.to_dict()
                results.append(results_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "index": index,
                "input": input_,
                "status": status,
            }
        )
        if caution is not UNSET:
            field_dict["caution"] = caution
        if detail is not UNSET:
            field_dict["detail"] = detail
        if point is not UNSET:
            field_dict["point"] = point
        if point_country is not UNSET:
            field_dict["pointCountry"] = point_country
        if postcode is not UNSET:
            field_dict["postcode"] = postcode
        if results is not UNSET:
            field_dict["results"] = results

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.lookup_point import LookupPoint
        from ..models.point_country import PointCountry
        from ..models.point_lookup_result import PointLookupResult
        from ..models.postcode_batch_postcodes_item_postcode import (
            PostcodeBatchPostcodesItemPostcode,
        )

        d = dict(src_dict)
        index = d.pop("index")

        input_ = d.pop("input")

        status = PostcodeBatchPostcodesItemStatus(d.pop("status"))

        caution = d.pop("caution", UNSET)

        detail = d.pop("detail", UNSET)

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

        _postcode = d.pop("postcode", UNSET)
        postcode: PostcodeBatchPostcodesItemPostcode | Unset
        if isinstance(_postcode, Unset):
            postcode = UNSET
        else:
            postcode = PostcodeBatchPostcodesItemPostcode.from_dict(_postcode)

        _results = d.pop("results", UNSET)
        results: list[PointLookupResult] | Unset = UNSET
        if _results is not UNSET:
            results = []
            for results_item_data in _results:
                results_item = PointLookupResult.from_dict(results_item_data)

                results.append(results_item)

        postcode_batch_postcodes_item = cls(
            index=index,
            input_=input_,
            status=status,
            caution=caution,
            detail=detail,
            point=point,
            point_country=point_country,
            postcode=postcode,
            results=results,
        )

        postcode_batch_postcodes_item.additional_properties = d
        return postcode_batch_postcodes_item

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
