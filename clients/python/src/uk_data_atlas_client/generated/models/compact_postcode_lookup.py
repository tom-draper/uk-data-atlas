from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.compact_postcode_record_status import CompactPostcodeRecordStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.compact_point_lookup_result import CompactPointLookupResult
    from ..models.compact_postcode_lookup_point_type_1 import (
        CompactPostcodeLookupPointType1,
    )
    from ..models.compact_postcode_source import CompactPostcodeSource


T = TypeVar("T", bound="CompactPostcodeLookup")


@_attrs_define
class CompactPostcodeLookup:
    """A postcode lookup with `view=compact`.

    Attributes:
        country (str):
        postcode (str):
        status (CompactPostcodeRecordStatus):
        point (CompactPostcodeLookupPointType1 | None):
        results (list[CompactPointLookupResult]):
        source (CompactPostcodeSource):
        terminated (str | Unset): YYYY-MM, when terminated.
        caution (str | Unset):
        date (str | Unset):
        detail (str | Unset):
    """

    country: str
    postcode: str
    status: CompactPostcodeRecordStatus
    point: CompactPostcodeLookupPointType1 | None
    results: list[CompactPointLookupResult]
    source: CompactPostcodeSource
    terminated: str | Unset = UNSET
    caution: str | Unset = UNSET
    date: str | Unset = UNSET
    detail: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.compact_postcode_lookup_point_type_1 import (
            CompactPostcodeLookupPointType1,
        )

        country = self.country

        postcode = self.postcode

        status = self.status.value

        point: dict[str, Any] | None
        if isinstance(self.point, CompactPostcodeLookupPointType1):
            point = self.point.to_dict()
        else:
            point = self.point

        results = []
        for results_item_data in self.results:
            results_item = results_item_data.to_dict()
            results.append(results_item)

        source = self.source.to_dict()

        terminated = self.terminated

        caution = self.caution

        date = self.date

        detail = self.detail

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "country": country,
                "postcode": postcode,
                "status": status,
                "point": point,
                "results": results,
                "source": source,
            }
        )
        if terminated is not UNSET:
            field_dict["terminated"] = terminated
        if caution is not UNSET:
            field_dict["caution"] = caution
        if date is not UNSET:
            field_dict["date"] = date
        if detail is not UNSET:
            field_dict["detail"] = detail

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.compact_point_lookup_result import CompactPointLookupResult
        from ..models.compact_postcode_lookup_point_type_1 import (
            CompactPostcodeLookupPointType1,
        )
        from ..models.compact_postcode_source import CompactPostcodeSource

        d = dict(src_dict)
        country = d.pop("country")

        postcode = d.pop("postcode")

        status = CompactPostcodeRecordStatus(d.pop("status"))

        def _parse_point(data: object) -> CompactPostcodeLookupPointType1 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                point_type_1 = CompactPostcodeLookupPointType1.from_dict(data)

                return point_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CompactPostcodeLookupPointType1 | None, data)

        point = _parse_point(d.pop("point"))

        results = []
        _results = d.pop("results")
        for results_item_data in _results:
            results_item = CompactPointLookupResult.from_dict(results_item_data)

            results.append(results_item)

        source = CompactPostcodeSource.from_dict(d.pop("source"))

        terminated = d.pop("terminated", UNSET)

        caution = d.pop("caution", UNSET)

        date = d.pop("date", UNSET)

        detail = d.pop("detail", UNSET)

        compact_postcode_lookup = cls(
            country=country,
            postcode=postcode,
            status=status,
            point=point,
            results=results,
            source=source,
            terminated=terminated,
            caution=caution,
            date=date,
            detail=detail,
        )

        compact_postcode_lookup.additional_properties = d
        return compact_postcode_lookup

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
