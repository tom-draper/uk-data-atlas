from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.compact_postcode_batch_postcodes_item_status import (
    CompactPostcodeBatchPostcodesItemStatus,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.compact_point_lookup_result import CompactPointLookupResult
    from ..models.compact_postcode_batch_postcodes_item_point import (
        CompactPostcodeBatchPostcodesItemPoint,
    )
    from ..models.compact_postcode_record import CompactPostcodeRecord


T = TypeVar("T", bound="CompactPostcodeBatchPostcodesItem")


@_attrs_define
class CompactPostcodeBatchPostcodesItem:
    """
    Attributes:
        index (int):
        input_ (str):
        status (CompactPostcodeBatchPostcodesItemStatus):
        caution (str | Unset):
        detail (str | Unset):
        point (CompactPostcodeBatchPostcodesItemPoint | Unset):
        postcode (CompactPostcodeRecord | Unset):
        results (list[CompactPointLookupResult] | Unset): One per entry in releases, in the same order.
    """

    index: int
    input_: str
    status: CompactPostcodeBatchPostcodesItemStatus
    caution: str | Unset = UNSET
    detail: str | Unset = UNSET
    point: CompactPostcodeBatchPostcodesItemPoint | Unset = UNSET
    postcode: CompactPostcodeRecord | Unset = UNSET
    results: list[CompactPointLookupResult] | Unset = UNSET
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
        if postcode is not UNSET:
            field_dict["postcode"] = postcode
        if results is not UNSET:
            field_dict["results"] = results

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.compact_point_lookup_result import CompactPointLookupResult
        from ..models.compact_postcode_batch_postcodes_item_point import (
            CompactPostcodeBatchPostcodesItemPoint,
        )
        from ..models.compact_postcode_record import CompactPostcodeRecord

        d = dict(src_dict)
        index = d.pop("index")

        input_ = d.pop("input")

        status = CompactPostcodeBatchPostcodesItemStatus(d.pop("status"))

        caution = d.pop("caution", UNSET)

        detail = d.pop("detail", UNSET)

        _point = d.pop("point", UNSET)
        point: CompactPostcodeBatchPostcodesItemPoint | Unset
        if isinstance(_point, Unset):
            point = UNSET
        else:
            point = CompactPostcodeBatchPostcodesItemPoint.from_dict(_point)

        _postcode = d.pop("postcode", UNSET)
        postcode: CompactPostcodeRecord | Unset
        if isinstance(_postcode, Unset):
            postcode = UNSET
        else:
            postcode = CompactPostcodeRecord.from_dict(_postcode)

        _results = d.pop("results", UNSET)
        results: list[CompactPointLookupResult] | Unset = UNSET
        if _results is not UNSET:
            results = []
            for results_item_data in _results:
                results_item = CompactPointLookupResult.from_dict(results_item_data)

                results.append(results_item)

        compact_postcode_batch_postcodes_item = cls(
            index=index,
            input_=input_,
            status=status,
            caution=caution,
            detail=detail,
            point=point,
            postcode=postcode,
            results=results,
        )

        compact_postcode_batch_postcodes_item.additional_properties = d
        return compact_postcode_batch_postcodes_item

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
