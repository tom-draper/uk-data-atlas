from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.geometry_source_corrections_item import GeometrySourceCorrectionsItem
    from ..models.geometry_source_transformation import GeometrySourceTransformation
    from ..models.geometry_validity_type_0 import GeometryValidityType0
    from ..models.geometry_validity_type_1 import GeometryValidityType1
    from ..models.geometry_validity_type_2 import GeometryValidityType2


T = TypeVar("T", bound="GeometrySource")


@_attrs_define
class GeometrySource:
    """Where the served WGS84 geometry came from. `transformation` is present only when the source was reprojected. Per-
    area compiled geometry carries `validity`; release-wide provenance and direct source reads omit it.

        Attributes:
            source_crs (str):
            corrections (list[GeometrySourceCorrectionsItem] | Unset): Declared grid corrections that moved this area before
                it was reprojected, such as `northern-ireland-offset`.
            input_ (str | Unset): Registered source file, preserved without validity repairs.
            input_hash (str | Unset): SHA-256 of the registered source file's original bytes.
            transformation (GeometrySourceTransformation | Unset):
            validity (GeometryValidityType0 | GeometryValidityType1 | GeometryValidityType2 | Unset): Deterministic build-
                time validation of the full served geometry, after declared corrections and reprojection. Checks Polygon and
                MultiPolygon topology in planar WGS84 XY using JSTS IsValidOp, including self-intersections, holes, ring
                degeneracy and relationships between MultiPolygon parts. Z is ignored. This is not a geodesic, antimeridian,
                cross-area coverage or general GeoJSON/OGC conformance certificate. At most the first issue found by the checker
                is returned. Source geometry is never repaired by validation. A valid result applies only to these checks. More
                than 10,000 positions, or 10,000 polygon/ring components, yields `not-checked` with `position-limit`;
                GeometryCollection and non-polygon types are `unsupported-geometry`. Older stores without reports are `not-
                compiled`. Validator failures are `validator-error`, never a valid result. No topology validation runs during
                requests.
    """

    source_crs: str
    corrections: list[GeometrySourceCorrectionsItem] | Unset = UNSET
    input_: str | Unset = UNSET
    input_hash: str | Unset = UNSET
    transformation: GeometrySourceTransformation | Unset = UNSET
    validity: (
        GeometryValidityType0 | GeometryValidityType1 | GeometryValidityType2 | Unset
    ) = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.geometry_validity_type_0 import GeometryValidityType0
        from ..models.geometry_validity_type_1 import GeometryValidityType1

        source_crs = self.source_crs

        corrections: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.corrections, Unset):
            corrections = []
            for corrections_item_data in self.corrections:
                corrections_item = corrections_item_data.to_dict()
                corrections.append(corrections_item)

        input_ = self.input_

        input_hash = self.input_hash

        transformation: dict[str, Any] | Unset = UNSET
        if not isinstance(self.transformation, Unset):
            transformation = self.transformation.to_dict()

        validity: dict[str, Any] | Unset
        if isinstance(self.validity, Unset):
            validity = UNSET
        elif isinstance(self.validity, GeometryValidityType0) or isinstance(
            self.validity, GeometryValidityType1
        ):
            validity = self.validity.to_dict()
        else:
            validity = self.validity.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "sourceCrs": source_crs,
            }
        )
        if corrections is not UNSET:
            field_dict["corrections"] = corrections
        if input_ is not UNSET:
            field_dict["input"] = input_
        if input_hash is not UNSET:
            field_dict["inputHash"] = input_hash
        if transformation is not UNSET:
            field_dict["transformation"] = transformation
        if validity is not UNSET:
            field_dict["validity"] = validity

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.geometry_source_corrections_item import (
            GeometrySourceCorrectionsItem,
        )
        from ..models.geometry_source_transformation import GeometrySourceTransformation
        from ..models.geometry_validity_type_0 import GeometryValidityType0
        from ..models.geometry_validity_type_1 import GeometryValidityType1
        from ..models.geometry_validity_type_2 import GeometryValidityType2

        d = dict(src_dict)
        source_crs = d.pop("sourceCrs")

        _corrections = d.pop("corrections", UNSET)
        corrections: list[GeometrySourceCorrectionsItem] | Unset = UNSET
        if _corrections is not UNSET:
            corrections = []
            for corrections_item_data in _corrections:
                corrections_item = GeometrySourceCorrectionsItem.from_dict(
                    corrections_item_data
                )

                corrections.append(corrections_item)

        input_ = d.pop("input", UNSET)

        input_hash = d.pop("inputHash", UNSET)

        _transformation = d.pop("transformation", UNSET)
        transformation: GeometrySourceTransformation | Unset
        if isinstance(_transformation, Unset):
            transformation = UNSET
        else:
            transformation = GeometrySourceTransformation.from_dict(_transformation)

        def _parse_validity(
            data: object,
        ) -> (
            GeometryValidityType0
            | GeometryValidityType1
            | GeometryValidityType2
            | Unset
        ):
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_geometry_validity_type_0 = (
                    GeometryValidityType0.from_dict(data)
                )

                return componentsschemas_geometry_validity_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_geometry_validity_type_1 = (
                    GeometryValidityType1.from_dict(data)
                )

                return componentsschemas_geometry_validity_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_geometry_validity_type_2 = (
                GeometryValidityType2.from_dict(data)
            )

            return componentsschemas_geometry_validity_type_2

        validity = _parse_validity(d.pop("validity", UNSET))

        geometry_source = cls(
            source_crs=source_crs,
            corrections=corrections,
            input_=input_,
            input_hash=input_hash,
            transformation=transformation,
            validity=validity,
        )

        geometry_source.additional_properties = d
        return geometry_source

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
