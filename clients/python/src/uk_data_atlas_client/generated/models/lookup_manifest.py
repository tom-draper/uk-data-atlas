from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.lookup_manifest_schema_version import LookupManifestSchemaVersion
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.lookup_manifest_lookups_item import LookupManifestLookupsItem


T = TypeVar("T", bound="LookupManifest")


@_attrs_define
class LookupManifest:
    """
    Attributes:
        content_hash (str):
        lookups (list[LookupManifestLookupsItem]):
        schema_version (LookupManifestSchemaVersion):
        note (str | Unset):
    """

    content_hash: str
    lookups: list[LookupManifestLookupsItem]
    schema_version: LookupManifestSchemaVersion
    note: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        content_hash = self.content_hash

        lookups = []
        for lookups_item_data in self.lookups:
            lookups_item = lookups_item_data.to_dict()
            lookups.append(lookups_item)

        schema_version = self.schema_version.value

        note = self.note

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "contentHash": content_hash,
                "lookups": lookups,
                "schemaVersion": schema_version,
            }
        )
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.lookup_manifest_lookups_item import LookupManifestLookupsItem

        d = dict(src_dict)
        content_hash = d.pop("contentHash")

        lookups = []
        _lookups = d.pop("lookups")
        for lookups_item_data in _lookups:
            lookups_item = LookupManifestLookupsItem.from_dict(lookups_item_data)

            lookups.append(lookups_item)

        schema_version = LookupManifestSchemaVersion(d.pop("schemaVersion"))

        note = d.pop("note", UNSET)

        lookup_manifest = cls(
            content_hash=content_hash,
            lookups=lookups,
            schema_version=schema_version,
            note=note,
        )

        lookup_manifest.additional_properties = d
        return lookup_manifest

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
