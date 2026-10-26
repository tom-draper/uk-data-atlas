from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.validate_area_values_posted_json_body_rows_item import (
        ValidateAreaValuesPostedJsonBodyRowsItem,
    )


T = TypeVar("T", bound="ValidateAreaValuesPostedJsonBody")


@_attrs_define
class ValidateAreaValuesPostedJsonBody:
    """
    Attributes:
        parents (list[str] | Unset):
        rows (list[ValidateAreaValuesPostedJsonBodyRowsItem] | Unset):
        values (list[str] | Unset):
    """

    parents: list[str] | Unset = UNSET
    rows: list[ValidateAreaValuesPostedJsonBodyRowsItem] | Unset = UNSET
    values: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        parents: list[str] | Unset = UNSET
        if not isinstance(self.parents, Unset):
            parents = self.parents

        rows: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.rows, Unset):
            rows = []
            for rows_item_data in self.rows:
                rows_item = rows_item_data.to_dict()
                rows.append(rows_item)

        values: list[str] | Unset = UNSET
        if not isinstance(self.values, Unset):
            values = self.values

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if parents is not UNSET:
            field_dict["parents"] = parents
        if rows is not UNSET:
            field_dict["rows"] = rows
        if values is not UNSET:
            field_dict["values"] = values

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.validate_area_values_posted_json_body_rows_item import (
            ValidateAreaValuesPostedJsonBodyRowsItem,
        )

        d = dict(src_dict)
        parents = cast(list[str], d.pop("parents", UNSET))

        _rows = d.pop("rows", UNSET)
        rows: list[ValidateAreaValuesPostedJsonBodyRowsItem] | Unset = UNSET
        if _rows is not UNSET:
            rows = []
            for rows_item_data in _rows:
                rows_item = ValidateAreaValuesPostedJsonBodyRowsItem.from_dict(
                    rows_item_data
                )

                rows.append(rows_item)

        values = cast(list[str], d.pop("values", UNSET))

        validate_area_values_posted_json_body = cls(
            parents=parents,
            rows=rows,
            values=values,
        )

        validate_area_values_posted_json_body.additional_properties = d
        return validate_area_values_posted_json_body

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
