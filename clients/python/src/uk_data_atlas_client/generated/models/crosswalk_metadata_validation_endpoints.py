from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.crosswalk_endpoint_validation_type_0 import (
        CrosswalkEndpointValidationType0,
    )
    from ..models.crosswalk_endpoint_validation_type_1 import (
        CrosswalkEndpointValidationType1,
    )


T = TypeVar("T", bound="CrosswalkMetadataValidationEndpoints")


@_attrs_define
class CrosswalkMetadataValidationEndpoints:
    """
    Attributes:
        from_ (CrosswalkEndpointValidationType0 | CrosswalkEndpointValidationType1):
        to (CrosswalkEndpointValidationType0 | CrosswalkEndpointValidationType1):
    """

    from_: CrosswalkEndpointValidationType0 | CrosswalkEndpointValidationType1
    to: CrosswalkEndpointValidationType0 | CrosswalkEndpointValidationType1
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.crosswalk_endpoint_validation_type_0 import (
            CrosswalkEndpointValidationType0,
        )

        from_: dict[str, Any]
        if isinstance(self.from_, CrosswalkEndpointValidationType0):
            from_ = self.from_.to_dict()
        else:
            from_ = self.from_.to_dict()

        to: dict[str, Any]
        if isinstance(self.to, CrosswalkEndpointValidationType0):
            to = self.to.to_dict()
        else:
            to = self.to.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "from": from_,
                "to": to,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.crosswalk_endpoint_validation_type_0 import (
            CrosswalkEndpointValidationType0,
        )
        from ..models.crosswalk_endpoint_validation_type_1 import (
            CrosswalkEndpointValidationType1,
        )

        d = dict(src_dict)

        def _parse_from_(
            data: object,
        ) -> CrosswalkEndpointValidationType0 | CrosswalkEndpointValidationType1:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_crosswalk_endpoint_validation_type_0 = (
                    CrosswalkEndpointValidationType0.from_dict(data)
                )

                return componentsschemas_crosswalk_endpoint_validation_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_crosswalk_endpoint_validation_type_1 = (
                CrosswalkEndpointValidationType1.from_dict(data)
            )

            return componentsschemas_crosswalk_endpoint_validation_type_1

        from_ = _parse_from_(d.pop("from"))

        def _parse_to(
            data: object,
        ) -> CrosswalkEndpointValidationType0 | CrosswalkEndpointValidationType1:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_crosswalk_endpoint_validation_type_0 = (
                    CrosswalkEndpointValidationType0.from_dict(data)
                )

                return componentsschemas_crosswalk_endpoint_validation_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_crosswalk_endpoint_validation_type_1 = (
                CrosswalkEndpointValidationType1.from_dict(data)
            )

            return componentsschemas_crosswalk_endpoint_validation_type_1

        to = _parse_to(d.pop("to"))

        crosswalk_metadata_validation_endpoints = cls(
            from_=from_,
            to=to,
        )

        crosswalk_metadata_validation_endpoints.additional_properties = d
        return crosswalk_metadata_validation_endpoints

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
