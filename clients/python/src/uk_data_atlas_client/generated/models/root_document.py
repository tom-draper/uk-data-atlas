from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="RootDocument")


@_attrs_define
class RootDocument:
    """
    Attributes:
        links (list[str]):
        name (str):
        documentation (str | Unset): The human landing page rendered from it.
        openapi (str | Unset): This OpenAPI description, the binding contract.
    """

    links: list[str]
    name: str
    documentation: str | Unset = UNSET
    openapi: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        links = self.links

        name = self.name

        documentation = self.documentation

        openapi = self.openapi

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "links": links,
                "name": name,
            }
        )
        if documentation is not UNSET:
            field_dict["documentation"] = documentation
        if openapi is not UNSET:
            field_dict["openapi"] = openapi

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        links = cast(list[str], d.pop("links"))

        name = d.pop("name")

        documentation = d.pop("documentation", UNSET)

        openapi = d.pop("openapi", UNSET)

        root_document = cls(
            links=links,
            name=name,
            documentation=documentation,
            openapi=openapi,
        )

        root_document.additional_properties = d
        return root_document

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
