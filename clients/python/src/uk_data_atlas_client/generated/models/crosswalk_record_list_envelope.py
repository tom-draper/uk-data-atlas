from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.envelope_api_version import EnvelopeApiVersion
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.area_overlap_record import AreaOverlapRecord
    from ..models.crosswalk_record import CrosswalkRecord
    from ..models.envelope_meta import EnvelopeMeta


T = TypeVar("T", bound="CrosswalkRecordListEnvelope")


@_attrs_define
class CrosswalkRecordListEnvelope:
    """
    Attributes:
        api_version (EnvelopeApiVersion):
        atlas_release (str): The immutable `/atlas-release` `releaseId` for the artifacts that produced this response.
        meta (EnvelopeMeta):
        data (list[AreaOverlapRecord | CrosswalkRecord] | Unset):
    """

    api_version: EnvelopeApiVersion
    atlas_release: str
    meta: EnvelopeMeta
    data: list[AreaOverlapRecord | CrosswalkRecord] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.crosswalk_record import CrosswalkRecord

        api_version = self.api_version.value

        atlas_release = self.atlas_release

        meta = self.meta.to_dict()

        data: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.data, Unset):
            data = []
            for data_item_data in self.data:
                data_item: dict[str, Any]
                if isinstance(data_item_data, CrosswalkRecord):
                    data_item = data_item_data.to_dict()
                else:
                    data_item = data_item_data.to_dict()

                data.append(data_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "apiVersion": api_version,
                "atlasRelease": atlas_release,
                "meta": meta,
            }
        )
        if data is not UNSET:
            field_dict["data"] = data

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area_overlap_record import AreaOverlapRecord
        from ..models.crosswalk_record import CrosswalkRecord
        from ..models.envelope_meta import EnvelopeMeta

        d = dict(src_dict)
        api_version = EnvelopeApiVersion(d.pop("apiVersion"))

        atlas_release = d.pop("atlasRelease")

        meta = EnvelopeMeta.from_dict(d.pop("meta"))

        _data = d.pop("data", UNSET)
        data: list[AreaOverlapRecord | CrosswalkRecord] | Unset = UNSET
        if _data is not UNSET:
            data = []
            for data_item_data in _data:

                def _parse_data_item(
                    data: object,
                ) -> AreaOverlapRecord | CrosswalkRecord:
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        data_item_type_0 = CrosswalkRecord.from_dict(data)

                        return data_item_type_0
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    if not isinstance(data, dict):
                        raise TypeError()
                    data_item_type_1 = AreaOverlapRecord.from_dict(data)

                    return data_item_type_1

                data_item = _parse_data_item(data_item_data)

                data.append(data_item)

        crosswalk_record_list_envelope = cls(
            api_version=api_version,
            atlas_release=atlas_release,
            meta=meta,
            data=data,
        )

        crosswalk_record_list_envelope.additional_properties = d
        return crosswalk_record_list_envelope

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
