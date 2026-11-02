from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ListMeasuresResponse200DataItemElsewhereItem")


@_attrs_define
class ListMeasuresResponse200DataItemElsewhereItem:
    """
    Attributes:
        comparable (bool):
        countries (list[str]):
        href (str):
        measure_id (str):
        reason (str):
    """

    comparable: bool
    countries: list[str]
    href: str
    measure_id: str
    reason: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        comparable = self.comparable

        countries = self.countries

        href = self.href

        measure_id = self.measure_id

        reason = self.reason

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "comparable": comparable,
                "countries": countries,
                "href": href,
                "measureId": measure_id,
                "reason": reason,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        comparable = d.pop("comparable")

        countries = cast(list[str], d.pop("countries"))

        href = d.pop("href")

        measure_id = d.pop("measureId")

        reason = d.pop("reason")

        list_measures_response_200_data_item_elsewhere_item = cls(
            comparable=comparable,
            countries=countries,
            href=href,
            measure_id=measure_id,
            reason=reason,
        )

        list_measures_response_200_data_item_elsewhere_item.additional_properties = d
        return list_measures_response_200_data_item_elsewhere_item

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
