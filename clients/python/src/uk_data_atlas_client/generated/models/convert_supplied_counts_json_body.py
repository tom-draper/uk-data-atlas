from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.convert_supplied_counts_json_body_rows_item import (
        ConvertSuppliedCountsJsonBodyRowsItem,
    )


T = TypeVar("T", bound="ConvertSuppliedCountsJsonBody")


@_attrs_define
class ConvertSuppliedCountsJsonBody:
    """
    Attributes:
        rows (list[ConvertSuppliedCountsJsonBodyRowsItem]):
    """

    rows: list[ConvertSuppliedCountsJsonBodyRowsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        rows = []
        for rows_item_data in self.rows:
            rows_item = rows_item_data.to_dict()
            rows.append(rows_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "rows": rows,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.convert_supplied_counts_json_body_rows_item import (
            ConvertSuppliedCountsJsonBodyRowsItem,
        )

        d = dict(src_dict)
        rows = []
        _rows = d.pop("rows")
        for rows_item_data in _rows:
            rows_item = ConvertSuppliedCountsJsonBodyRowsItem.from_dict(rows_item_data)

            rows.append(rows_item)

        convert_supplied_counts_json_body = cls(
            rows=rows,
        )

        convert_supplied_counts_json_body.additional_properties = d
        return convert_supplied_counts_json_body

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
