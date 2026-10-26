from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.compact_postcode_record_status import CompactPostcodeRecordStatus
from ..types import UNSET, Unset

T = TypeVar("T", bound="CompactPostcodeRecord")


@_attrs_define
class CompactPostcodeRecord:
    """
    Attributes:
        country (str):
        postcode (str):
        status (CompactPostcodeRecordStatus):
        terminated (str | Unset): YYYY-MM, when terminated.
    """

    country: str
    postcode: str
    status: CompactPostcodeRecordStatus
    terminated: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        country = self.country

        postcode = self.postcode

        status = self.status.value

        terminated = self.terminated

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "country": country,
                "postcode": postcode,
                "status": status,
            }
        )
        if terminated is not UNSET:
            field_dict["terminated"] = terminated

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        country = d.pop("country")

        postcode = d.pop("postcode")

        status = CompactPostcodeRecordStatus(d.pop("status"))

        terminated = d.pop("terminated", UNSET)

        compact_postcode_record = cls(
            country=country,
            postcode=postcode,
            status=status,
            terminated=terminated,
        )

        compact_postcode_record.additional_properties = d
        return compact_postcode_record

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
