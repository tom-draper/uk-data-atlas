from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.area_identity_coverage_type_0 import AreaIdentityCoverageType0
    from ..models.area_identity_coverage_type_1 import AreaIdentityCoverageType1
    from ..models.relationship_coverage_type_0 import RelationshipCoverageType0
    from ..models.relationship_coverage_type_1 import RelationshipCoverageType1


T = TypeVar("T", bound="GeographyReleaseInventory")


@_attrs_define
class GeographyReleaseInventory:
    """
    Attributes:
        area_identities (AreaIdentityCoverageType0 | AreaIdentityCoverageType1):
        countries (list[str]):
        geography (str):
        id (str):
        input_formats (list[str]):
        relationships (RelationshipCoverageType0 | RelationshipCoverageType1):
    """

    area_identities: AreaIdentityCoverageType0 | AreaIdentityCoverageType1
    countries: list[str]
    geography: str
    id: str
    input_formats: list[str]
    relationships: RelationshipCoverageType0 | RelationshipCoverageType1
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.area_identity_coverage_type_0 import AreaIdentityCoverageType0
        from ..models.relationship_coverage_type_0 import RelationshipCoverageType0

        area_identities: dict[str, Any]
        if isinstance(self.area_identities, AreaIdentityCoverageType0):
            area_identities = self.area_identities.to_dict()
        else:
            area_identities = self.area_identities.to_dict()

        countries = self.countries

        geography = self.geography

        id = self.id

        input_formats = self.input_formats

        relationships: dict[str, Any]
        if isinstance(self.relationships, RelationshipCoverageType0):
            relationships = self.relationships.to_dict()
        else:
            relationships = self.relationships.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "areaIdentities": area_identities,
                "countries": countries,
                "geography": geography,
                "id": id,
                "inputFormats": input_formats,
                "relationships": relationships,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.area_identity_coverage_type_0 import AreaIdentityCoverageType0
        from ..models.area_identity_coverage_type_1 import AreaIdentityCoverageType1
        from ..models.relationship_coverage_type_0 import RelationshipCoverageType0
        from ..models.relationship_coverage_type_1 import RelationshipCoverageType1

        d = dict(src_dict)

        def _parse_area_identities(
            data: object,
        ) -> AreaIdentityCoverageType0 | AreaIdentityCoverageType1:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_area_identity_coverage_type_0 = (
                    AreaIdentityCoverageType0.from_dict(data)
                )

                return componentsschemas_area_identity_coverage_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_area_identity_coverage_type_1 = (
                AreaIdentityCoverageType1.from_dict(data)
            )

            return componentsschemas_area_identity_coverage_type_1

        area_identities = _parse_area_identities(d.pop("areaIdentities"))

        countries = cast(list[str], d.pop("countries"))

        geography = d.pop("geography")

        id = d.pop("id")

        input_formats = cast(list[str], d.pop("inputFormats"))

        def _parse_relationships(
            data: object,
        ) -> RelationshipCoverageType0 | RelationshipCoverageType1:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_relationship_coverage_type_0 = (
                    RelationshipCoverageType0.from_dict(data)
                )

                return componentsschemas_relationship_coverage_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_relationship_coverage_type_1 = (
                RelationshipCoverageType1.from_dict(data)
            )

            return componentsschemas_relationship_coverage_type_1

        relationships = _parse_relationships(d.pop("relationships"))

        geography_release_inventory = cls(
            area_identities=area_identities,
            countries=countries,
            geography=geography,
            id=id,
            input_formats=input_formats,
            relationships=relationships,
        )

        geography_release_inventory.additional_properties = d
        return geography_release_inventory

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
