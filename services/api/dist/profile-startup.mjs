import { createRequire as runtimeRequire } from "node:module";
const require = runtimeRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) =>
	function __require() {
		try {
			return (
				mod ||
					(0, cb[__getOwnPropNames(cb)[0]])(
						(mod = { exports: {} }).exports,
						mod,
					),
				mod.exports
			);
		} catch (e) {
			throw ((mod = 0), e);
		}
	};
var __copyProps = (to, from, except, desc) => {
	if ((from && typeof from === "object") || typeof from === "function") {
		for (let key of __getOwnPropNames(from))
			if (!__hasOwnProp.call(to, key) && key !== except)
				__defProp(to, key, {
					get: () => from[key],
					enumerable:
						!(desc = __getOwnPropDesc(from, key)) ||
						desc.enumerable,
				});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (
	(target = mod != null ? __create(__getProtoOf(mod)) : {}),
	__copyProps(
		// If the importer is in node compatibility mode or this is not an ESM
		// file that has been converted to a CommonJS file using a Babel-
		// compatible transform (i.e. "__esModule" has not been set), then set
		// "default" to the CommonJS "module.exports" for node compatibility.
		isNodeMode || !mod || !mod.__esModule
			? __defProp(target, "default", { value: mod, enumerable: true })
			: target,
		mod,
	)
);

// ../../node_modules/.pnpm/proj4@2.22.0/node_modules/proj4/dist/proj4-src.js
var require_proj4_src = __commonJS({
	"../../node_modules/.pnpm/proj4@2.22.0/node_modules/proj4/dist/proj4-src.js"(
		exports,
		module,
	) {
		(function (global, factory) {
			typeof exports === "object" && typeof module !== "undefined"
				? (module.exports = factory())
				: typeof define === "function" && define.amd
					? define(factory)
					: ((global =
							typeof globalThis !== "undefined"
								? globalThis
								: global || self),
						(global.proj4 = factory()));
		})(exports, function () {
			"use strict";
			function globals(defs2) {
				defs2(
					"EPSG:4326",
					"+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees",
				);
				defs2(
					"EPSG:4269",
					"+title=NAD83 (long/lat) +proj=longlat +a=6378137.0 +b=6356752.31414036 +ellps=GRS80 +datum=NAD83 +units=degrees",
				);
				defs2(
					"EPSG:3857",
					"+title=WGS 84 / Pseudo-Mercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs",
				);
				for (var i = 1; i <= 60; ++i) {
					defs2(
						"EPSG:" + (32600 + i),
						"+proj=utm +zone=" + i + " +datum=WGS84 +units=m",
					);
					defs2(
						"EPSG:" + (32700 + i),
						"+proj=utm +zone=" +
							i +
							" +south +datum=WGS84 +units=m",
					);
				}
				defs2(
					"EPSG:5041",
					"+title=WGS 84 / UPS North (E,N) +proj=stere +lat_0=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m",
				);
				defs2(
					"EPSG:5042",
					"+title=WGS 84 / UPS South (E,N) +proj=stere +lat_0=-90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m",
				);
				defs2.WGS84 = defs2["EPSG:4326"];
				defs2["EPSG:3785"] = defs2["EPSG:3857"];
				defs2.GOOGLE = defs2["EPSG:3857"];
				defs2["EPSG:900913"] = defs2["EPSG:3857"];
				defs2["EPSG:102113"] = defs2["EPSG:3857"];
			}
			var PJD_3PARAM = 1;
			var PJD_7PARAM = 2;
			var PJD_GRIDSHIFT = 3;
			var PJD_WGS84 = 4;
			var PJD_NODATUM = 5;
			var SRS_WGS84_SEMIMAJOR = 6378137;
			var SRS_WGS84_SEMIMINOR = 6356752314e-3;
			var SRS_WGS84_ESQUARED = 0.0066943799901413165;
			var SEC_TO_RAD = 484813681109536e-20;
			var HALF_PI = Math.PI / 2;
			var SIXTH = 0.16666666666666666;
			var RA4 = 0.04722222222222222;
			var RA6 = 0.022156084656084655;
			var EPSLN = 1e-10;
			var D2R$1 = 0.017453292519943295;
			var R2D = 57.29577951308232;
			var FORTPI = Math.PI / 4;
			var TWO_PI = Math.PI * 2;
			var SPI = 3.14159265359;
			var primeMeridian = {};
			primeMeridian.greenwich = 0;
			primeMeridian.lisbon = -9.131906111111;
			primeMeridian.paris = 2.337229166667;
			primeMeridian.bogota = -74.080916666667;
			primeMeridian.madrid = -3.687938888889;
			primeMeridian.rome = 12.452333333333;
			primeMeridian.bern = 7.439583333333;
			primeMeridian.jakarta = 106.807719444444;
			primeMeridian.ferro = -17.666666666667;
			primeMeridian.brussels = 4.367975;
			primeMeridian.stockholm = 18.058277777778;
			primeMeridian.athens = 23.7163375;
			primeMeridian.oslo = 10.722916666667;
			var units = {
				mm: { to_meter: 1e-3 },
				cm: { to_meter: 0.01 },
				ft: { to_meter: 0.3048 },
				"us-ft": { to_meter: 1200 / 3937 },
				fath: { to_meter: 1.8288 },
				kmi: { to_meter: 1852 },
				"us-ch": { to_meter: 20.1168402336805 },
				"us-mi": { to_meter: 1609.34721869444 },
				km: { to_meter: 1e3 },
				"ind-ft": { to_meter: 0.30479841 },
				"ind-yd": { to_meter: 0.91439523 },
				mi: { to_meter: 1609.344 },
				yd: { to_meter: 0.9144 },
				ch: { to_meter: 20.1168 },
				link: { to_meter: 0.201168 },
				dm: { to_meter: 0.1 },
				in: { to_meter: 0.0254 },
				"ind-ch": { to_meter: 20.11669506 },
				"us-in": { to_meter: 0.025400050800101 },
				"us-yd": { to_meter: 0.914401828803658 },
			};
			var ignoredChar = /[\s_\-\/\(\)]/g;
			function match(obj, key2) {
				if (obj[key2]) {
					return obj[key2];
				}
				var keys = Object.keys(obj);
				var lkey = key2.toLowerCase().replace(ignoredChar, "");
				var i = -1;
				var testkey, processedKey;
				while (++i < keys.length) {
					testkey = keys[i];
					processedKey = testkey
						.toLowerCase()
						.replace(ignoredChar, "");
					if (processedKey === lkey) {
						return obj[testkey];
					}
				}
			}
			function projStr(defData) {
				var self2 = {};
				var paramObj = defData
					.split("+")
					.map(function (v) {
						return v.trim();
					})
					.filter(function (a) {
						return a;
					})
					.reduce(function (p, a) {
						var split = a.split("=");
						split.push(true);
						p[split[0].toLowerCase()] = split[1];
						return p;
					}, {});
				var paramName, paramVal, paramOutname;
				var params2 = {
					proj: function (v) {
						self2.projName = [
							"lonlat",
							"latlon",
							"latlong",
						].includes(v)
							? "longlat"
							: v;
					},
					datum: "datumCode",
					rf: function (v) {
						self2.rf = parseFloat(v);
					},
					lat_0: function (v) {
						self2.lat0 = v * D2R$1;
					},
					lat_1: function (v) {
						self2.lat1 = v * D2R$1;
					},
					lat_2: function (v) {
						self2.lat2 = v * D2R$1;
					},
					lat_ts: function (v) {
						self2.lat_ts = v * D2R$1;
					},
					lon_0: function (v) {
						self2.long0 = v * D2R$1;
					},
					lon_wrap: function (v) {
						self2.long_wrap = parseFloat(v) * D2R$1;
					},
					lon_1: function (v) {
						self2.long1 = v * D2R$1;
					},
					lon_2: function (v) {
						self2.long2 = v * D2R$1;
					},
					alpha: function (v) {
						self2.alpha = parseFloat(v) * D2R$1;
					},
					gamma: function (v) {
						self2.rectified_grid_angle = parseFloat(v) * D2R$1;
					},
					lonc: function (v) {
						self2.longc = v * D2R$1;
					},
					x_0: function (v) {
						self2.x0 = parseFloat(v);
					},
					y_0: function (v) {
						self2.y0 = parseFloat(v);
					},
					k_0: function (v) {
						self2.k0 = parseFloat(v);
					},
					k: function (v) {
						self2.k0 = parseFloat(v);
					},
					a: function (v) {
						self2.a = parseFloat(v);
					},
					b: function (v) {
						self2.b = parseFloat(v);
					},
					r: function (v) {
						self2.a = self2.b = parseFloat(v);
					},
					r_a: function () {
						self2.R_A = true;
					},
					zone: function (v) {
						self2.zone = parseInt(v, 10);
					},
					south: function () {
						self2.utmSouth = true;
					},
					towgs84: function (v) {
						self2.datum_params = v.split(",").map(function (a) {
							return parseFloat(a);
						});
					},
					to_meter: function (v) {
						self2.to_meter = parseFloat(v);
					},
					units: function (v) {
						self2.units = v;
						var unit = match(units, v);
						if (unit) {
							self2.to_meter = unit.to_meter;
						}
					},
					from_greenwich: function (v) {
						self2.from_greenwich = v * D2R$1;
					},
					pm: function (v) {
						var pm = match(primeMeridian, v);
						self2.from_greenwich =
							(pm ? pm : parseFloat(v)) * D2R$1;
					},
					nadgrids: function (v) {
						if (v === "@null") {
							self2.datumCode = "none";
						} else {
							self2.nadgrids = v;
						}
					},
					axis: function (v) {
						var legalAxis = "ewnsud";
						if (
							v.length === 3 &&
							legalAxis.indexOf(v.substr(0, 1)) !== -1 &&
							legalAxis.indexOf(v.substr(1, 1)) !== -1 &&
							legalAxis.indexOf(v.substr(2, 1)) !== -1
						) {
							self2.axis = v;
						}
					},
					approx: function () {
						self2.approx = true;
					},
					over: function () {
						self2.over = true;
					},
				};
				for (paramName in paramObj) {
					paramVal = paramObj[paramName];
					if (paramName in params2) {
						paramOutname = params2[paramName];
						if (typeof paramOutname === "function") {
							paramOutname(paramVal);
						} else {
							self2[paramOutname] = paramVal;
						}
					} else {
						self2[paramName] = paramVal;
					}
				}
				if (
					typeof self2.datumCode === "string" &&
					self2.datumCode !== "WGS84"
				) {
					self2.datumCode = self2.datumCode.toLowerCase();
				}
				self2["projStr"] = defData;
				return self2;
			}
			class PROJJSONBuilderBase {
				static getId(node) {
					const idNode = node.find(
						(child) => Array.isArray(child) && child[0] === "ID",
					);
					if (idNode && idNode.length >= 3) {
						return {
							authority: idNode[1],
							code: parseInt(idNode[2], 10),
						};
					}
					return null;
				}
				static convertUnit(node, type = "unit") {
					if (!node || node.length < 3) {
						return {
							type,
							name: "unknown",
							conversion_factor: null,
						};
					}
					const name = node[1];
					const conversionFactor = parseFloat(node[2]) || null;
					const idNode = node.find(
						(child) => Array.isArray(child) && child[0] === "ID",
					);
					const id = idNode
						? {
								authority: idNode[1],
								code: parseInt(idNode[2], 10),
							}
						: null;
					return {
						type,
						name,
						conversion_factor: conversionFactor,
						id,
					};
				}
				static convertAxis(node) {
					const name = node[1] || "Unknown";
					let direction;
					const abbreviationMatch = name.match(/^\((.)\)$/);
					if (abbreviationMatch) {
						const abbreviation = abbreviationMatch[1].toUpperCase();
						if (abbreviation === "E") direction = "east";
						else if (abbreviation === "N") direction = "north";
						else if (abbreviation === "U") direction = "up";
						else if (node[2]) direction = node[2];
						else
							throw new Error(
								`Unknown axis abbreviation: ${abbreviation}`,
							);
					} else {
						direction = node[2] || "unknown";
					}
					const orderNode = node.find(
						(child) => Array.isArray(child) && child[0] === "ORDER",
					);
					const order2 = orderNode
						? parseInt(orderNode[1], 10)
						: null;
					const unitNode = node.find(
						(child) =>
							Array.isArray(child) &&
							(child[0] === "LENGTHUNIT" ||
								child[0] === "ANGLEUNIT" ||
								child[0] === "SCALEUNIT"),
					);
					const unit = this.convertUnit(unitNode);
					return {
						name,
						direction,
						// Use the valid PROJJSON direction value
						unit,
						order: order2,
					};
				}
				static extractAxes(node) {
					return node
						.filter(
							(child) =>
								Array.isArray(child) && child[0] === "AXIS",
						)
						.map((axis) => this.convertAxis(axis))
						.sort((a, b) => (a.order || 0) - (b.order || 0));
				}
				static convert(node, result = {}) {
					switch (node[0]) {
						case "PROJCRS":
							result.type = "ProjectedCRS";
							result.name = node[1];
							result.base_crs = node.find(
								(child) =>
									Array.isArray(child) &&
									child[0] === "BASEGEOGCRS",
							)
								? this.convert(
										node.find(
											(child) =>
												Array.isArray(child) &&
												child[0] === "BASEGEOGCRS",
										),
									)
								: null;
							result.conversion = node.find(
								(child) =>
									Array.isArray(child) &&
									child[0] === "CONVERSION",
							)
								? this.convert(
										node.find(
											(child) =>
												Array.isArray(child) &&
												child[0] === "CONVERSION",
										),
									)
								: null;
							const csNode = node.find(
								(child) =>
									Array.isArray(child) && child[0] === "CS",
							);
							if (csNode) {
								result.coordinate_system = {
									type: csNode[1],
									axis: this.extractAxes(node),
								};
							}
							const lengthUnitNode = node.find(
								(child) =>
									Array.isArray(child) &&
									child[0] === "LENGTHUNIT",
							);
							if (lengthUnitNode) {
								const unit2 = this.convertUnit(lengthUnitNode);
								result.coordinate_system.unit = unit2;
							}
							result.id = this.getId(node);
							break;
						case "BASEGEOGCRS":
						case "GEOGCRS":
						case "GEODCRS":
							result.type =
								node[0] === "GEODCRS"
									? "GeodeticCRS"
									: "GeographicCRS";
							result.name = node[1];
							const datumOrEnsembleNode = node.find(
								(child) =>
									Array.isArray(child) &&
									(child[0] === "DATUM" ||
										child[0] === "ENSEMBLE"),
							);
							if (datumOrEnsembleNode) {
								const datumOrEnsemble =
									this.convert(datumOrEnsembleNode);
								if (datumOrEnsembleNode[0] === "ENSEMBLE") {
									result.datum_ensemble = datumOrEnsemble;
								} else {
									result.datum = datumOrEnsemble;
								}
								const primem = node.find(
									(child) =>
										Array.isArray(child) &&
										child[0] === "PRIMEM",
								);
								if (primem && primem[1] !== "Greenwich") {
									datumOrEnsemble.prime_meridian = {
										name: primem[1],
										longitude: parseFloat(primem[2]),
									};
								}
							}
							result.coordinate_system = {
								type: "ellipsoidal",
								axis: this.extractAxes(node),
							};
							result.id = this.getId(node);
							break;
						case "DATUM":
							result.type = "GeodeticReferenceFrame";
							result.name = node[1];
							result.ellipsoid = node.find(
								(child) =>
									Array.isArray(child) &&
									child[0] === "ELLIPSOID",
							)
								? this.convert(
										node.find(
											(child) =>
												Array.isArray(child) &&
												child[0] === "ELLIPSOID",
										),
									)
								: null;
							break;
						case "ENSEMBLE":
							result.type = "DatumEnsemble";
							result.name = node[1];
							result.members = node
								.filter(
									(child) =>
										Array.isArray(child) &&
										child[0] === "MEMBER",
								)
								.map((member) => ({
									type: "DatumEnsembleMember",
									name: member[1],
									id: this.getId(member),
									// Extract ID as { authority, code }
								}));
							const accuracyNode = node.find(
								(child) =>
									Array.isArray(child) &&
									child[0] === "ENSEMBLEACCURACY",
							);
							if (accuracyNode) {
								result.accuracy = parseFloat(accuracyNode[1]);
							}
							const ellipsoidNode = node.find(
								(child) =>
									Array.isArray(child) &&
									child[0] === "ELLIPSOID",
							);
							if (ellipsoidNode) {
								result.ellipsoid = this.convert(ellipsoidNode);
							}
							result.id = this.getId(node);
							break;
						case "ELLIPSOID":
							result.type = "Ellipsoid";
							result.name = node[1];
							result.semi_major_axis = parseFloat(node[2]);
							result.inverse_flattening = parseFloat(node[3]);
							node.find(
								(child) =>
									Array.isArray(child) &&
									child[0] === "LENGTHUNIT",
							)
								? this.convert(
										node.find(
											(child) =>
												Array.isArray(child) &&
												child[0] === "LENGTHUNIT",
										),
										result,
									)
								: null;
							break;
						case "CONVERSION":
							result.type = "Conversion";
							result.name = node[1];
							result.method = node.find(
								(child) =>
									Array.isArray(child) &&
									child[0] === "METHOD",
							)
								? this.convert(
										node.find(
											(child) =>
												Array.isArray(child) &&
												child[0] === "METHOD",
										),
									)
								: null;
							result.parameters = node
								.filter(
									(child) =>
										Array.isArray(child) &&
										child[0] === "PARAMETER",
								)
								.map((param) => this.convert(param));
							break;
						case "METHOD":
							result.type = "Method";
							result.name = node[1];
							result.id = this.getId(node);
							break;
						case "PARAMETER":
							result.type = "Parameter";
							result.name = node[1];
							result.value = parseFloat(node[2]);
							result.unit = this.convertUnit(
								node.find(
									(child) =>
										Array.isArray(child) &&
										(child[0] === "LENGTHUNIT" ||
											child[0] === "ANGLEUNIT" ||
											child[0] === "SCALEUNIT"),
								),
							);
							result.id = this.getId(node);
							break;
						case "BOUNDCRS":
							result.type = "BoundCRS";
							const sourceCrsNode = node.find(
								(child) =>
									Array.isArray(child) &&
									child[0] === "SOURCECRS",
							);
							if (sourceCrsNode) {
								const sourceCrsContent = sourceCrsNode.find(
									(child) => Array.isArray(child),
								);
								result.source_crs = sourceCrsContent
									? this.convert(sourceCrsContent)
									: null;
							}
							const targetCrsNode = node.find(
								(child) =>
									Array.isArray(child) &&
									child[0] === "TARGETCRS",
							);
							if (targetCrsNode) {
								const targetCrsContent = targetCrsNode.find(
									(child) => Array.isArray(child),
								);
								result.target_crs = targetCrsContent
									? this.convert(targetCrsContent)
									: null;
							}
							const transformationNode = node.find(
								(child) =>
									Array.isArray(child) &&
									child[0] === "ABRIDGEDTRANSFORMATION",
							);
							if (transformationNode) {
								result.transformation =
									this.convert(transformationNode);
							} else {
								result.transformation = null;
							}
							break;
						case "ABRIDGEDTRANSFORMATION":
							result.type = "Transformation";
							result.name = node[1];
							result.method = node.find(
								(child) =>
									Array.isArray(child) &&
									child[0] === "METHOD",
							)
								? this.convert(
										node.find(
											(child) =>
												Array.isArray(child) &&
												child[0] === "METHOD",
										),
									)
								: null;
							result.parameters = node
								.filter(
									(child) =>
										Array.isArray(child) &&
										(child[0] === "PARAMETER" ||
											child[0] === "PARAMETERFILE"),
								)
								.map((param) => {
									if (param[0] === "PARAMETER") {
										return this.convert(param);
									} else if (param[0] === "PARAMETERFILE") {
										return {
											name: param[1],
											value: param[2],
											id: {
												authority: "EPSG",
												code: 8656,
											},
										};
									}
								});
							if (result.parameters.length === 7) {
								const scaleDifference = result.parameters[6];
								if (
									scaleDifference.name === "Scale difference"
								) {
									scaleDifference.value =
										Math.round(
											(scaleDifference.value - 1) * 1e12,
										) / 1e6;
								}
							}
							result.id = this.getId(node);
							break;
						case "AXIS":
							if (!result.coordinate_system) {
								result.coordinate_system = {
									type: "unspecified",
									axis: [],
								};
							}
							result.coordinate_system.axis.push(
								this.convertAxis(node),
							);
							break;
						case "LENGTHUNIT":
							const unit = this.convertUnit(node, "LinearUnit");
							if (
								result.coordinate_system &&
								result.coordinate_system.axis
							) {
								result.coordinate_system.axis.forEach(
									(axis) => {
										if (!axis.unit) {
											axis.unit = unit;
										}
									},
								);
							}
							if (
								unit.conversion_factor &&
								unit.conversion_factor !== 1
							) {
								if (result.semi_major_axis) {
									result.semi_major_axis = {
										value: result.semi_major_axis,
										unit,
									};
								}
							}
							break;
						default:
							result.keyword = node[0];
							break;
					}
					return result;
				}
			}
			class PROJJSONBuilder2015 extends PROJJSONBuilderBase {
				static convert(node, result = {}) {
					super.convert(node, result);
					if (
						result.coordinate_system &&
						result.coordinate_system.subtype === "Cartesian"
					) {
						delete result.coordinate_system;
					}
					if (result.usage) {
						delete result.usage;
					}
					return result;
				}
			}
			class PROJJSONBuilder2019 extends PROJJSONBuilderBase {
				static convert(node, result = {}) {
					super.convert(node, result);
					const csNode = node.find(
						(child) => Array.isArray(child) && child[0] === "CS",
					);
					if (csNode) {
						result.coordinate_system = {
							subtype: csNode[1],
							axis: this.extractAxes(node),
						};
					}
					const usageNode = node.find(
						(child) => Array.isArray(child) && child[0] === "USAGE",
					);
					if (usageNode) {
						const scope = usageNode.find(
							(child) =>
								Array.isArray(child) && child[0] === "SCOPE",
						);
						const area = usageNode.find(
							(child) =>
								Array.isArray(child) && child[0] === "AREA",
						);
						const bbox = usageNode.find(
							(child) =>
								Array.isArray(child) && child[0] === "BBOX",
						);
						result.usage = {};
						if (scope) {
							result.usage.scope = scope[1];
						}
						if (area) {
							result.usage.area = area[1];
						}
						if (bbox) {
							result.usage.bbox = bbox.slice(1);
						}
					}
					return result;
				}
			}
			function detectWKT2Version(root) {
				if (
					root.find(
						(child) => Array.isArray(child) && child[0] === "USAGE",
					)
				) {
					return "2019";
				}
				if (
					root.find(
						(child) => Array.isArray(child) && child[0] === "CS",
					)
				) {
					return "2015";
				}
				if (
					root[0] === "BOUNDCRS" ||
					root[0] === "PROJCRS" ||
					root[0] === "GEOGCRS"
				) {
					return "2015";
				}
				return "2015";
			}
			function buildPROJJSON(root) {
				const version = detectWKT2Version(root);
				const builder =
					version === "2019"
						? PROJJSONBuilder2019
						: PROJJSONBuilder2015;
				return builder.convert(root);
			}
			function detectWKTVersion(wkt2) {
				const normalizedWKT = wkt2.toUpperCase();
				if (
					normalizedWKT.includes("PROJCRS") ||
					normalizedWKT.includes("GEOGCRS") ||
					normalizedWKT.includes("BOUNDCRS") ||
					normalizedWKT.includes("VERTCRS") ||
					normalizedWKT.includes("LENGTHUNIT") ||
					normalizedWKT.includes("ANGLEUNIT") ||
					normalizedWKT.includes("SCALEUNIT")
				) {
					return "WKT2";
				}
				if (
					normalizedWKT.includes("PROJCS") ||
					normalizedWKT.includes("GEOGCS") ||
					normalizedWKT.includes("LOCAL_CS") ||
					normalizedWKT.includes("VERT_CS") ||
					normalizedWKT.includes("UNIT")
				) {
					return "WKT1";
				}
				return "WKT1";
			}
			var NEUTRAL = 1;
			var KEYWORD = 2;
			var NUMBER = 3;
			var QUOTED = 4;
			var AFTERQUOTE = 5;
			var ENDED = -1;
			var whitespace = /\s/;
			var latin = /[A-Za-z]/;
			var keyword = /[A-Za-z84_]/;
			var endThings = /[,\]]/;
			var digets = /[\d\.E\-\+]/;
			function Parser(text) {
				if (typeof text !== "string") {
					throw new Error("not a string");
				}
				this.text = text.trim();
				this.level = 0;
				this.place = 0;
				this.root = null;
				this.stack = [];
				this.currentObject = null;
				this.state = NEUTRAL;
			}
			Parser.prototype.readCharicter = function () {
				var char = this.text[this.place++];
				if (this.state !== QUOTED) {
					while (whitespace.test(char)) {
						if (this.place >= this.text.length) {
							return;
						}
						char = this.text[this.place++];
					}
				}
				switch (this.state) {
					case NEUTRAL:
						return this.neutral(char);
					case KEYWORD:
						return this.keyword(char);
					case QUOTED:
						return this.quoted(char);
					case AFTERQUOTE:
						return this.afterquote(char);
					case NUMBER:
						return this.number(char);
					case ENDED:
						return;
				}
			};
			Parser.prototype.afterquote = function (char) {
				if (char === '"') {
					this.word += '"';
					this.state = QUOTED;
					return;
				}
				if (endThings.test(char)) {
					this.word = this.word.trim();
					this.afterItem(char);
					return;
				}
				throw new Error(
					`havn't handled "` +
						char +
						'" in afterquote yet, index ' +
						this.place,
				);
			};
			Parser.prototype.afterItem = function (char) {
				if (char === ",") {
					if (this.word !== null) {
						this.currentObject.push(this.word);
					}
					this.word = null;
					this.state = NEUTRAL;
					return;
				}
				if (char === "]") {
					this.level--;
					if (this.word !== null) {
						this.currentObject.push(this.word);
						this.word = null;
					}
					this.state = NEUTRAL;
					this.currentObject = this.stack.pop();
					if (!this.currentObject) {
						this.state = ENDED;
					}
					return;
				}
			};
			Parser.prototype.number = function (char) {
				if (digets.test(char)) {
					this.word += char;
					return;
				}
				if (endThings.test(char)) {
					this.word = parseFloat(this.word);
					this.afterItem(char);
					return;
				}
				throw new Error(
					`havn't handled "` +
						char +
						'" in number yet, index ' +
						this.place,
				);
			};
			Parser.prototype.quoted = function (char) {
				if (char === '"') {
					this.state = AFTERQUOTE;
					return;
				}
				this.word += char;
				return;
			};
			Parser.prototype.keyword = function (char) {
				if (keyword.test(char)) {
					this.word += char;
					return;
				}
				if (char === "[") {
					var newObjects = [];
					newObjects.push(this.word);
					this.level++;
					if (this.root === null) {
						this.root = newObjects;
					} else {
						this.currentObject.push(newObjects);
					}
					this.stack.push(this.currentObject);
					this.currentObject = newObjects;
					this.state = NEUTRAL;
					return;
				}
				if (endThings.test(char)) {
					this.afterItem(char);
					return;
				}
				throw new Error(
					`havn't handled "` +
						char +
						'" in keyword yet, index ' +
						this.place,
				);
			};
			Parser.prototype.neutral = function (char) {
				if (latin.test(char)) {
					this.word = char;
					this.state = KEYWORD;
					return;
				}
				if (char === '"') {
					this.word = "";
					this.state = QUOTED;
					return;
				}
				if (digets.test(char)) {
					this.word = char;
					this.state = NUMBER;
					return;
				}
				if (endThings.test(char)) {
					this.afterItem(char);
					return;
				}
				throw new Error(
					`havn't handled "` +
						char +
						'" in neutral yet, index ' +
						this.place,
				);
			};
			Parser.prototype.output = function () {
				while (this.place < this.text.length) {
					this.readCharicter();
				}
				if (this.state === ENDED) {
					return this.root;
				}
				throw new Error(
					'unable to parse string "' +
						this.text +
						'". State is ' +
						this.state,
				);
			};
			function parseString(txt) {
				var parser = new Parser(txt);
				return parser.output();
			}
			function mapit(obj, key2, value) {
				if (Array.isArray(key2)) {
					value.unshift(key2);
					key2 = null;
				}
				var thing = key2 ? {} : obj;
				var out = value.reduce(function (newObj, item) {
					sExpr(item, newObj);
					return newObj;
				}, thing);
				if (key2) {
					obj[key2] = out;
				}
			}
			function sExpr(v, obj) {
				if (!Array.isArray(v)) {
					obj[v] = true;
					return;
				}
				var key2 = v.shift();
				if (key2 === "PARAMETER") {
					key2 = v.shift();
				}
				if (v.length === 1) {
					if (Array.isArray(v[0])) {
						obj[key2] = {};
						sExpr(v[0], obj[key2]);
						return;
					}
					obj[key2] = v[0];
					return;
				}
				if (!v.length) {
					obj[key2] = true;
					return;
				}
				if (key2 === "TOWGS84") {
					obj[key2] = v;
					return;
				}
				if (key2 === "AXIS") {
					if (!(key2 in obj)) {
						obj[key2] = [];
					}
					obj[key2].push(v);
					return;
				}
				if (!Array.isArray(key2)) {
					obj[key2] = {};
				}
				var i;
				switch (key2) {
					case "UNIT":
					case "PRIMEM":
					case "VERT_DATUM":
						obj[key2] = {
							name: v[0].toLowerCase(),
							convert: v[1],
						};
						if (v.length === 3) {
							sExpr(v[2], obj[key2]);
						}
						return;
					case "SPHEROID":
					case "ELLIPSOID":
						obj[key2] = {
							name: v[0],
							a: v[1],
							rf: v[2],
						};
						if (v.length === 4) {
							sExpr(v[3], obj[key2]);
						}
						return;
					case "EDATUM":
					case "ENGINEERINGDATUM":
					case "LOCAL_DATUM":
					case "DATUM":
					case "VERT_CS":
					case "VERTCRS":
					case "VERTICALCRS":
						v[0] = ["name", v[0]];
						mapit(obj, key2, v);
						return;
					case "COMPD_CS":
					case "COMPOUNDCRS":
					case "FITTED_CS":
					// the followings are the crs defined in
					// https://github.com/proj4js/proj4js/blob/1da4ed0b865d0fcb51c136090569210cdcc9019e/lib/parseCode.js#L11
					case "PROJECTEDCRS":
					case "PROJCRS":
					case "GEOGCS":
					case "GEOCCS":
					case "PROJCS":
					case "LOCAL_CS":
					case "GEODCRS":
					case "GEODETICCRS":
					case "GEODETICDATUM":
					case "ENGCRS":
					case "ENGINEERINGCRS":
						v[0] = ["name", v[0]];
						mapit(obj, key2, v);
						obj[key2].type = key2;
						return;
					default:
						i = -1;
						while (++i < v.length) {
							if (!Array.isArray(v[i])) {
								return sExpr(v, obj[key2]);
							}
						}
						return mapit(obj, key2, v);
				}
			}
			var D2R = 0.017453292519943295;
			function d2r(input) {
				return input * D2R;
			}
			function applyProjectionDefaults(wkt2) {
				const normalizedProjName = (wkt2.projName || "")
					.toLowerCase()
					.replace(/_/g, " ");
				if (wkt2.long0 === void 0 && wkt2.longc !== void 0) {
					wkt2.long0 = wkt2.longc;
				}
				if (
					!wkt2.lat_ts &&
					wkt2.lat1 &&
					(normalizedProjName === "stereographic south pole" ||
						normalizedProjName ===
							"polar stereographic (variant b)")
				) {
					wkt2.lat0 = d2r(wkt2.lat1 > 0 ? 90 : -90);
					wkt2.lat_ts = wkt2.lat1;
					delete wkt2.lat1;
				} else if (
					!wkt2.lat_ts &&
					wkt2.lat0 &&
					(normalizedProjName === "polar stereographic" ||
						normalizedProjName ===
							"polar stereographic (variant a)")
				) {
					wkt2.lat_ts = wkt2.lat0;
					wkt2.lat0 = d2r(wkt2.lat0 > 0 ? 90 : -90);
					delete wkt2.lat1;
				}
			}
			function processUnit(unit) {
				let result = { units: null, to_meter: void 0 };
				if (typeof unit === "string") {
					result.units = unit.toLowerCase();
					if (result.units === "metre") {
						result.units = "meter";
					}
					if (result.units === "meter") {
						result.to_meter = 1;
					}
				} else if (unit && unit.name) {
					result.units = unit.name.toLowerCase();
					if (result.units === "metre") {
						result.units = "meter";
					}
					result.to_meter = unit.conversion_factor;
				}
				return result;
			}
			function toValue(valueOrObject) {
				if (typeof valueOrObject === "object") {
					return (
						valueOrObject.value *
						valueOrObject.unit.conversion_factor
					);
				}
				return valueOrObject;
			}
			function calculateEllipsoid(value, result) {
				if (value.ellipsoid.radius) {
					result.a = value.ellipsoid.radius;
					result.rf = 0;
				} else {
					result.a = toValue(value.ellipsoid.semi_major_axis);
					if (value.ellipsoid.inverse_flattening !== void 0) {
						result.rf = value.ellipsoid.inverse_flattening;
					} else if (
						value.ellipsoid.semi_major_axis !== void 0 &&
						value.ellipsoid.semi_minor_axis !== void 0
					) {
						result.rf =
							result.a /
							(result.a -
								toValue(value.ellipsoid.semi_minor_axis));
					}
				}
			}
			function transformPROJJSON(projjson, result = {}) {
				if (!projjson || typeof projjson !== "object") {
					return projjson;
				}
				if (projjson.type === "BoundCRS") {
					transformPROJJSON(projjson.source_crs, result);
					if (projjson.transformation) {
						if (
							projjson.transformation.method &&
							projjson.transformation.method.name === "NTv2"
						) {
							result.nadgrids =
								projjson.transformation.parameters[0].value;
						} else {
							result.datum_params =
								projjson.transformation.parameters.map(
									(param) => param.value,
								);
						}
					}
					return result;
				}
				Object.keys(projjson).forEach((key2) => {
					const value = projjson[key2];
					if (value === null) {
						return;
					}
					switch (key2) {
						case "name":
							if (result.srsCode) {
								break;
							}
							result.name = value;
							result.srsCode = value;
							break;
						case "type":
							if (value === "GeographicCRS") {
								result.projName = "longlat";
							} else if (value === "GeodeticCRS") {
								if (
									projjson.coordinate_system &&
									projjson.coordinate_system.subtype ===
										"Cartesian"
								) {
									result.projName = "geocent";
								} else {
									result.projName = "longlat";
								}
							} else if (
								value === "ProjectedCRS" &&
								projjson.conversion &&
								projjson.conversion.method
							) {
								result.projName =
									projjson.conversion.method.name;
							}
							break;
						case "datum":
						case "datum_ensemble":
							if (value.ellipsoid) {
								result.ellps = value.ellipsoid.name;
								calculateEllipsoid(value, result);
							}
							if (value.prime_meridian) {
								result.from_greenwich =
									(value.prime_meridian.longitude * Math.PI) /
									180;
							}
							break;
						case "ellipsoid":
							result.ellps = value.name;
							calculateEllipsoid(value, result);
							break;
						case "prime_meridian":
							result.long0 =
								((value.longitude || 0) * Math.PI) / 180;
							break;
						case "coordinate_system":
							if (value.axis) {
								const directionMap = {
									east: "e",
									north: "n",
									west: "w",
									south: "s",
									up: "u",
									down: "d",
									geocentricx: "e",
									geocentricy: "n",
									geocentricz: "u",
								};
								const mapped = value.axis.map(
									(axis) =>
										directionMap[
											axis.direction.toLowerCase()
										],
								);
								if (mapped.every(Boolean)) {
									result.axis = mapped.join("");
									if (result.axis.length === 2) {
										result.axis += "u";
									}
								}
								if (value.unit) {
									const { units: units2, to_meter } =
										processUnit(value.unit);
									result.units = units2;
									result.to_meter = to_meter;
								} else if (
									value.axis[0] &&
									value.axis[0].unit
								) {
									const { units: units2, to_meter } =
										processUnit(value.axis[0].unit);
									result.units = units2;
									result.to_meter = to_meter;
								}
							}
							break;
						case "id":
							if (value.authority && value.code) {
								result.title =
									value.authority + ":" + value.code;
							}
							break;
						case "conversion":
							if (value.method && value.method.name) {
								result.projName = value.method.name;
							}
							if (value.parameters) {
								value.parameters.forEach((param) => {
									const paramName = param.name
										.toLowerCase()
										.replace(/\s+/g, "_");
									const paramValue = param.value;
									if (
										param.unit &&
										param.unit.conversion_factor
									) {
										result[paramName] =
											paramValue *
											param.unit.conversion_factor;
									} else if (param.unit === "degree") {
										result[paramName] =
											(paramValue * Math.PI) / 180;
									} else {
										result[paramName] = paramValue;
									}
								});
							}
							break;
						case "unit":
							if (value.name) {
								result.units = value.name.toLowerCase();
								if (result.units === "metre") {
									result.units = "meter";
								}
							}
							if (value.conversion_factor) {
								result.to_meter = value.conversion_factor;
							}
							break;
						case "base_crs":
							transformPROJJSON(value, result);
							result.datumCode = value.id
								? value.id.authority + "_" + value.id.code
								: value.name;
							break;
					}
				});
				if (result.latitude_of_false_origin !== void 0) {
					result.lat0 = result.latitude_of_false_origin;
				}
				if (result.longitude_of_false_origin !== void 0) {
					result.long0 = result.longitude_of_false_origin;
				}
				if (result.latitude_of_standard_parallel !== void 0) {
					result.lat0 = result.latitude_of_standard_parallel;
					result.lat1 = result.latitude_of_standard_parallel;
				}
				if (result.latitude_of_1st_standard_parallel !== void 0) {
					result.lat1 = result.latitude_of_1st_standard_parallel;
				}
				if (result.latitude_of_2nd_standard_parallel !== void 0) {
					result.lat2 = result.latitude_of_2nd_standard_parallel;
				}
				if (result.latitude_of_projection_centre !== void 0) {
					result.lat0 = result.latitude_of_projection_centre;
				}
				if (result.longitude_of_projection_centre !== void 0) {
					result.longc = result.longitude_of_projection_centre;
				}
				if (result.easting_at_false_origin !== void 0) {
					result.x0 = result.easting_at_false_origin;
				}
				if (result.northing_at_false_origin !== void 0) {
					result.y0 = result.northing_at_false_origin;
				}
				if (result.latitude_of_natural_origin !== void 0) {
					result.lat0 = result.latitude_of_natural_origin;
				}
				if (result.longitude_of_natural_origin !== void 0) {
					result.long0 = result.longitude_of_natural_origin;
				}
				if (result.longitude_of_origin !== void 0) {
					result.long0 = result.longitude_of_origin;
				}
				if (result.false_easting !== void 0) {
					result.x0 = result.false_easting;
				}
				if (result.easting_at_projection_centre) {
					result.x0 = result.easting_at_projection_centre;
				}
				if (result.false_northing !== void 0) {
					result.y0 = result.false_northing;
				}
				if (result.northing_at_projection_centre) {
					result.y0 = result.northing_at_projection_centre;
				}
				if (result.standard_parallel_1 !== void 0) {
					result.lat1 = result.standard_parallel_1;
				}
				if (result.standard_parallel_2 !== void 0) {
					result.lat2 = result.standard_parallel_2;
				}
				if (result.scale_factor_at_natural_origin !== void 0) {
					result.k0 = result.scale_factor_at_natural_origin;
				}
				if (result.scale_factor_at_projection_centre !== void 0) {
					result.k0 = result.scale_factor_at_projection_centre;
				}
				if (
					result.scale_factor_on_pseudo_standard_parallel !== void 0
				) {
					result.k0 = result.scale_factor_on_pseudo_standard_parallel;
				}
				if (result.azimuth !== void 0) {
					result.alpha = result.azimuth;
				}
				if (result.azimuth_at_projection_centre !== void 0) {
					result.alpha = result.azimuth_at_projection_centre;
				}
				if (result.angle_from_rectified_to_skew_grid) {
					result.rectified_grid_angle =
						result.angle_from_rectified_to_skew_grid;
				}
				applyProjectionDefaults(result);
				return result;
			}
			var knownTypes = [
				"PROJECTEDCRS",
				"PROJCRS",
				"GEOGCS",
				"GEOCCS",
				"PROJCS",
				"LOCAL_CS",
				"GEODCRS",
				"GEODETICCRS",
				"GEODETICDATUM",
				"ENGCRS",
				"ENGINEERINGCRS",
			];
			function rename(obj, params2) {
				var outName = params2[0];
				var inName = params2[1];
				if (!(outName in obj) && inName in obj) {
					obj[outName] = obj[inName];
					if (params2.length === 3) {
						obj[outName] = params2[2](obj[outName]);
					}
				}
			}
			function cleanWKT(wkt2) {
				var keys = Object.keys(wkt2);
				for (var i = 0, ii = keys.length; i < ii; ++i) {
					var key2 = keys[i];
					if (knownTypes.indexOf(key2) !== -1) {
						setPropertiesFromWkt(wkt2[key2]);
					}
					if (typeof wkt2[key2] === "object") {
						cleanWKT(wkt2[key2]);
					}
				}
			}
			function setPropertiesFromWkt(wkt2) {
				if (wkt2.AUTHORITY) {
					var authority = Object.keys(wkt2.AUTHORITY)[0];
					if (authority && authority in wkt2.AUTHORITY) {
						wkt2.title =
							authority + ":" + wkt2.AUTHORITY[authority];
					}
				}
				if (wkt2.type === "GEOGCS") {
					wkt2.projName = "longlat";
				} else if (wkt2.type === "LOCAL_CS") {
					wkt2.projName = "identity";
					wkt2.local = true;
				} else {
					if (typeof wkt2.PROJECTION === "object") {
						wkt2.projName = Object.keys(wkt2.PROJECTION)[0];
					} else {
						wkt2.projName = wkt2.PROJECTION;
					}
				}
				if (wkt2.AXIS) {
					var axisOrder = "";
					for (var i = 0, ii = wkt2.AXIS.length; i < ii; ++i) {
						var axis = [
							wkt2.AXIS[i][0].toLowerCase(),
							wkt2.AXIS[i][1].toLowerCase(),
						];
						if (
							axis[0].indexOf("north") !== -1 ||
							((axis[0] === "y" || axis[0] === "lat") &&
								axis[1] === "north")
						) {
							axisOrder += "n";
						} else if (
							axis[0].indexOf("south") !== -1 ||
							((axis[0] === "y" || axis[0] === "lat") &&
								axis[1] === "south")
						) {
							axisOrder += "s";
						} else if (
							axis[0].indexOf("east") !== -1 ||
							((axis[0] === "x" || axis[0] === "lon") &&
								axis[1] === "east")
						) {
							axisOrder += "e";
						} else if (
							axis[0].indexOf("west") !== -1 ||
							((axis[0] === "x" || axis[0] === "lon") &&
								axis[1] === "west")
						) {
							axisOrder += "w";
						}
					}
					if (axisOrder.length === 2) {
						axisOrder += "u";
					}
					if (axisOrder.length === 3) {
						wkt2.axis = axisOrder;
					}
				}
				if (wkt2.UNIT) {
					wkt2.units = wkt2.UNIT.name.toLowerCase();
					if (wkt2.units === "metre") {
						wkt2.units = "meter";
					}
					if (wkt2.UNIT.convert) {
						if (wkt2.type === "GEOGCS") {
							if (wkt2.DATUM && wkt2.DATUM.SPHEROID) {
								wkt2.to_meter =
									wkt2.UNIT.convert * wkt2.DATUM.SPHEROID.a;
							}
						} else {
							wkt2.to_meter = wkt2.UNIT.convert;
						}
					}
				}
				var geogcs = wkt2.GEOGCS;
				if (wkt2.type === "GEOGCS") {
					geogcs = wkt2;
				}
				if (geogcs) {
					if (geogcs.PRIMEM && geogcs.PRIMEM.convert) {
						wkt2.from_greenwich = d2r(geogcs.PRIMEM.convert);
					}
					if (geogcs.DATUM) {
						wkt2.datumCode = geogcs.DATUM.name.toLowerCase();
					} else {
						wkt2.datumCode = geogcs.name.toLowerCase();
					}
					if (wkt2.datumCode.slice(0, 2) === "d_") {
						wkt2.datumCode = wkt2.datumCode.slice(2);
					}
					if (wkt2.datumCode === "new_zealand_1949") {
						wkt2.datumCode = "nzgd49";
					}
					if (
						wkt2.datumCode === "wgs_1984" ||
						wkt2.datumCode === "world_geodetic_system_1984"
					) {
						if (wkt2.PROJECTION === "Mercator_Auxiliary_Sphere") {
							wkt2.sphere = true;
						}
						wkt2.datumCode = "wgs84";
					}
					if (wkt2.datumCode === "belge_1972") {
						wkt2.datumCode = "rnb72";
					}
					if (geogcs.DATUM && geogcs.DATUM.SPHEROID) {
						wkt2.ellps = geogcs.DATUM.SPHEROID.name
							.replace("_19", "")
							.replace(/[Cc]larke\_18/, "clrk");
						if (
							wkt2.ellps.toLowerCase().slice(0, 13) ===
							"international"
						) {
							wkt2.ellps = "intl";
						}
						wkt2.a = geogcs.DATUM.SPHEROID.a;
						wkt2.rf = parseFloat(geogcs.DATUM.SPHEROID.rf);
					}
					if (geogcs.DATUM && geogcs.DATUM.TOWGS84) {
						wkt2.datum_params = geogcs.DATUM.TOWGS84;
					}
					if (~wkt2.datumCode.indexOf("osgb_1936")) {
						wkt2.datumCode = "osgb36";
					}
					if (~wkt2.datumCode.indexOf("osni_1952")) {
						wkt2.datumCode = "osni52";
					}
					if (
						~wkt2.datumCode.indexOf("tm65") ||
						~wkt2.datumCode.indexOf("geodetic_datum_of_1965")
					) {
						wkt2.datumCode = "ire65";
					}
					if (wkt2.datumCode === "ch1903+") {
						wkt2.datumCode = "ch1903";
					}
					if (~wkt2.datumCode.indexOf("israel")) {
						wkt2.datumCode = "isr93";
					}
				}
				if (wkt2.b && !isFinite(wkt2.b)) {
					wkt2.b = wkt2.a;
				}
				if (wkt2.rectified_grid_angle) {
					wkt2.rectified_grid_angle = d2r(wkt2.rectified_grid_angle);
				}
				function toMeter(input) {
					var ratio = wkt2.to_meter || 1;
					return input * ratio;
				}
				var renamer = function (a) {
					return rename(wkt2, a);
				};
				var list = [
					["standard_parallel_1", "Standard_Parallel_1"],
					[
						"standard_parallel_1",
						"Latitude of 1st standard parallel",
					],
					["standard_parallel_2", "Standard_Parallel_2"],
					[
						"standard_parallel_2",
						"Latitude of 2nd standard parallel",
					],
					["false_easting", "False_Easting"],
					["false_easting", "False easting"],
					["false-easting", "Easting at false origin"],
					["false_northing", "False_Northing"],
					["false_northing", "False northing"],
					["false_northing", "Northing at false origin"],
					["central_meridian", "Central_Meridian"],
					["central_meridian", "Longitude of natural origin"],
					["central_meridian", "Longitude of false origin"],
					["latitude_of_origin", "Latitude_Of_Origin"],
					["latitude_of_origin", "Central_Parallel"],
					["latitude_of_origin", "Latitude of natural origin"],
					["latitude_of_origin", "Latitude of false origin"],
					["scale_factor", "Scale_Factor"],
					["k0", "scale_factor"],
					["latitude_of_center", "Latitude_Of_Center"],
					["latitude_of_center", "Latitude_of_center"],
					["lat0", "latitude_of_center", d2r],
					["longitude_of_center", "Longitude_Of_Center"],
					["longitude_of_center", "Longitude_of_center"],
					["longc", "longitude_of_center", d2r],
					["x0", "false_easting", toMeter],
					["y0", "false_northing", toMeter],
					["long0", "central_meridian", d2r],
					["lat0", "latitude_of_origin", d2r],
					["lat0", "standard_parallel_1", d2r],
					["lat1", "standard_parallel_1", d2r],
					["lat2", "standard_parallel_2", d2r],
					["azimuth", "Azimuth"],
					["alpha", "azimuth", d2r],
					["srsCode", "name"],
				];
				list.forEach(renamer);
				applyProjectionDefaults(wkt2);
			}
			function wkt(wkt2) {
				if (typeof wkt2 === "object") {
					return transformPROJJSON(wkt2);
				}
				const version = detectWKTVersion(wkt2);
				var lisp = parseString(wkt2);
				if (version === "WKT2") {
					const projjson = buildPROJJSON(lisp);
					return transformPROJJSON(projjson);
				}
				var type = lisp[0];
				var obj = {};
				sExpr(lisp, obj);
				cleanWKT(obj);
				return obj[type];
			}
			function defs(name) {
				var that = this;
				if (arguments.length === 2) {
					var def = arguments[1];
					if (typeof def === "string") {
						if (def.charAt(0) === "+") {
							/** @type {string} */
							defs[name] = projStr(arguments[1]);
						} else {
							/** @type {string} */
							defs[name] = wkt(arguments[1]);
						}
					} else if (
						def &&
						typeof def === "object" &&
						!("projName" in def)
					) {
						/** @type {string} */
						defs[name] = wkt(arguments[1]);
					} else {
						/** @type {string} */
						defs[name] = def;
						if (!def) {
							delete (
								/** @type {string} */
								defs[name]
							);
						}
					}
				} else if (arguments.length === 1) {
					if (Array.isArray(name)) {
						return name.map(function (v) {
							if (Array.isArray(v)) {
								return defs.apply(that, v);
							} else {
								return defs(v);
							}
						});
					} else if (typeof name === "string") {
						if (name in defs) {
							return defs[name];
						}
					} else if ("EPSG" in name) {
						defs["EPSG:" + name.EPSG] = name;
					} else if ("ESRI" in name) {
						defs["ESRI:" + name.ESRI] = name;
					} else if ("IAU2000" in name) {
						defs["IAU2000:" + name.IAU2000] = name;
					} else {
						console.log(name);
					}
					return;
				}
			}
			globals(defs);
			function testObj(code) {
				return typeof code === "string";
			}
			function testDef(code) {
				return code in defs;
			}
			function testWKT(code) {
				return (
					(code.indexOf("+") !== 0 && code.indexOf("[") !== -1) ||
					(typeof code === "object" && !("srsCode" in code))
				);
			}
			var codes = ["3857", "900913", "3785", "102113"];
			function checkMercator(item) {
				if (item.title) {
					return (
						item.title.toLowerCase().indexOf("epsg:") === 0 &&
						codes.indexOf(item.title.substr(5)) > -1
					);
				}
				var auth = match(item, "authority");
				if (!auth) {
					return;
				}
				var code = match(auth, "epsg");
				return code && codes.indexOf(code) > -1;
			}
			function checkProjStr(item) {
				var ext = match(item, "extension");
				if (!ext) {
					return;
				}
				return match(ext, "proj4");
			}
			function testProj(code) {
				return code[0] === "+";
			}
			function parse(code) {
				let out;
				if (testObj(code)) {
					if (testDef(code)) {
						out = defs[code];
					} else if (testWKT(code)) {
						out = wkt(code);
						var maybeProjStr = checkProjStr(out);
						if (maybeProjStr) {
							out = projStr(maybeProjStr);
						}
					} else if (testProj(code)) {
						out = projStr(code);
					}
				} else if (!("projName" in code)) {
					out = wkt(code);
				} else {
					out = code;
				}
				return out && checkMercator(out) ? defs["EPSG:3857"] : out;
			}
			function extend(destination, source) {
				destination = destination || {};
				var value, property;
				if (!source) {
					return destination;
				}
				for (property in source) {
					value = source[property];
					if (value !== void 0) {
						destination[property] = value;
					}
				}
				return destination;
			}
			function msfnz(eccent, sinphi, cosphi) {
				var con = eccent * sinphi;
				return cosphi / Math.sqrt(1 - con * con);
			}
			function sign(x) {
				return x < 0 ? -1 : 1;
			}
			function adjust_lon(x, skipAdjust) {
				if (skipAdjust) {
					return x;
				}
				return Math.abs(x) <= SPI ? x : x - sign(x) * TWO_PI;
			}
			function tsfnz(eccent, phi, sinphi) {
				var con = eccent * sinphi;
				var com = 0.5 * eccent;
				con = Math.pow((1 - con) / (1 + con), com);
				return Math.tan(0.5 * (HALF_PI - phi)) / con;
			}
			function phi2z(eccent, ts) {
				var eccnth = 0.5 * eccent;
				var con, dphi;
				var phi = HALF_PI - 2 * Math.atan(ts);
				for (var i = 0; i <= 15; i++) {
					con = eccent * Math.sin(phi);
					dphi =
						HALF_PI -
						2 *
							Math.atan(
								ts * Math.pow((1 - con) / (1 + con), eccnth),
							) -
						phi;
					phi += dphi;
					if (Math.abs(dphi) <= 1e-10) {
						return phi;
					}
				}
				return -9999;
			}
			function init$z() {
				var con = this.b / this.a;
				this.es = 1 - con * con;
				if (!("x0" in this)) {
					this.x0 = 0;
				}
				if (!("y0" in this)) {
					this.y0 = 0;
				}
				this.long0 = this.long0 || 0;
				this.e = Math.sqrt(this.es);
				if (this.lat_ts) {
					if (this.sphere) {
						this.k0 = Math.cos(this.lat_ts);
					} else {
						this.k0 = msfnz(
							this.e,
							Math.sin(this.lat_ts),
							Math.cos(this.lat_ts),
						);
					}
				} else {
					if (!this.k0) {
						if (this.k) {
							this.k0 = this.k;
						} else {
							this.k0 = 1;
						}
					}
				}
			}
			function forward$x(p) {
				var lon = p.x;
				var lat = p.y;
				if (
					lat * R2D > 90 &&
					lat * R2D < -90 &&
					lon * R2D > 180 &&
					lon * R2D < -180
				) {
					return null;
				}
				var x, y;
				if (Math.abs(Math.abs(lat) - HALF_PI) <= EPSLN) {
					return null;
				} else {
					if (this.sphere) {
						x =
							this.x0 +
							this.a *
								this.k0 *
								adjust_lon(lon - this.long0, this.over);
						y =
							this.y0 +
							this.a *
								this.k0 *
								Math.log(Math.tan(FORTPI + 0.5 * lat));
					} else {
						var sinphi = Math.sin(lat);
						var ts = tsfnz(this.e, lat, sinphi);
						x =
							this.x0 +
							this.a *
								this.k0 *
								adjust_lon(lon - this.long0, this.over);
						y = this.y0 - this.a * this.k0 * Math.log(ts);
					}
					p.x = x;
					p.y = y;
					return p;
				}
			}
			function inverse$x(p) {
				var x = p.x - this.x0;
				var y = p.y - this.y0;
				var lon, lat;
				if (this.sphere) {
					lat =
						HALF_PI -
						2 * Math.atan(Math.exp(-y / (this.a * this.k0)));
				} else {
					var ts = Math.exp(-y / (this.a * this.k0));
					lat = phi2z(this.e, ts);
					if (lat === -9999) {
						return null;
					}
				}
				lon = adjust_lon(
					this.long0 + x / (this.a * this.k0),
					this.over,
				);
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$z = [
				"Mercator",
				"Popular Visualisation Pseudo Mercator",
				"Mercator_1SP",
				"Mercator_Auxiliary_Sphere",
				"Mercator_Variant_A",
				"merc",
			];
			var merc = {
				init: init$z,
				forward: forward$x,
				inverse: inverse$x,
				names: names$z,
			};
			function init$y() {}
			function identity(pt) {
				return pt;
			}
			var names$y = [
				"longlat",
				"identity",
				"lonlat",
				"latlon",
				"latlong",
			];
			var longlat = {
				init: init$y,
				forward: identity,
				inverse: identity,
				names: names$y,
			};
			var projs = [merc, longlat];
			var names$x = {};
			var projStore = [];
			function add(proj, i) {
				var len = projStore.length;
				if (!proj.names) {
					console.log(i);
					return true;
				}
				projStore[len] = proj;
				proj.names.forEach(function (n) {
					names$x[n.toLowerCase()] = len;
				});
				return this;
			}
			function getNormalizedProjName(n) {
				return n
					.replace(/[-\(\)\s]+/g, " ")
					.trim()
					.replace(/ /g, "_");
			}
			function get(name) {
				if (!name) {
					return false;
				}
				var n = name.toLowerCase();
				if (
					typeof names$x[n] !== "undefined" &&
					projStore[names$x[n]]
				) {
					return projStore[names$x[n]];
				}
				n = getNormalizedProjName(n);
				if (n in names$x && projStore[names$x[n]]) {
					return projStore[names$x[n]];
				}
			}
			function start() {
				projs.forEach(add);
			}
			var projections = {
				start,
				add,
				get,
			};
			var ellipsoids = {
				MERIT: {
					a: 6378137,
					rf: 298.257,
					ellipseName: "MERIT 1983",
				},
				SGS85: {
					a: 6378136,
					rf: 298.257,
					ellipseName: "Soviet Geodetic System 85",
				},
				GRS80: {
					a: 6378137,
					rf: 298.257222101,
					ellipseName: "GRS 1980(IUGG, 1980)",
				},
				IAU76: {
					a: 6378140,
					rf: 298.257,
					ellipseName: "IAU 1976",
				},
				airy: {
					a: 6377563396e-3,
					b: 635625691e-2,
					ellipseName: "Airy 1830",
				},
				APL4: {
					a: 6378137,
					rf: 298.25,
					ellipseName: "Appl. Physics. 1965",
				},
				NWL9D: {
					a: 6378145,
					rf: 298.25,
					ellipseName: "Naval Weapons Lab., 1965",
				},
				mod_airy: {
					a: 6377340189e-3,
					b: 6356034446e-3,
					ellipseName: "Modified Airy",
				},
				andrae: {
					a: 637710443e-2,
					rf: 300,
					ellipseName: "Andrae 1876 (Den., Iclnd.)",
				},
				aust_SA: {
					a: 6378160,
					rf: 298.25,
					ellipseName: "Australian Natl & S. Amer. 1969",
				},
				GRS67: {
					a: 6378160,
					rf: 298.247167427,
					ellipseName: "GRS 67(IUGG 1967)",
				},
				bessel: {
					a: 6377397155e-3,
					rf: 299.1528128,
					ellipseName: "Bessel 1841",
				},
				bess_nam: {
					a: 6377483865e-3,
					rf: 299.1528128,
					ellipseName: "Bessel 1841 (Namibia)",
				},
				clrk66: {
					a: 63782064e-1,
					b: 63565838e-1,
					ellipseName: "Clarke 1866",
				},
				clrk80: {
					a: 6378249145e-3,
					rf: 293.4663,
					ellipseName: "Clarke 1880 mod.",
				},
				clrk80ign: {
					a: 63782492e-1,
					b: 6356515,
					rf: 293.4660213,
					ellipseName: "Clarke 1880 (IGN)",
				},
				clrk58: {
					a: 6378293645208759e-9,
					rf: 294.2606763692654,
					ellipseName: "Clarke 1858",
				},
				CPM: {
					a: 63757387e-1,
					rf: 334.29,
					ellipseName: "Comm. des Poids et Mesures 1799",
				},
				delmbr: {
					a: 6376428,
					rf: 311.5,
					ellipseName: "Delambre 1810 (Belgium)",
				},
				engelis: {
					a: 637813605e-2,
					rf: 298.2566,
					ellipseName: "Engelis 1985",
				},
				evrst30: {
					a: 6377276345e-3,
					rf: 300.8017,
					ellipseName: "Everest 1830",
				},
				evrst48: {
					a: 6377304063e-3,
					rf: 300.8017,
					ellipseName: "Everest 1948",
				},
				evrst56: {
					a: 6377301243e-3,
					rf: 300.8017,
					ellipseName: "Everest 1956",
				},
				evrst69: {
					a: 6377295664e-3,
					rf: 300.8017,
					ellipseName: "Everest 1969",
				},
				evrstSS: {
					a: 6377298556e-3,
					rf: 300.8017,
					ellipseName: "Everest (Sabah & Sarawak)",
				},
				fschr60: {
					a: 6378166,
					rf: 298.3,
					ellipseName: "Fischer (Mercury Datum) 1960",
				},
				fschr60m: {
					a: 6378155,
					rf: 298.3,
					ellipseName: "Fischer 1960",
				},
				fschr68: {
					a: 6378150,
					rf: 298.3,
					ellipseName: "Fischer 1968",
				},
				helmert: {
					a: 6378200,
					rf: 298.3,
					ellipseName: "Helmert 1906",
				},
				hough: {
					a: 6378270,
					rf: 297,
					ellipseName: "Hough",
				},
				intl: {
					a: 6378388,
					rf: 297,
					ellipseName: "International 1909 (Hayford)",
				},
				kaula: {
					a: 6378163,
					rf: 298.24,
					ellipseName: "Kaula 1961",
				},
				lerch: {
					a: 6378139,
					rf: 298.257,
					ellipseName: "Lerch 1979",
				},
				mprts: {
					a: 6397300,
					rf: 191,
					ellipseName: "Maupertius 1738",
				},
				new_intl: {
					a: 63781575e-1,
					b: 63567722e-1,
					ellipseName: "New International 1967",
				},
				plessis: {
					a: 6376523,
					b: 6355863,
					ellipseName: "Plessis 1817 (France)",
				},
				krass: {
					a: 6378245,
					rf: 298.3,
					ellipseName: "Krassovsky, 1942",
				},
				SEasia: {
					a: 6378155,
					b: 63567733205e-4,
					ellipseName: "Southeast Asia",
				},
				walbeck: {
					a: 6376896,
					b: 63558348467e-4,
					ellipseName: "Walbeck",
				},
				WGS60: {
					a: 6378165,
					rf: 298.3,
					ellipseName: "WGS 60",
				},
				WGS66: {
					a: 6378145,
					rf: 298.25,
					ellipseName: "WGS 66",
				},
				WGS7: {
					a: 6378135,
					rf: 298.26,
					ellipseName: "WGS 72",
				},
				WGS84: {
					a: 6378137,
					rf: 298.257223563,
					ellipseName: "WGS 84",
				},
				sphere: {
					a: 6370997,
					b: 6370997,
					ellipseName: "Normal Sphere (r=6370997)",
				},
			};
			const WGS84 = ellipsoids.WGS84;
			function eccentricity(a, b, rf, R_A) {
				var a2 = a * a;
				var b2 = b * b;
				var es = (a2 - b2) / a2;
				var e = 0;
				if (R_A) {
					a *= 1 - es * (SIXTH + es * (RA4 + es * RA6));
					a2 = a * a;
					es = 0;
				} else {
					e = Math.sqrt(es);
				}
				var ep2 = (a2 - b2) / b2;
				return {
					es,
					e,
					ep2,
				};
			}
			function sphere(a, b, rf, ellps, sphere2) {
				if (!a) {
					var ellipse = match(ellipsoids, ellps);
					if (!ellipse) {
						ellipse = WGS84;
					}
					a = ellipse.a;
					b = ellipse.b;
					rf = ellipse.rf;
				}
				if (rf && !b) {
					b = (1 - 1 / rf) * a;
				}
				if (rf === 0 || Math.abs(a - b) < EPSLN) {
					sphere2 = true;
					b = a;
				}
				return {
					a,
					b,
					rf,
					sphere: sphere2,
				};
			}
			var datums = {
				wgs84: {
					towgs84: "0,0,0",
					ellipse: "WGS84",
					datumName: "WGS84",
				},
				ch1903: {
					towgs84: "674.374,15.056,405.346",
					ellipse: "bessel",
					datumName: "swiss",
				},
				ggrs87: {
					towgs84: "-199.87,74.79,246.62",
					ellipse: "GRS80",
					datumName: "Greek_Geodetic_Reference_System_1987",
				},
				nad83: {
					towgs84: "0,0,0",
					ellipse: "GRS80",
					datumName: "North_American_Datum_1983",
				},
				nad27: {
					nadgrids: "@conus,@alaska,@ntv2_0.gsb,@ntv1_can.dat",
					ellipse: "clrk66",
					datumName: "North_American_Datum_1927",
				},
				potsdam: {
					towgs84: "598.1,73.7,418.2,0.202,0.045,-2.455,6.7",
					ellipse: "bessel",
					datumName: "Potsdam Rauenberg 1950 DHDN",
				},
				carthage: {
					towgs84: "-263.0,6.0,431.0",
					ellipse: "clrk80ign",
					datumName: "Carthage 1934 Tunisia",
				},
				hermannskogel: {
					towgs84: "577.326,90.129,463.919,5.137,1.474,5.297,2.4232",
					ellipse: "bessel",
					datumName: "Hermannskogel",
				},
				mgi: {
					towgs84: "577.326,90.129,463.919,5.137,1.474,5.297,2.4232",
					ellipse: "bessel",
					datumName: "Militar-Geographische Institut",
				},
				osni52: {
					towgs84:
						"482.530,-130.596,564.557,-1.042,-0.214,-0.631,8.15",
					ellipse: "airy",
					datumName: "Irish National",
				},
				ire65: {
					towgs84:
						"482.530,-130.596,564.557,-1.042,-0.214,-0.631,8.15",
					ellipse: "mod_airy",
					datumName: "Ireland 1965",
				},
				rassadiran: {
					towgs84: "-133.63,-157.5,-158.62",
					ellipse: "intl",
					datumName: "Rassadiran",
				},
				nzgd49: {
					towgs84: "59.47,-5.04,187.44,0.47,-0.1,1.024,-4.5993",
					ellipse: "intl",
					datumName: "New Zealand Geodetic Datum 1949",
				},
				osgb36: {
					towgs84:
						"446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894",
					ellipse: "airy",
					datumName: "Ordnance Survey of Great Britain 1936",
				},
				s_jtsk: {
					towgs84: "589,76,480",
					ellipse: "bessel",
					datumName: "S-JTSK (Ferro)",
				},
				beduaram: {
					towgs84: "-106,-87,188",
					ellipse: "clrk80",
					datumName: "Beduaram",
				},
				gunung_segara: {
					towgs84: "-403,684,41",
					ellipse: "bessel",
					datumName: "Gunung Segara Jakarta",
				},
				rnb72: {
					towgs84:
						"106.869,-52.2978,103.724,-0.33657,0.456955,-1.84218,1",
					ellipse: "intl",
					datumName: "Reseau National Belge 1972",
				},
				EPSG_5451: {
					towgs84: "6.41,-49.05,-11.28,1.5657,0.5242,6.9718,-5.7649",
				},
				IGNF_LURESG: {
					towgs84:
						"-192.986,13.673,-39.309,-0.4099,-2.9332,2.6881,0.43",
				},
				EPSG_4614: {
					towgs84:
						"-119.4248,-303.65872,-11.00061,1.164298,0.174458,1.096259,3.657065",
				},
				EPSG_4615: {
					towgs84:
						"-494.088,-312.129,279.877,-1.423,-1.013,1.59,-0.748",
				},
				ESRI_37241: {
					towgs84:
						"-76.822,257.457,-12.817,2.136,-0.033,-2.392,-0.031",
				},
				ESRI_37249: {
					towgs84:
						"-440.296,58.548,296.265,1.128,10.202,4.559,-0.438",
				},
				ESRI_37245: {
					towgs84: "-511.151,-181.269,139.609,1.05,2.703,1.798,3.071",
				},
				EPSG_4178: {
					towgs84: "24.9,-126.4,-93.2,-0.063,-0.247,-0.041,1.01",
				},
				EPSG_4622: {
					towgs84:
						"-472.29,-5.63,-304.12,0.4362,-0.8374,0.2563,1.8984",
				},
				EPSG_4625: {
					towgs84:
						"126.93,547.94,130.41,-2.7867,5.1612,-0.8584,13.8227",
				},
				EPSG_5252: {
					towgs84:
						"0.023,0.036,-0.068,0.00176,0.00912,-0.01136,0.00439",
				},
				EPSG_4314: {
					towgs84: "597.1,71.4,412.1,0.894,0.068,-1.563,7.58",
				},
				EPSG_4282: {
					towgs84: "-178.3,-316.7,-131.5,5.278,6.077,10.979,19.166",
				},
				EPSG_4231: {
					towgs84:
						"-83.11,-97.38,-117.22,0.005693,-0.044698,0.044285,0.1218",
				},
				EPSG_4274: {
					towgs84: "-230.994,102.591,25.199,0.633,-0.239,0.9,1.95",
				},
				EPSG_4134: {
					towgs84:
						"-180.624,-225.516,173.919,-0.81,-1.898,8.336,16.71006",
				},
				EPSG_4254: {
					towgs84: "18.38,192.45,96.82,0.056,-0.142,-0.2,-0.0013",
				},
				EPSG_4159: {
					towgs84:
						"-194.513,-63.978,-25.759,-3.4027,3.756,-3.352,-0.9175",
				},
				EPSG_4687: {
					towgs84: "0.072,-0.507,-0.245,0.0183,-0.0003,0.007,-0.0093",
				},
				EPSG_4227: {
					towgs84: "-83.58,-397.54,458.78,-17.595,-2.847,4.256,3.225",
				},
				EPSG_4746: {
					towgs84: "599.4,72.4,419.2,-0.062,-0.022,-2.723,6.46",
				},
				EPSG_4745: {
					towgs84: "612.4,77,440.2,-0.054,0.057,-2.797,2.55",
				},
				EPSG_6311: {
					towgs84:
						"8.846,-4.394,-1.122,-0.00237,-0.146528,0.130428,0.783926",
				},
				EPSG_4289: {
					towgs84:
						"565.7381,50.4018,465.2904,-0.395026,0.330772,-1.876073,4.07244",
				},
				EPSG_4230: {
					towgs84: "-68.863,-134.888,-111.49,-0.53,-0.14,0.57,-3.4",
				},
				EPSG_4154: {
					towgs84: "-123.02,-158.95,-168.47",
				},
				EPSG_4156: {
					towgs84: "570.8,85.7,462.8,4.998,1.587,5.261,3.56",
				},
				EPSG_4299: {
					towgs84: "482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15",
				},
				EPSG_4179: {
					towgs84: "33.4,-146.6,-76.3,-0.359,-0.053,0.844,-0.84",
				},
				EPSG_4313: {
					towgs84:
						"-106.8686,52.2978,-103.7239,0.3366,-0.457,1.8422,-1.2747",
				},
				EPSG_4194: {
					towgs84: "163.511,127.533,-159.789",
				},
				EPSG_4195: {
					towgs84: "105,326,-102.5",
				},
				EPSG_4196: {
					towgs84: "-45,417,-3.5",
				},
				EPSG_4611: {
					towgs84:
						"-162.619,-276.959,-161.764,0.067753,-2.243648,-1.158828,-1.094246",
				},
				EPSG_4633: {
					towgs84:
						"137.092,131.66,91.475,-1.9436,-11.5993,-4.3321,-7.4824",
				},
				EPSG_4641: {
					towgs84:
						"-408.809,366.856,-412.987,1.8842,-0.5308,2.1655,-121.0993",
				},
				EPSG_4643: {
					towgs84:
						"-480.26,-438.32,-643.429,16.3119,20.1721,-4.0349,-111.7002",
				},
				EPSG_4300: {
					towgs84: "482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15",
				},
				EPSG_4188: {
					towgs84: "482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15",
				},
				EPSG_4660: {
					towgs84:
						"982.6087,552.753,-540.873,6.681627,-31.611492,-19.848161,16.805",
				},
				EPSG_4662: {
					towgs84:
						"97.295,-263.247,310.882,-1.5999,0.8386,3.1409,13.3259",
				},
				EPSG_3906: {
					towgs84:
						"577.88891,165.22205,391.18289,4.9145,-0.94729,-13.05098,7.78664",
				},
				EPSG_4307: {
					towgs84:
						"-209.3622,-87.8162,404.6198,0.0046,3.4784,0.5805,-1.4547",
				},
				EPSG_6892: {
					towgs84:
						"-76.269,-16.683,68.562,-6.275,10.536,-4.286,-13.686",
				},
				EPSG_4690: {
					towgs84:
						"221.597,152.441,176.523,2.403,1.3893,0.884,11.4648",
				},
				EPSG_4691: {
					towgs84:
						"218.769,150.75,176.75,3.5231,2.0037,1.288,10.9817",
				},
				EPSG_4629: {
					towgs84:
						"72.51,345.411,79.241,-1.5862,-0.8826,-0.5495,1.3653",
				},
				EPSG_4630: {
					towgs84:
						"165.804,216.213,180.26,-0.6251,-0.4515,-0.0721,7.4111",
				},
				EPSG_4692: {
					towgs84:
						"217.109,86.452,23.711,0.0183,-0.0003,0.007,-0.0093",
				},
				EPSG_9333: {
					towgs84: "0,0,0,-0.008393,0.000749,-0.010276,0",
				},
				EPSG_9059: {
					towgs84: "0,0,0",
				},
				EPSG_4312: {
					towgs84:
						"601.705,84.263,485.227,4.7354,1.3145,5.393,-2.3887",
				},
				EPSG_4123: {
					towgs84:
						"-96.062,-82.428,-121.753,4.801,0.345,-1.376,1.496",
				},
				EPSG_4309: {
					towgs84:
						"-124.45,183.74,44.64,-0.4384,0.5446,-0.9706,-2.1365",
				},
				ESRI_104106: {
					towgs84:
						"-283.088,-70.693,117.445,-1.157,0.059,-0.652,-4.058",
				},
				EPSG_4281: {
					towgs84: "-219.247,-73.802,269.529",
				},
				EPSG_4322: {
					towgs84: "0,0,4.5",
				},
				EPSG_4324: {
					towgs84: "0,0,1.9",
				},
				EPSG_4284: {
					towgs84:
						"43.822,-108.842,-119.585,1.455,-0.761,0.737,0.549",
				},
				EPSG_4277: {
					towgs84: "446.448,-125.157,542.06,0.15,0.247,0.842,-20.489",
				},
				EPSG_4207: {
					towgs84: "-282.1,-72.2,120,-1.529,0.145,-0.89,-4.46",
				},
				EPSG_4688: {
					towgs84:
						"347.175,1077.618,2623.677,33.9058,-70.6776,9.4013,186.0647",
				},
				EPSG_4689: {
					towgs84:
						"410.793,54.542,80.501,-2.5596,-2.3517,-0.6594,17.3218",
				},
				EPSG_4720: {
					towgs84: "0,0,4.5",
				},
				EPSG_4273: {
					towgs84: "278.3,93,474.5,7.889,0.05,-6.61,6.21",
				},
				EPSG_4240: {
					towgs84: "204.64,834.74,293.8",
				},
				EPSG_4817: {
					towgs84: "278.3,93,474.5,7.889,0.05,-6.61,6.21",
				},
				ESRI_104131: {
					towgs84: "426.62,142.62,460.09,4.98,4.49,-12.42,-17.1",
				},
				EPSG_4265: {
					towgs84: "-104.1,-49.1,-9.9,0.971,-2.917,0.714,-11.68",
				},
				EPSG_4263: {
					towgs84: "-111.92,-87.85,114.5,1.875,0.202,0.219,0.032",
				},
				EPSG_4298: {
					towgs84:
						"-689.5937,623.84046,-65.93566,-0.02331,1.17094,-0.80054,5.88536",
				},
				EPSG_4270: {
					towgs84:
						"-253.4392,-148.452,386.5267,0.15605,0.43,-0.1013,-0.0424",
				},
				EPSG_4229: {
					towgs84: "-121.8,98.1,-10.7",
				},
				EPSG_4220: {
					towgs84: "-55.5,-348,-229.2",
				},
				EPSG_4214: {
					towgs84: "12.646,-155.176,-80.863",
				},
				EPSG_4232: {
					towgs84: "-345,3,223",
				},
				EPSG_4238: {
					towgs84: "-1.977,-13.06,-9.993,0.364,0.254,0.689,-1.037",
				},
				EPSG_4168: {
					towgs84: "-170,33,326",
				},
				EPSG_4131: {
					towgs84: "199,931,318.9",
				},
				EPSG_4152: {
					towgs84:
						"-0.9102,2.0141,0.5602,0.029039,0.010065,0.010101,0",
				},
				EPSG_5228: {
					towgs84: "572.213,85.334,461.94,4.9732,1.529,5.2484,3.5378",
				},
				EPSG_8351: {
					towgs84:
						"485.021,169.465,483.839,7.786342,4.397554,4.102655,0",
				},
				EPSG_4683: {
					towgs84: "-127.62,-67.24,-47.04,-3.068,4.903,1.578,-1.06",
				},
				EPSG_4133: {
					towgs84: "0,0,0",
				},
				EPSG_7373: {
					towgs84:
						"0.819,-0.5762,-1.6446,-0.00378,-0.03317,0.00318,0.0693",
				},
				EPSG_9075: {
					towgs84:
						"-0.9102,2.0141,0.5602,0.029039,0.010065,0.010101,0",
				},
				EPSG_9072: {
					towgs84:
						"-0.9102,2.0141,0.5602,0.029039,0.010065,0.010101,0",
				},
				EPSG_9294: {
					towgs84:
						"1.16835,-1.42001,-2.24431,-0.00822,-0.05508,0.01818,0.23388",
				},
				EPSG_4212: {
					towgs84:
						"-267.434,173.496,181.814,-13.4704,8.7154,7.3926,14.7492",
				},
				EPSG_4191: {
					towgs84:
						"-44.183,-0.58,-38.489,2.3867,2.7072,-3.5196,-8.2703",
				},
				EPSG_4237: {
					towgs84:
						"52.684,-71.194,-13.975,-0.312,-0.1063,-0.3729,1.0191",
				},
				EPSG_4740: {
					towgs84: "-1.08,-0.27,-0.9",
				},
				EPSG_4124: {
					towgs84:
						"419.3836,99.3335,591.3451,0.850389,1.817277,-7.862238,-0.99496",
				},
				EPSG_5681: {
					towgs84:
						"584.9636,107.7175,413.8067,1.1155,0.2824,-3.1384,7.9922",
				},
				EPSG_4141: {
					towgs84:
						"23.772,17.49,17.859,-0.3132,-1.85274,1.67299,-5.4262",
				},
				EPSG_4204: {
					towgs84:
						"-85.645,-273.077,-79.708,2.289,-1.421,2.532,3.194",
				},
				EPSG_4319: {
					towgs84:
						"226.702,-193.337,-35.371,-2.229,-4.391,9.238,0.9798",
				},
				EPSG_4200: {
					towgs84: "24.82,-131.21,-82.66",
				},
				EPSG_4130: {
					towgs84: "0,0,0",
				},
				EPSG_4127: {
					towgs84:
						"-82.875,-57.097,-156.768,-2.158,1.524,-0.982,-0.359",
				},
				EPSG_4149: {
					towgs84: "674.374,15.056,405.346",
				},
				EPSG_4617: {
					towgs84: "-0.991,1.9072,0.5129,0.02579,0.00965,0.01166,0",
				},
				EPSG_4663: {
					towgs84:
						"-210.502,-66.902,-48.476,2.094,-15.067,-5.817,0.485",
				},
				EPSG_4664: {
					towgs84: "-211.939,137.626,58.3,-0.089,0.251,0.079,0.384",
				},
				EPSG_4665: {
					towgs84:
						"-105.854,165.589,-38.312,-0.003,-0.026,0.024,-0.048",
				},
				EPSG_4666: {
					towgs84: "631.392,-66.551,481.442,1.09,-4.445,-4.487,-4.43",
				},
				EPSG_4756: {
					towgs84:
						"-192.873,-39.382,-111.202,-0.00205,-0.0005,0.00335,0.0188",
				},
				EPSG_4723: {
					towgs84:
						"-179.483,-69.379,-27.584,-7.862,8.163,6.042,-13.925",
				},
				EPSG_4726: {
					towgs84: "8.853,-52.644,180.304,-0.393,-2.323,2.96,-24.081",
				},
				EPSG_4267: {
					towgs84: "-8.0,160.0,176.0",
				},
				EPSG_5365: {
					towgs84:
						"-0.16959,0.35312,0.51846,0.03385,-0.16325,0.03446,0.03693",
				},
				EPSG_4218: {
					towgs84: "304.5,306.5,-318.1",
				},
				EPSG_4242: {
					towgs84: "-33.722,153.789,94.959,-8.581,-4.478,4.54,8.95",
				},
				EPSG_4216: {
					towgs84:
						"-292.295,248.758,429.447,4.9971,2.99,6.6906,1.0289",
				},
				ESRI_104105: {
					towgs84: "631.392,-66.551,481.442,1.09,-4.445,-4.487,-4.43",
				},
				ESRI_104129: {
					towgs84: "0,0,0",
				},
				EPSG_4673: {
					towgs84: "174.05,-25.49,112.57",
				},
				EPSG_4202: {
					towgs84: "-124,-60,154",
				},
				EPSG_4203: {
					towgs84: "-117.763,-51.51,139.061,0.292,0.443,0.277,-0.191",
				},
				EPSG_3819: {
					towgs84: "595.48,121.69,515.35,4.115,-2.9383,0.853,-3.408",
				},
				EPSG_8694: {
					towgs84:
						"-93.799,-132.737,-219.073,-1.844,0.648,-6.37,-0.169",
				},
				EPSG_4145: {
					towgs84: "275.57,676.78,229.6",
				},
				EPSG_4283: {
					towgs84:
						"0.06155,-0.01087,-0.04019,0.039492,0.032722,0.032898,-0.009994",
				},
				EPSG_4317: {
					towgs84:
						"2.3287,-147.0425,-92.0802,-0.309248,0.324822,0.497299,5.689063",
				},
				EPSG_4272: {
					towgs84: "59.47,-5.04,187.44,0.47,-0.1,1.024,-4.5993",
				},
				EPSG_4248: {
					towgs84: "-307.7,265.3,-363.5",
				},
				EPSG_5561: {
					towgs84: "24,-121,-76",
				},
				EPSG_5233: {
					towgs84:
						"-0.293,766.95,87.713,0.195704,1.695068,3.473016,-0.039338",
				},
				ESRI_104130: {
					towgs84: "-86,-98,-119",
				},
				ESRI_104102: {
					towgs84: "682,-203,480",
				},
				ESRI_37207: {
					towgs84: "7,-10,-26",
				},
				EPSG_4675: {
					towgs84: "59.935,118.4,-10.871",
				},
				ESRI_104109: {
					towgs84: "-89.121,-348.182,260.871",
				},
				ESRI_104112: {
					towgs84: "-185.583,-230.096,281.361",
				},
				ESRI_104113: {
					towgs84: "25.1,-275.6,222.6",
				},
				IGNF_WGS72G: {
					towgs84: "0,12,6",
				},
				IGNF_NTFG: {
					towgs84: "-168,-60,320",
				},
				IGNF_EFATE57G: {
					towgs84: "-127,-769,472",
				},
				IGNF_PGP50G: {
					towgs84: "324.8,153.6,172.1",
				},
				IGNF_REUN47G: {
					towgs84: "94,-948,-1262",
				},
				IGNF_CSG67G: {
					towgs84: "-186,230,110",
				},
				IGNF_GUAD48G: {
					towgs84: "-467,-16,-300",
				},
				IGNF_TAHI51G: {
					towgs84: "162,117,154",
				},
				IGNF_TAHAAG: {
					towgs84: "65,342,77",
				},
				IGNF_NUKU72G: {
					towgs84: "84,274,65",
				},
				IGNF_PETRELS72G: {
					towgs84: "365,194,166",
				},
				IGNF_WALL78G: {
					towgs84: "253,-133,-127",
				},
				IGNF_MAYO50G: {
					towgs84: "-382,-59,-262",
				},
				IGNF_TANNAG: {
					towgs84: "-139,-967,436",
				},
				IGNF_IGN72G: {
					towgs84: "-13,-348,292",
				},
				IGNF_ATIGG: {
					towgs84: "1118,23,66",
				},
				IGNF_FANGA84G: {
					towgs84: "150.57,158.33,118.32",
				},
				IGNF_RUSAT84G: {
					towgs84: "202.13,174.6,-15.74",
				},
				IGNF_KAUE70G: {
					towgs84: "126.74,300.1,-75.49",
				},
				IGNF_MOP90G: {
					towgs84: "-10.8,-1.8,12.77",
				},
				IGNF_MHPF67G: {
					towgs84: "338.08,212.58,-296.17",
				},
				IGNF_TAHI79G: {
					towgs84: "160.61,116.05,153.69",
				},
				IGNF_ANAA92G: {
					towgs84: "1.5,3.84,4.81",
				},
				IGNF_MARQUI72G: {
					towgs84: "330.91,-13.92,58.56",
				},
				IGNF_APAT86G: {
					towgs84: "143.6,197.82,74.05",
				},
				IGNF_TUBU69G: {
					towgs84: "237.17,171.61,-77.84",
				},
				IGNF_STPM50G: {
					towgs84: "11.363,424.148,373.13",
				},
				EPSG_4150: {
					towgs84: "674.374,15.056,405.346",
				},
				EPSG_4754: {
					towgs84: "-208.4058,-109.8777,-2.5764",
				},
				ESRI_104101: {
					towgs84: "372.87,149.23,585.29",
				},
				EPSG_4693: {
					towgs84: "0,-0.15,0.68",
				},
				EPSG_6207: {
					towgs84: "293.17,726.18,245.36",
				},
				EPSG_4153: {
					towgs84: "-133.63,-157.5,-158.62",
				},
				EPSG_4132: {
					towgs84: "-241.54,-163.64,396.06",
				},
				EPSG_4221: {
					towgs84: "-154.5,150.7,100.4",
				},
				EPSG_4266: {
					towgs84: "-80.7,-132.5,41.1",
				},
				EPSG_4193: {
					towgs84: "-70.9,-151.8,-41.4",
				},
				EPSG_5340: {
					towgs84: "-0.41,0.46,-0.35",
				},
				EPSG_4246: {
					towgs84: "-294.7,-200.1,525.5",
				},
				EPSG_4318: {
					towgs84: "-3.2,-5.7,2.8",
				},
				EPSG_4121: {
					towgs84: "-199.87,74.79,246.62",
				},
				EPSG_4223: {
					towgs84: "-260.1,5.5,432.2",
				},
				EPSG_4158: {
					towgs84: "-0.465,372.095,171.736",
				},
				EPSG_4285: {
					towgs84: "-128.16,-282.42,21.93",
				},
				EPSG_4613: {
					towgs84: "-404.78,685.68,45.47",
				},
				EPSG_4607: {
					towgs84: "195.671,332.517,274.607",
				},
				EPSG_4475: {
					towgs84: "-381.788,-57.501,-256.673",
				},
				EPSG_4208: {
					towgs84: "-157.84,308.54,-146.6",
				},
				EPSG_4743: {
					towgs84: "70.995,-335.916,262.898",
				},
				EPSG_4710: {
					towgs84: "-323.65,551.39,-491.22",
				},
				EPSG_7881: {
					towgs84: "-0.077,0.079,0.086",
				},
				EPSG_4682: {
					towgs84: "283.729,735.942,261.143",
				},
				EPSG_4739: {
					towgs84: "-156,-271,-189",
				},
				EPSG_4679: {
					towgs84: "-80.01,253.26,291.19",
				},
				EPSG_4750: {
					towgs84: "-56.263,16.136,-22.856",
				},
				EPSG_4644: {
					towgs84: "-10.18,-350.43,291.37",
				},
				EPSG_4695: {
					towgs84: "-103.746,-9.614,-255.95",
				},
				EPSG_4292: {
					towgs84: "-355,21,72",
				},
				EPSG_4302: {
					towgs84: "-61.702,284.488,472.052",
				},
				EPSG_4143: {
					towgs84: "-124.76,53,466.79",
				},
				EPSG_4606: {
					towgs84: "-153,153,307",
				},
				EPSG_4699: {
					towgs84: "-770.1,158.4,-498.2",
				},
				EPSG_4247: {
					towgs84: "-273.5,110.6,-357.9",
				},
				EPSG_4160: {
					towgs84: "8.88,184.86,106.69",
				},
				EPSG_4161: {
					towgs84: "-233.43,6.65,173.64",
				},
				EPSG_9251: {
					towgs84: "-9.5,122.9,138.2",
				},
				EPSG_9253: {
					towgs84: "-78.1,101.6,133.3",
				},
				EPSG_4297: {
					towgs84: "-198.383,-240.517,-107.909",
				},
				EPSG_4269: {
					towgs84: "0,0,0",
				},
				EPSG_4301: {
					towgs84: "-147,506,687",
				},
				EPSG_4618: {
					towgs84: "-59,-11,-52",
				},
				EPSG_4612: {
					towgs84: "0,0,0",
				},
				EPSG_4678: {
					towgs84: "44.585,-131.212,-39.544",
				},
				EPSG_4250: {
					towgs84: "-130,29,364",
				},
				EPSG_4144: {
					towgs84: "214,804,268",
				},
				EPSG_4147: {
					towgs84: "-17.51,-108.32,-62.39",
				},
				EPSG_4259: {
					towgs84: "-254.1,-5.36,-100.29",
				},
				EPSG_4164: {
					towgs84: "-76,-138,67",
				},
				EPSG_4211: {
					towgs84: "-378.873,676.002,-46.255",
				},
				EPSG_4182: {
					towgs84: "-422.651,-172.995,84.02",
				},
				EPSG_4224: {
					towgs84: "-143.87,243.37,-33.52",
				},
				EPSG_4225: {
					towgs84: "-205.57,168.77,-4.12",
				},
				EPSG_5527: {
					towgs84: "-67.35,3.88,-38.22",
				},
				EPSG_4752: {
					towgs84: "98,390,-22",
				},
				EPSG_4310: {
					towgs84: "-30,190,89",
				},
				EPSG_9248: {
					towgs84: "-192.26,65.72,132.08",
				},
				EPSG_4680: {
					towgs84: "124.5,-63.5,-281",
				},
				EPSG_4701: {
					towgs84: "-79.9,-158,-168.9",
				},
				EPSG_4706: {
					towgs84: "-146.21,112.63,4.05",
				},
				EPSG_4805: {
					towgs84: "682,-203,480",
				},
				EPSG_4201: {
					towgs84: "-165,-11,206",
				},
				EPSG_4210: {
					towgs84: "-157,-2,-299",
				},
				EPSG_4183: {
					towgs84: "-104,167,-38",
				},
				EPSG_4139: {
					towgs84: "11,72,-101",
				},
				EPSG_4668: {
					towgs84: "-86,-98,-119",
				},
				EPSG_4717: {
					towgs84: "-2,151,181",
				},
				EPSG_4732: {
					towgs84: "102,52,-38",
				},
				EPSG_4280: {
					towgs84: "-377,681,-50",
				},
				EPSG_4209: {
					towgs84: "-138,-105,-289",
				},
				EPSG_4261: {
					towgs84: "31,146,47",
				},
				EPSG_4658: {
					towgs84: "-73,46,-86",
				},
				EPSG_4721: {
					towgs84: "265.025,384.929,-194.046",
				},
				EPSG_4222: {
					towgs84: "-136,-108,-292",
				},
				EPSG_4601: {
					towgs84: "-255,-15,71",
				},
				EPSG_4602: {
					towgs84: "725,685,536",
				},
				EPSG_4603: {
					towgs84: "72,213.7,93",
				},
				EPSG_4605: {
					towgs84: "9,183,236",
				},
				EPSG_4621: {
					towgs84: "137,248,-430",
				},
				EPSG_4657: {
					towgs84: "-28,199,5",
				},
				EPSG_4316: {
					towgs84: "103.25,-100.4,-307.19",
				},
				EPSG_4642: {
					towgs84: "-13,-348,292",
				},
				EPSG_4698: {
					towgs84: "145,-187,103",
				},
				EPSG_4192: {
					towgs84: "-206.1,-174.7,-87.7",
				},
				EPSG_4311: {
					towgs84: "-265,120,-358",
				},
				EPSG_4135: {
					towgs84: "58,-283,-182",
				},
				ESRI_104138: {
					towgs84: "198,-226,-347",
				},
				EPSG_4245: {
					towgs84: "-11,851,5",
				},
				EPSG_4142: {
					towgs84: "-125,53,467",
				},
				EPSG_4213: {
					towgs84: "-106,-87,188",
				},
				EPSG_4253: {
					towgs84: "-133,-77,-51",
				},
				EPSG_4129: {
					towgs84: "-132,-110,-335",
				},
				EPSG_4713: {
					towgs84: "-77,-128,142",
				},
				EPSG_4239: {
					towgs84: "217,823,299",
				},
				EPSG_4146: {
					towgs84: "295,736,257",
				},
				EPSG_4155: {
					towgs84: "-83,37,124",
				},
				EPSG_4165: {
					towgs84: "-173,253,27",
				},
				EPSG_4672: {
					towgs84: "175,-38,113",
				},
				EPSG_4236: {
					towgs84: "-637,-549,-203",
				},
				EPSG_4251: {
					towgs84: "-90,40,88",
				},
				EPSG_4271: {
					towgs84: "-2,374,172",
				},
				EPSG_4175: {
					towgs84: "-88,4,101",
				},
				EPSG_4716: {
					towgs84: "298,-304,-375",
				},
				EPSG_4315: {
					towgs84: "-23,259,-9",
				},
				EPSG_4744: {
					towgs84: "-242.2,-144.9,370.3",
				},
				EPSG_4244: {
					towgs84: "-97,787,86",
				},
				EPSG_4293: {
					towgs84: "616,97,-251",
				},
				EPSG_4714: {
					towgs84: "-127,-769,472",
				},
				EPSG_4736: {
					towgs84: "260,12,-147",
				},
				EPSG_6883: {
					towgs84: "-235,-110,393",
				},
				EPSG_6894: {
					towgs84: "-63,176,185",
				},
				EPSG_4205: {
					towgs84: "-43,-163,45",
				},
				EPSG_4256: {
					towgs84: "41,-220,-134",
				},
				EPSG_4262: {
					towgs84: "639,405,60",
				},
				EPSG_4604: {
					towgs84: "174,359,365",
				},
				EPSG_4169: {
					towgs84: "-115,118,426",
				},
				EPSG_4620: {
					towgs84: "-106,-129,165",
				},
				EPSG_4184: {
					towgs84: "-203,141,53",
				},
				EPSG_4616: {
					towgs84: "-289,-124,60",
				},
				EPSG_9403: {
					towgs84: "-307,-92,127",
				},
				EPSG_4684: {
					towgs84: "-133,-321,50",
				},
				EPSG_4708: {
					towgs84: "-491,-22,435",
				},
				EPSG_4707: {
					towgs84: "114,-116,-333",
				},
				EPSG_4709: {
					towgs84: "145,75,-272",
				},
				EPSG_4712: {
					towgs84: "-205,107,53",
				},
				EPSG_4711: {
					towgs84: "124,-234,-25",
				},
				EPSG_4718: {
					towgs84: "230,-199,-752",
				},
				EPSG_4719: {
					towgs84: "211,147,111",
				},
				EPSG_4724: {
					towgs84: "208,-435,-229",
				},
				EPSG_4725: {
					towgs84: "189,-79,-202",
				},
				EPSG_4735: {
					towgs84: "647,1777,-1124",
				},
				EPSG_4722: {
					towgs84: "-794,119,-298",
				},
				EPSG_4728: {
					towgs84: "-307,-92,127",
				},
				EPSG_4734: {
					towgs84: "-632,438,-609",
				},
				EPSG_4727: {
					towgs84: "912,-58,1227",
				},
				EPSG_4729: {
					towgs84: "185,165,42",
				},
				EPSG_4730: {
					towgs84: "170,42,84",
				},
				EPSG_4733: {
					towgs84: "276,-57,149",
				},
				ESRI_37218: {
					towgs84: "230,-199,-752",
				},
				ESRI_37240: {
					towgs84: "-7,215,225",
				},
				ESRI_37221: {
					towgs84: "252,-209,-751",
				},
				ESRI_4305: {
					towgs84: "-123,-206,219",
				},
				ESRI_104139: {
					towgs84: "-73,-247,227",
				},
				EPSG_4748: {
					towgs84: "51,391,-36",
				},
				EPSG_4219: {
					towgs84: "-384,664,-48",
				},
				EPSG_4255: {
					towgs84: "-333,-222,114",
				},
				EPSG_4257: {
					towgs84: "-587.8,519.75,145.76",
				},
				EPSG_4646: {
					towgs84: "-963,510,-359",
				},
				EPSG_6881: {
					towgs84: "-24,-203,268",
				},
				EPSG_6882: {
					towgs84: "-183,-15,273",
				},
				EPSG_4715: {
					towgs84: "-104,-129,239",
				},
				IGNF_RGF93GDD: {
					towgs84: "0,0,0",
				},
				IGNF_RGM04GDD: {
					towgs84: "0,0,0",
				},
				IGNF_RGSPM06GDD: {
					towgs84: "0,0,0",
				},
				IGNF_RGTAAF07GDD: {
					towgs84: "0,0,0",
				},
				IGNF_RGFG95GDD: {
					towgs84: "0,0,0",
				},
				IGNF_RGNCG: {
					towgs84: "0,0,0",
				},
				IGNF_RGPFGDD: {
					towgs84: "0,0,0",
				},
				IGNF_ETRS89G: {
					towgs84: "0,0,0",
				},
				IGNF_RGR92GDD: {
					towgs84: "0,0,0",
				},
				EPSG_4173: {
					towgs84: "0,0,0",
				},
				EPSG_4180: {
					towgs84: "0,0,0",
				},
				EPSG_4619: {
					towgs84: "0,0,0",
				},
				EPSG_4667: {
					towgs84: "0,0,0",
				},
				EPSG_4075: {
					towgs84: "0,0,0",
				},
				EPSG_6706: {
					towgs84: "0,0,0",
				},
				EPSG_7798: {
					towgs84: "0,0,0",
				},
				EPSG_4661: {
					towgs84: "0,0,0",
				},
				EPSG_4669: {
					towgs84: "0,0,0",
				},
				EPSG_8685: {
					towgs84: "0,0,0",
				},
				EPSG_4151: {
					towgs84: "0,0,0",
				},
				EPSG_9702: {
					towgs84: "0,0,0",
				},
				EPSG_4758: {
					towgs84: "0,0,0",
				},
				EPSG_4761: {
					towgs84: "0,0,0",
				},
				EPSG_4765: {
					towgs84: "0,0,0",
				},
				EPSG_8997: {
					towgs84: "0,0,0",
				},
				EPSG_4023: {
					towgs84: "0,0,0",
				},
				EPSG_4670: {
					towgs84: "0,0,0",
				},
				EPSG_4694: {
					towgs84: "0,0,0",
				},
				EPSG_4148: {
					towgs84: "0,0,0",
				},
				EPSG_4163: {
					towgs84: "0,0,0",
				},
				EPSG_4167: {
					towgs84: "0,0,0",
				},
				EPSG_4189: {
					towgs84: "0,0,0",
				},
				EPSG_4190: {
					towgs84: "0,0,0",
				},
				EPSG_4176: {
					towgs84: "0,0,0",
				},
				EPSG_4659: {
					towgs84: "0,0,0",
				},
				EPSG_3824: {
					towgs84: "0,0,0",
				},
				EPSG_3889: {
					towgs84: "0,0,0",
				},
				EPSG_4046: {
					towgs84: "0,0,0",
				},
				EPSG_4081: {
					towgs84: "0,0,0",
				},
				EPSG_4558: {
					towgs84: "0,0,0",
				},
				EPSG_4483: {
					towgs84: "0,0,0",
				},
				EPSG_5013: {
					towgs84: "0,0,0",
				},
				EPSG_5264: {
					towgs84: "0,0,0",
				},
				EPSG_5324: {
					towgs84: "0,0,0",
				},
				EPSG_5354: {
					towgs84: "0,0,0",
				},
				EPSG_5371: {
					towgs84: "0,0,0",
				},
				EPSG_5373: {
					towgs84: "0,0,0",
				},
				EPSG_5381: {
					towgs84: "0,0,0",
				},
				EPSG_5393: {
					towgs84: "0,0,0",
				},
				EPSG_5489: {
					towgs84: "0,0,0",
				},
				EPSG_5593: {
					towgs84: "0,0,0",
				},
				EPSG_6135: {
					towgs84: "0,0,0",
				},
				EPSG_6365: {
					towgs84: "0,0,0",
				},
				EPSG_5246: {
					towgs84: "0,0,0",
				},
				EPSG_7886: {
					towgs84: "0,0,0",
				},
				EPSG_8431: {
					towgs84: "0,0,0",
				},
				EPSG_8427: {
					towgs84: "0,0,0",
				},
				EPSG_8699: {
					towgs84: "0,0,0",
				},
				EPSG_8818: {
					towgs84: "0,0,0",
				},
				EPSG_4757: {
					towgs84: "0,0,0",
				},
				EPSG_9140: {
					towgs84: "0,0,0",
				},
				EPSG_8086: {
					towgs84: "0,0,0",
				},
				EPSG_4686: {
					towgs84: "0,0,0",
				},
				EPSG_4737: {
					towgs84: "0,0,0",
				},
				EPSG_4702: {
					towgs84: "0,0,0",
				},
				EPSG_4747: {
					towgs84: "0,0,0",
				},
				EPSG_4749: {
					towgs84: "0,0,0",
				},
				EPSG_4674: {
					towgs84: "0,0,0",
				},
				EPSG_4755: {
					towgs84: "0,0,0",
				},
				EPSG_4759: {
					towgs84: "0,0,0",
				},
				EPSG_4762: {
					towgs84: "0,0,0",
				},
				EPSG_4763: {
					towgs84: "0,0,0",
				},
				EPSG_4764: {
					towgs84: "0,0,0",
				},
				EPSG_4166: {
					towgs84: "0,0,0",
				},
				EPSG_4170: {
					towgs84: "0,0,0",
				},
				EPSG_5546: {
					towgs84: "0,0,0",
				},
				EPSG_7844: {
					towgs84: "0,0,0",
				},
				EPSG_4818: {
					towgs84: "589,76,480",
				},
				EPSG_10328: {
					towgs84: "0,0,0",
				},
				EPSG_9782: {
					towgs84: "0,0,0",
				},
				EPSG_9777: {
					towgs84: "0,0,0",
				},
				EPSG_10690: {
					towgs84: "0,0,0",
				},
				EPSG_10639: {
					towgs84: "0,0,0",
				},
				EPSG_10739: {
					towgs84: "0,0,0",
				},
				EPSG_7686: {
					towgs84: "0,0,0",
				},
				EPSG_8900: {
					towgs84: "0,0,0",
				},
				EPSG_5886: {
					towgs84: "0,0,0",
				},
				EPSG_7683: {
					towgs84: "0,0,0",
				},
				EPSG_6668: {
					towgs84: "0,0,0",
				},
				EPSG_20046: {
					towgs84: "0,0,0",
				},
				EPSG_10299: {
					towgs84: "0,0,0",
				},
				EPSG_10310: {
					towgs84: "0,0,0",
				},
				EPSG_10475: {
					towgs84: "0,0,0",
				},
				EPSG_4742: {
					towgs84: "0,0,0",
				},
				EPSG_10671: {
					towgs84: "0,0,0",
				},
				EPSG_10762: {
					towgs84: "0,0,0",
				},
				EPSG_10725: {
					towgs84: "0,0,0",
				},
				EPSG_10791: {
					towgs84: "0,0,0",
				},
				EPSG_10800: {
					towgs84: "0,0,0",
				},
				EPSG_10305: {
					towgs84: "0,0,0",
				},
				EPSG_10941: {
					towgs84: "0,0,0",
				},
				EPSG_10968: {
					towgs84: "0,0,0",
				},
				EPSG_10875: {
					towgs84: "0,0,0",
				},
				EPSG_6318: {
					towgs84: "0,0,0",
				},
				EPSG_10910: {
					towgs84: "0,0,0",
				},
			};
			for (var key in datums) {
				var datum$1 = datums[key];
				if (!datum$1.datumName) {
					continue;
				}
				datums[datum$1.datumName] = datum$1;
			}
			function datum(datumCode, datum_params, a, b, es, ep2, nadgrids) {
				var out = {};
				out.datum_type = PJD_NODATUM;
				if (datum_params) {
					out.datum_type = PJD_WGS84;
					out.datum_params = datum_params.map(parseFloat);
					if (
						out.datum_params[0] !== 0 ||
						out.datum_params[1] !== 0 ||
						out.datum_params[2] !== 0
					) {
						out.datum_type = PJD_3PARAM;
					}
					if (out.datum_params.length > 3) {
						if (
							out.datum_params[3] !== 0 ||
							out.datum_params[4] !== 0 ||
							out.datum_params[5] !== 0 ||
							out.datum_params[6] !== 0
						) {
							out.datum_type = PJD_7PARAM;
							out.datum_params[3] *= SEC_TO_RAD;
							out.datum_params[4] *= SEC_TO_RAD;
							out.datum_params[5] *= SEC_TO_RAD;
							out.datum_params[6] = out.datum_params[6] / 1e6 + 1;
						}
					}
				}
				if (nadgrids) {
					out.datum_type = PJD_GRIDSHIFT;
					out.grids = nadgrids;
				}
				out.a = a;
				out.b = b;
				out.es = es;
				out.ep2 = ep2;
				return out;
			}
			var loadedNadgrids = {};
			function nadgrid(key2, data, options) {
				if (data instanceof ArrayBuffer) {
					return readNTV2Grid(key2, data, options);
				}
				return { ready: readGeotiffGrid(key2, data) };
			}
			function readNTV2Grid(key2, data, options) {
				var includeErrorFields = true;
				if (
					options !== void 0 &&
					options.includeErrorFields === false
				) {
					includeErrorFields = false;
				}
				var view = new DataView(data);
				var isLittleEndian = detectLittleEndian(view);
				var header = readHeader(view, isLittleEndian);
				var subgrids = readSubgrids(
					view,
					header,
					isLittleEndian,
					includeErrorFields,
				);
				var nadgrid2 = { header, subgrids };
				loadedNadgrids[key2] = nadgrid2;
				return nadgrid2;
			}
			async function readGeotiffGrid(key2, tiff) {
				var subgrids = [];
				var subGridCount = await tiff.getImageCount();
				for (
					var subgridIndex = subGridCount - 1;
					subgridIndex >= 0;
					subgridIndex--
				) {
					var image = await tiff.getImage(subgridIndex);
					var rasters = await image.readRasters();
					var data = rasters;
					var lim = [image.getWidth(), image.getHeight()];
					var imageBBoxRadians = image
						.getBoundingBox()
						.map(degreesToRadians);
					var modelPixelScale =
						typeof image.fileDirectory.getValue === "function"
							? image.fileDirectory.getValue("ModelPixelScale")
							: /** @type {any} */
								image.fileDirectory.ModelPixelScale;
					var del = [modelPixelScale[0], modelPixelScale[1]].map(
						degreesToRadians,
					);
					var maxX = imageBBoxRadians[0] + (lim[0] - 1) * del[0];
					var minY = imageBBoxRadians[3] - (lim[1] - 1) * del[1];
					var latitudeOffsetBand = data[0];
					var longitudeOffsetBand = data[1];
					var nodes = [];
					for (let i = lim[1] - 1; i >= 0; i--) {
						for (let j = lim[0] - 1; j >= 0; j--) {
							var index = i * lim[0] + j;
							nodes.push([
								-secondsToRadians(longitudeOffsetBand[index]),
								secondsToRadians(latitudeOffsetBand[index]),
							]);
						}
					}
					subgrids.push({
						del,
						lim,
						ll: [-maxX, minY],
						cvs: nodes,
					});
				}
				var tifGrid = {
					header: {
						nSubgrids: subGridCount,
					},
					subgrids,
				};
				loadedNadgrids[key2] = tifGrid;
				return tifGrid;
			}
			function getNadgrids(nadgrids) {
				if (nadgrids === void 0) {
					return null;
				}
				var grids = nadgrids.split(",");
				return grids.map(parseNadgridString);
			}
			function parseNadgridString(value) {
				if (value.length === 0) {
					return null;
				}
				var optional = value[0] === "@";
				if (optional) {
					value = value.slice(1);
				}
				if (value === "null") {
					return {
						name: "null",
						mandatory: !optional,
						grid: null,
						isNull: true,
					};
				}
				return {
					name: value,
					mandatory: !optional,
					grid: loadedNadgrids[value] || null,
					isNull: false,
				};
			}
			function degreesToRadians(degrees) {
				return (degrees * Math.PI) / 180;
			}
			function secondsToRadians(seconds) {
				return ((seconds / 3600) * Math.PI) / 180;
			}
			function detectLittleEndian(view) {
				var nFields = view.getInt32(8, false);
				if (nFields === 11) {
					return false;
				}
				nFields = view.getInt32(8, true);
				if (nFields !== 11) {
					console.warn(
						"Failed to detect nadgrid endian-ness, defaulting to little-endian",
					);
				}
				return true;
			}
			function readHeader(view, isLittleEndian) {
				return {
					nFields: view.getInt32(8, isLittleEndian),
					nSubgridFields: view.getInt32(24, isLittleEndian),
					nSubgrids: view.getInt32(40, isLittleEndian),
					shiftType: decodeString(view, 56, 56 + 8).trim(),
					fromSemiMajorAxis: view.getFloat64(120, isLittleEndian),
					fromSemiMinorAxis: view.getFloat64(136, isLittleEndian),
					toSemiMajorAxis: view.getFloat64(152, isLittleEndian),
					toSemiMinorAxis: view.getFloat64(168, isLittleEndian),
				};
			}
			function decodeString(view, start2, end) {
				return String.fromCharCode.apply(
					null,
					new Uint8Array(view.buffer.slice(start2, end)),
				);
			}
			function readSubgrids(
				view,
				header,
				isLittleEndian,
				includeErrorFields,
			) {
				var gridOffset2 = 176;
				var grids = [];
				for (var i = 0; i < header.nSubgrids; i++) {
					var subHeader = readGridHeader(
						view,
						gridOffset2,
						isLittleEndian,
					);
					var nodes = readGridNodes(
						view,
						gridOffset2,
						subHeader,
						isLittleEndian,
						includeErrorFields,
					);
					var lngColumnCount = Math.round(
						1 +
							(subHeader.upperLongitude -
								subHeader.lowerLongitude) /
								subHeader.longitudeInterval,
					);
					var latColumnCount = Math.round(
						1 +
							(subHeader.upperLatitude -
								subHeader.lowerLatitude) /
								subHeader.latitudeInterval,
					);
					grids.push({
						ll: [
							secondsToRadians(subHeader.lowerLongitude),
							secondsToRadians(subHeader.lowerLatitude),
						],
						del: [
							secondsToRadians(subHeader.longitudeInterval),
							secondsToRadians(subHeader.latitudeInterval),
						],
						lim: [lngColumnCount, latColumnCount],
						count: subHeader.gridNodeCount,
						cvs: mapNodes(nodes),
					});
					var rowSize = 16;
					if (includeErrorFields === false) {
						rowSize = 8;
					}
					gridOffset2 += 176 + subHeader.gridNodeCount * rowSize;
				}
				return grids;
			}
			function mapNodes(nodes) {
				return nodes.map(function (r) {
					return [
						secondsToRadians(r.longitudeShift),
						secondsToRadians(r.latitudeShift),
					];
				});
			}
			function readGridHeader(view, offset, isLittleEndian) {
				return {
					name: decodeString(view, offset + 8, offset + 16).trim(),
					parent: decodeString(
						view,
						offset + 24,
						offset + 24 + 8,
					).trim(),
					lowerLatitude: view.getFloat64(offset + 72, isLittleEndian),
					upperLatitude: view.getFloat64(offset + 88, isLittleEndian),
					lowerLongitude: view.getFloat64(
						offset + 104,
						isLittleEndian,
					),
					upperLongitude: view.getFloat64(
						offset + 120,
						isLittleEndian,
					),
					latitudeInterval: view.getFloat64(
						offset + 136,
						isLittleEndian,
					),
					longitudeInterval: view.getFloat64(
						offset + 152,
						isLittleEndian,
					),
					gridNodeCount: view.getInt32(offset + 168, isLittleEndian),
				};
			}
			function readGridNodes(
				view,
				offset,
				gridHeader,
				isLittleEndian,
				includeErrorFields,
			) {
				var nodesOffset = offset + 176;
				var gridRecordLength = 16;
				if (includeErrorFields === false) {
					gridRecordLength = 8;
				}
				var gridShiftRecords = [];
				for (var i = 0; i < gridHeader.gridNodeCount; i++) {
					var record = {
						latitudeShift: view.getFloat32(
							nodesOffset + i * gridRecordLength,
							isLittleEndian,
						),
						longitudeShift: view.getFloat32(
							nodesOffset + i * gridRecordLength + 4,
							isLittleEndian,
						),
					};
					if (includeErrorFields !== false) {
						record.latitudeAccuracy = view.getFloat32(
							nodesOffset + i * gridRecordLength + 8,
							isLittleEndian,
						);
						record.longitudeAccuracy = view.getFloat32(
							nodesOffset + i * gridRecordLength + 12,
							isLittleEndian,
						);
					}
					gridShiftRecords.push(record);
				}
				return gridShiftRecords;
			}
			function Projection(srsCode, callback) {
				if (!(this instanceof Projection)) {
					return new Projection(srsCode);
				}
				this.forward = null;
				this.inverse = null;
				this.init = null;
				this.name;
				this.axis;
				this.names = null;
				this.title;
				callback =
					callback ||
					function (error) {
						if (error) {
							throw error;
						}
					};
				var json = parse(srsCode);
				if (typeof json !== "object") {
					callback("Could not parse to valid json: " + srsCode);
					return;
				}
				var ourProj = Projection.projections.get(json.projName);
				if (!ourProj) {
					callback("Could not get projection name from: " + srsCode);
					return;
				}
				if (json.datumCode && json.datumCode !== "none") {
					var datumDef = match(datums, json.datumCode);
					if (datumDef) {
						json.datum_params =
							json.datum_params ||
							(datumDef.towgs84
								? datumDef.towgs84.split(",")
								: null);
						json.ellps = datumDef.ellipse;
						json.datumName = datumDef.datumName
							? datumDef.datumName
							: json.datumCode;
					}
				}
				json.axis = json.axis || "enu";
				json.ellps = json.ellps || "wgs84";
				json.lat1 = json.lat1 || json.lat0;
				var sphere_ = sphere(
					json.a,
					json.b,
					json.rf,
					json.ellps,
					json.sphere,
				);
				var ecc = eccentricity(
					sphere_.a,
					sphere_.b,
					sphere_.rf,
					json.R_A,
				);
				var nadgrids = getNadgrids(json.nadgrids);
				var datumObj =
					json.datum ||
					datum(
						json.datumCode,
						json.datum_params,
						sphere_.a,
						sphere_.b,
						ecc.es,
						ecc.ep2,
						nadgrids,
					);
				extend(this, json);
				extend(this, ourProj);
				this.a = sphere_.a;
				this.b = sphere_.b;
				this.rf = sphere_.rf;
				this.sphere = sphere_.sphere;
				this.es = ecc.es;
				this.e = ecc.e;
				this.ep2 = ecc.ep2;
				this.datum = datumObj;
				if ("init" in this && typeof this.init === "function") {
					this.init();
				}
				if (!this.k0) {
					this.k0 = 1;
				}
				callback(null, this);
			}
			Projection.projections = projections;
			Projection.projections.start();
			function compareDatums(source, dest) {
				if (source.datum_type !== dest.datum_type) {
					return false;
				} else if (
					source.a !== dest.a ||
					Math.abs(source.es - dest.es) > 5e-11
				) {
					return false;
				} else if (source.datum_type === PJD_3PARAM) {
					return (
						source.datum_params[0] === dest.datum_params[0] &&
						source.datum_params[1] === dest.datum_params[1] &&
						source.datum_params[2] === dest.datum_params[2]
					);
				} else if (source.datum_type === PJD_7PARAM) {
					return (
						source.datum_params[0] === dest.datum_params[0] &&
						source.datum_params[1] === dest.datum_params[1] &&
						source.datum_params[2] === dest.datum_params[2] &&
						source.datum_params[3] === dest.datum_params[3] &&
						source.datum_params[4] === dest.datum_params[4] &&
						source.datum_params[5] === dest.datum_params[5] &&
						source.datum_params[6] === dest.datum_params[6]
					);
				} else {
					return true;
				}
			}
			function geodeticToGeocentric(p, es, a) {
				var Longitude = p.x;
				var Latitude = p.y;
				var Height = p.z ? p.z : 0;
				var Rn;
				var Sin_Lat;
				var Sin2_Lat;
				var Cos_Lat;
				if (Latitude < -HALF_PI && Latitude > -1.001 * HALF_PI) {
					Latitude = -HALF_PI;
				} else if (Latitude > HALF_PI && Latitude < 1.001 * HALF_PI) {
					Latitude = HALF_PI;
				} else if (Latitude < -HALF_PI) {
					return { x: -Infinity, y: -Infinity, z: p.z };
				} else if (Latitude > HALF_PI) {
					return { x: Infinity, y: Infinity, z: p.z };
				}
				if (Longitude > Math.PI) {
					Longitude -= 2 * Math.PI;
				}
				Sin_Lat = Math.sin(Latitude);
				Cos_Lat = Math.cos(Latitude);
				Sin2_Lat = Sin_Lat * Sin_Lat;
				Rn = a / Math.sqrt(1 - es * Sin2_Lat);
				return {
					x: (Rn + Height) * Cos_Lat * Math.cos(Longitude),
					y: (Rn + Height) * Cos_Lat * Math.sin(Longitude),
					z: (Rn * (1 - es) + Height) * Sin_Lat,
				};
			}
			function geocentricToGeodetic(p, es, a, b) {
				var genau = 1e-12;
				var genau2 = genau * genau;
				var maxiter = 30;
				var P;
				var RR;
				var CT;
				var ST;
				var RX;
				var RK;
				var RN;
				var CPHI0;
				var SPHI0;
				var CPHI;
				var SPHI;
				var SDPHI;
				var iter;
				var X = p.x;
				var Y = p.y;
				var Z2 = p.z ? p.z : 0;
				var Longitude;
				var Latitude;
				var Height;
				P = Math.sqrt(X * X + Y * Y);
				RR = Math.sqrt(X * X + Y * Y + Z2 * Z2);
				if (P / a < genau) {
					Longitude = 0;
					if (RR / a < genau) {
						Latitude = HALF_PI;
						Height = -b;
						return {
							x: p.x,
							y: p.y,
							z: p.z,
						};
					}
				} else {
					Longitude = Math.atan2(Y, X);
				}
				CT = Z2 / RR;
				ST = P / RR;
				RX = 1 / Math.sqrt(1 - es * (2 - es) * ST * ST);
				CPHI0 = ST * (1 - es) * RX;
				SPHI0 = CT * RX;
				iter = 0;
				do {
					iter++;
					RN = a / Math.sqrt(1 - es * SPHI0 * SPHI0);
					Height =
						P * CPHI0 + Z2 * SPHI0 - RN * (1 - es * SPHI0 * SPHI0);
					RK = (es * RN) / (RN + Height);
					RX = 1 / Math.sqrt(1 - RK * (2 - RK) * ST * ST);
					CPHI = ST * (1 - RK) * RX;
					SPHI = CT * RX;
					SDPHI = SPHI * CPHI0 - CPHI * SPHI0;
					CPHI0 = CPHI;
					SPHI0 = SPHI;
				} while (SDPHI * SDPHI > genau2 && iter < maxiter);
				Latitude = Math.atan(SPHI / Math.abs(CPHI));
				return {
					x: Longitude,
					y: Latitude,
					z: Height,
				};
			}
			function geocentricToWgs84(p, datum_type, datum_params) {
				if (datum_type === PJD_3PARAM) {
					return {
						x: p.x + datum_params[0],
						y: p.y + datum_params[1],
						z: p.z + datum_params[2],
					};
				} else if (datum_type === PJD_7PARAM) {
					var Dx_BF = datum_params[0];
					var Dy_BF = datum_params[1];
					var Dz_BF = datum_params[2];
					var Rx_BF = datum_params[3];
					var Ry_BF = datum_params[4];
					var Rz_BF = datum_params[5];
					var M_BF = datum_params[6];
					return {
						x: M_BF * (p.x - Rz_BF * p.y + Ry_BF * p.z) + Dx_BF,
						y: M_BF * (Rz_BF * p.x + p.y - Rx_BF * p.z) + Dy_BF,
						z: M_BF * (-Ry_BF * p.x + Rx_BF * p.y + p.z) + Dz_BF,
					};
				}
			}
			function geocentricFromWgs84(p, datum_type, datum_params) {
				if (datum_type === PJD_3PARAM) {
					return {
						x: p.x - datum_params[0],
						y: p.y - datum_params[1],
						z: p.z - datum_params[2],
					};
				} else if (datum_type === PJD_7PARAM) {
					var Dx_BF = datum_params[0];
					var Dy_BF = datum_params[1];
					var Dz_BF = datum_params[2];
					var Rx_BF = datum_params[3];
					var Ry_BF = datum_params[4];
					var Rz_BF = datum_params[5];
					var M_BF = datum_params[6];
					var x_tmp = (p.x - Dx_BF) / M_BF;
					var y_tmp = (p.y - Dy_BF) / M_BF;
					var z_tmp = (p.z - Dz_BF) / M_BF;
					return {
						x: x_tmp + Rz_BF * y_tmp - Ry_BF * z_tmp,
						y: -Rz_BF * x_tmp + y_tmp + Rx_BF * z_tmp,
						z: Ry_BF * x_tmp - Rx_BF * y_tmp + z_tmp,
					};
				}
			}
			function checkParams(type) {
				return type === PJD_3PARAM || type === PJD_7PARAM;
			}
			function datum_transform(source, dest, point) {
				if (compareDatums(source, dest)) {
					return point;
				}
				if (
					source.datum_type === PJD_NODATUM ||
					dest.datum_type === PJD_NODATUM
				) {
					return point;
				}
				var source_a = source.a;
				var source_es = source.es;
				if (source.datum_type === PJD_GRIDSHIFT) {
					var gridShiftCode = applyGridShift(source, false, point);
					if (gridShiftCode !== 0) {
						return void 0;
					}
					source_a = SRS_WGS84_SEMIMAJOR;
					source_es = SRS_WGS84_ESQUARED;
				}
				var dest_a = dest.a;
				var dest_b = dest.b;
				var dest_es = dest.es;
				if (dest.datum_type === PJD_GRIDSHIFT) {
					dest_a = SRS_WGS84_SEMIMAJOR;
					dest_b = SRS_WGS84_SEMIMINOR;
					dest_es = SRS_WGS84_ESQUARED;
				}
				if (
					source_es === dest_es &&
					source_a === dest_a &&
					!checkParams(source.datum_type) &&
					!checkParams(dest.datum_type)
				) {
					return point;
				}
				point = geodeticToGeocentric(point, source_es, source_a);
				if (checkParams(source.datum_type)) {
					point = geocentricToWgs84(
						point,
						source.datum_type,
						source.datum_params,
					);
				}
				if (checkParams(dest.datum_type)) {
					point = geocentricFromWgs84(
						point,
						dest.datum_type,
						dest.datum_params,
					);
				}
				point = geocentricToGeodetic(point, dest_es, dest_a, dest_b);
				if (dest.datum_type === PJD_GRIDSHIFT) {
					var destGridShiftResult = applyGridShift(dest, true, point);
					if (destGridShiftResult !== 0) {
						return void 0;
					}
				}
				return point;
			}
			function applyGridShift(source, inverse2, point) {
				if (source.grids === null || source.grids.length === 0) {
					console.log("Grid shift grids not found");
					return -1;
				}
				var input = { x: -point.x, y: point.y };
				var output = { x: Number.NaN, y: Number.NaN };
				var attemptedGrids = [];
				outer: for (var i = 0; i < source.grids.length; i++) {
					var grid = source.grids[i];
					attemptedGrids.push(grid.name);
					if (grid.isNull) {
						output = input;
						break;
					}
					if (grid.grid === null) {
						if (grid.mandatory) {
							console.log(
								"Unable to find mandatory grid '" +
									grid.name +
									"'",
							);
							return -1;
						}
						continue;
					}
					var subgrids = grid.grid.subgrids;
					for (var j = 0, jj = subgrids.length; j < jj; j++) {
						var subgrid = subgrids[j];
						var epsilon =
							(Math.abs(subgrid.del[1]) +
								Math.abs(subgrid.del[0])) /
							1e4;
						var minX = subgrid.ll[0] - epsilon;
						var minY = subgrid.ll[1] - epsilon;
						var maxX =
							subgrid.ll[0] +
							(subgrid.lim[0] - 1) * subgrid.del[0] +
							epsilon;
						var maxY =
							subgrid.ll[1] +
							(subgrid.lim[1] - 1) * subgrid.del[1] +
							epsilon;
						if (
							minY > input.y ||
							minX > input.x ||
							maxY < input.y ||
							maxX < input.x
						) {
							continue;
						}
						output = applySubgridShift(input, inverse2, subgrid);
						if (!isNaN(output.x)) {
							break outer;
						}
					}
				}
				if (isNaN(output.x)) {
					console.log(
						"Failed to find a grid shift table for location '" +
							-input.x * R2D +
							" " +
							input.y * R2D +
							" tried: '" +
							attemptedGrids +
							"'",
					);
					return -1;
				}
				point.x = -output.x;
				point.y = output.y;
				return 0;
			}
			function applySubgridShift(pin, inverse2, ct) {
				var val = { x: Number.NaN, y: Number.NaN };
				if (isNaN(pin.x)) {
					return val;
				}
				var tb = { x: pin.x, y: pin.y };
				tb.x -= ct.ll[0];
				tb.y -= ct.ll[1];
				tb.x = adjust_lon(tb.x - Math.PI) + Math.PI;
				var t = nadInterpolate(tb, ct);
				if (inverse2) {
					if (isNaN(t.x)) {
						return val;
					}
					t.x = tb.x - t.x;
					t.y = tb.y - t.y;
					var i = 9,
						tol = 1e-12;
					var dif, del;
					do {
						del = nadInterpolate(t, ct);
						if (isNaN(del.x)) {
							console.log(
								"Inverse grid shift iteration failed, presumably at grid edge.  Using first approximation.",
							);
							break;
						}
						dif = {
							x: tb.x - (del.x + t.x),
							y: tb.y - (del.y + t.y),
						};
						t.x += dif.x;
						t.y += dif.y;
					} while (
						i-- &&
						Math.abs(dif.x) > tol &&
						Math.abs(dif.y) > tol
					);
					if (i < 0) {
						console.log(
							"Inverse grid shift iterator failed to converge.",
						);
						return val;
					}
					val.x = adjust_lon(t.x + ct.ll[0]);
					val.y = t.y + ct.ll[1];
				} else {
					if (!isNaN(t.x)) {
						val.x = pin.x + t.x;
						val.y = pin.y + t.y;
					}
				}
				return val;
			}
			function nadInterpolate(pin, ct) {
				var t = { x: pin.x / ct.del[0], y: pin.y / ct.del[1] };
				var indx = { x: Math.floor(t.x), y: Math.floor(t.y) };
				var frct = { x: t.x - 1 * indx.x, y: t.y - 1 * indx.y };
				var val = { x: Number.NaN, y: Number.NaN };
				var inx;
				if (indx.x < 0 || indx.x >= ct.lim[0]) {
					return val;
				}
				if (indx.y < 0 || indx.y >= ct.lim[1]) {
					return val;
				}
				inx = indx.y * ct.lim[0] + indx.x;
				var f00 = { x: ct.cvs[inx][0], y: ct.cvs[inx][1] };
				inx++;
				var f10 = { x: ct.cvs[inx][0], y: ct.cvs[inx][1] };
				inx += ct.lim[0];
				var f11 = { x: ct.cvs[inx][0], y: ct.cvs[inx][1] };
				inx--;
				var f01 = { x: ct.cvs[inx][0], y: ct.cvs[inx][1] };
				var m11 = frct.x * frct.y,
					m10 = frct.x * (1 - frct.y),
					m00 = (1 - frct.x) * (1 - frct.y),
					m01 = (1 - frct.x) * frct.y;
				val.x = m00 * f00.x + m10 * f10.x + m01 * f01.x + m11 * f11.x;
				val.y = m00 * f00.y + m10 * f10.y + m01 * f01.y + m11 * f11.y;
				return val;
			}
			var order = ["x", "y", "z"];
			function adjustAxisToEnu(crs, point) {
				const out = {};
				for (let i = 0, ii = crs.axis.length; i < ii; i++) {
					if (i === 2 && point.z === void 0) {
						continue;
					}
					let v = point[order[i]];
					switch (crs.axis[i]) {
						case "e":
							out.x = v;
							break;
						case "w":
							out.x = -v;
							break;
						case "n":
							out.y = v;
							break;
						case "s":
							out.y = -v;
							break;
						case "u":
							out.z = v;
							break;
						case "d":
							out.z = -v;
							break;
						default:
							return null;
					}
				}
				return out;
			}
			function adjustAxisFromEnu(crs, point) {
				const out =
					/** @type {import("./core").InterfaceCoordinates} */
					{};
				for (let i = 0, ii = crs.axis.length; i < ii; i++) {
					if (i === 2 && point.z === void 0) {
						continue;
					}
					switch (crs.axis[i]) {
						case "e":
							out[order[i]] = point.x;
							break;
						case "w":
							out[order[i]] = -point.x;
							break;
						case "n":
							out[order[i]] = point.y;
							break;
						case "s":
							out[order[i]] = -point.y;
							break;
						case "u":
							out[order[i]] = point.z;
							break;
						case "d":
							out[order[i]] = -point.z;
							break;
						default:
							return null;
					}
				}
				return out;
			}
			function common(array) {
				var out = {
					x: array[0],
					y: array[1],
				};
				if (array.length > 2) {
					out.z = array[2];
				}
				if (array.length > 3) {
					out.m = array[3];
				}
				return out;
			}
			function checkSanity(point) {
				checkCoord(point.x);
				checkCoord(point.y);
			}
			function checkCoord(num) {
				if (typeof Number.isFinite === "function") {
					if (Number.isFinite(num)) {
						return;
					}
					throw new TypeError("coordinates must be finite numbers");
				}
				if (typeof num !== "number" || num !== num || !isFinite(num)) {
					throw new TypeError("coordinates must be finite numbers");
				}
			}
			function checkNotWGS(source, dest) {
				return (
					((source.datum.datum_type === PJD_3PARAM ||
						source.datum.datum_type === PJD_7PARAM ||
						source.datum.datum_type === PJD_GRIDSHIFT) &&
						dest.datumCode !== "WGS84") ||
					((dest.datum.datum_type === PJD_3PARAM ||
						dest.datum.datum_type === PJD_7PARAM ||
						dest.datum.datum_type === PJD_GRIDSHIFT) &&
						source.datumCode !== "WGS84")
				);
			}
			function transformInternal(source, dest, point, enforceAxis) {
				var wgs842;
				var hasZ = point.z !== void 0;
				checkSanity(point);
				if (source.datum && dest.datum && checkNotWGS(source, dest)) {
					wgs842 = new Projection("WGS84");
					point = transformInternal(
						source,
						wgs842,
						point,
						enforceAxis,
					);
					source = wgs842;
				}
				if (enforceAxis && source.axis !== "enu") {
					point = adjustAxisToEnu(source, point);
				}
				if (source.projName === "longlat") {
					point = {
						x: point.x * D2R$1,
						y: point.y * D2R$1,
						z: point.z || 0,
					};
				} else {
					if (source.to_meter) {
						point = {
							x: point.x * source.to_meter,
							y: point.y * source.to_meter,
							z: point.z || 0,
						};
					}
					point = source.inverse(point);
					if (!point) {
						return;
					}
				}
				if (source.from_greenwich) {
					point.x += source.from_greenwich;
				}
				point = datum_transform(source.datum, dest.datum, point);
				if (!point) {
					return;
				}
				point =
					/** @type {import('./core').InterfaceCoordinates} */
					point;
				if (dest.from_greenwich) {
					point = {
						x: point.x - dest.from_greenwich,
						y: point.y,
						z: point.z || 0,
					};
				}
				if (dest.projName === "longlat") {
					if (dest.long_wrap !== void 0) {
						point.x =
							dest.long_wrap +
							adjust_lon(point.x - dest.long_wrap);
					}
					point = {
						x: point.x * R2D,
						y: point.y * R2D,
						z: point.z || 0,
					};
				} else {
					point = dest.forward(point);
					if (dest.to_meter) {
						point = {
							x: point.x / dest.to_meter,
							y: point.y / dest.to_meter,
							z: point.z || 0,
						};
					}
				}
				if (enforceAxis && dest.axis !== "enu") {
					return adjustAxisFromEnu(dest, point);
				}
				if (point && !hasZ && dest.projName !== "geocent") {
					delete point.z;
				}
				return point;
			}
			function transform(source, dest, point, enforceAxis) {
				var pt;
				if (Array.isArray(point)) {
					pt = common(point);
				} else {
					pt = { x: point.x, y: point.y, z: point.z, m: point.m };
				}
				return transformInternal(source, dest, pt, enforceAxis);
			}
			var wgs84 = Projection("WGS84");
			function transformer(from, to, coords, enforceAxis) {
				var out, geocent2, keys;
				if (Array.isArray(coords)) {
					out = transformInternal(
						from,
						to,
						common(coords),
						enforceAxis,
					) || { x: NaN, y: NaN };
					if (coords.length > 2) {
						geocent2 =
							(typeof from.name !== "undefined" &&
								from.name === "geocent") ||
							(typeof to.name !== "undefined" &&
								to.name === "geocent");
						if (geocent2) {
							if (typeof out.z === "number") {
								return (
									/** @type {T} */
									[out.x, out.y, out.z].concat(
										coords.slice(3),
									)
								);
							}
							return (
								/** @type {T} */
								[out.x, out.y, coords[2]].concat(
									coords.slice(3),
								)
							);
						}
						if (enforceAxis && typeof out.z === "number") {
							return (
								/** @type {T} */
								[out.x, out.y, out.z].concat(coords.slice(3))
							);
						}
						return (
							/** @type {T} */
							[out.x, out.y].concat(coords.slice(2))
						);
					}
					return (
						/** @type {T} */
						[out.x, out.y]
					);
				} else {
					out = transformInternal(
						from,
						to,
						{ x: coords.x, y: coords.y, z: coords.z, m: coords.m },
						enforceAxis,
					) || { x: NaN, y: NaN };
					keys = Object.keys(coords);
					if (keys.length === 2) {
						return (
							/** @type {T} */
							out
						);
					}
					geocent2 =
						(typeof from.name !== "undefined" &&
							from.name === "geocent") ||
						(typeof to.name !== "undefined" &&
							to.name === "geocent");
					keys.forEach(function (key2) {
						if (key2 === "x" || key2 === "y") {
							return;
						}
						if (key2 === "z" && (geocent2 || enforceAxis)) {
							return;
						}
						out[key2] = coords[key2];
					});
					return (
						/** @type {T} */
						out
					);
				}
			}
			function checkProj(item) {
				if (item instanceof Projection) {
					return item;
				}
				if (typeof item === "object" && "oProj" in item) {
					return item.oProj;
				}
				return Projection(
					/** @type {string | PROJJSONDefinition} */
					item,
				);
			}
			function proj4$1(fromProjOrToProj, toProjOrCoord, coord) {
				var fromProj;
				var toProj;
				var single = false;
				var obj;
				if (typeof toProjOrCoord === "undefined") {
					toProj = checkProj(fromProjOrToProj);
					fromProj = wgs84;
					single = true;
				} else if (
					typeof (/** @type {?} */ toProjOrCoord.x) !== "undefined" ||
					Array.isArray(toProjOrCoord)
				) {
					coord =
						/** @type {T} */
						/** @type {?} */
						toProjOrCoord;
					toProj = checkProj(fromProjOrToProj);
					fromProj = wgs84;
					single = true;
				}
				if (!fromProj) {
					fromProj = checkProj(fromProjOrToProj);
				}
				if (!toProj) {
					toProj = checkProj(
						/** @type {string | PROJJSONDefinition | proj } */
						toProjOrCoord,
					);
				}
				if (coord) {
					return transformer(fromProj, toProj, coord);
				} else {
					obj = {
						/**
						 * @template {TemplateCoordinates} T
						 * @param {T} coords
						 * @param {boolean=} enforceAxis
						 * @returns {T}
						 */
						forward: function (coords, enforceAxis) {
							return transformer(
								fromProj,
								toProj,
								coords,
								enforceAxis,
							);
						},
						/**
						 * @template {TemplateCoordinates} T
						 * @param {T} coords
						 * @param {boolean=} enforceAxis
						 * @returns {T}
						 */
						inverse: function (coords, enforceAxis) {
							return transformer(
								toProj,
								fromProj,
								coords,
								enforceAxis,
							);
						},
					};
					if (single) {
						obj.oProj = toProj;
					}
					return obj;
				}
			}
			var NUM_100K_SETS = 6;
			var SET_ORIGIN_COLUMN_LETTERS = "AJSAJS";
			var SET_ORIGIN_ROW_LETTERS = "AFAFAF";
			var A3 = 65;
			var I = 73;
			var O = 79;
			var V = 86;
			var Z = 90;
			var mgrs = {
				forward: forward$w,
				inverse: inverse$w,
				toPoint,
			};
			function forward$w(ll, accuracy) {
				accuracy = accuracy || 5;
				return encode(
					LLtoUTM({
						lat: ll[1],
						lon: ll[0],
					}),
					accuracy,
				);
			}
			function inverse$w(mgrs2) {
				var bbox = UTMtoLL(decode(mgrs2.toUpperCase()));
				if (bbox.lat && bbox.lon) {
					return [bbox.lon, bbox.lat, bbox.lon, bbox.lat];
				}
				return [bbox.left, bbox.bottom, bbox.right, bbox.top];
			}
			function toPoint(mgrs2) {
				var bbox = UTMtoLL(decode(mgrs2.toUpperCase()));
				if (bbox.lat && bbox.lon) {
					return [bbox.lon, bbox.lat];
				}
				return [
					(bbox.left + bbox.right) / 2,
					(bbox.top + bbox.bottom) / 2,
				];
			}
			function degToRad(deg) {
				return deg * (Math.PI / 180);
			}
			function radToDeg(rad) {
				return 180 * (rad / Math.PI);
			}
			function LLtoUTM(ll) {
				var Lat = ll.lat;
				var Long = ll.lon;
				var a = 6378137;
				var eccSquared = 669438e-8;
				var k0 = 0.9996;
				var LongOrigin;
				var eccPrimeSquared;
				var N, T, C, A5, M2;
				var LatRad = degToRad(Lat);
				var LongRad = degToRad(Long);
				var LongOriginRad;
				var ZoneNumber;
				ZoneNumber = Math.floor((Long + 180) / 6) + 1;
				if (Long === 180) {
					ZoneNumber = 60;
				}
				if (Lat >= 56 && Lat < 64 && Long >= 3 && Long < 12) {
					ZoneNumber = 32;
				}
				if (Lat >= 72 && Lat < 84) {
					if (Long >= 0 && Long < 9) {
						ZoneNumber = 31;
					} else if (Long >= 9 && Long < 21) {
						ZoneNumber = 33;
					} else if (Long >= 21 && Long < 33) {
						ZoneNumber = 35;
					} else if (Long >= 33 && Long < 42) {
						ZoneNumber = 37;
					}
				}
				LongOrigin = (ZoneNumber - 1) * 6 - 180 + 3;
				LongOriginRad = degToRad(LongOrigin);
				eccPrimeSquared = eccSquared / (1 - eccSquared);
				N =
					a /
					Math.sqrt(
						1 - eccSquared * Math.sin(LatRad) * Math.sin(LatRad),
					);
				T = Math.tan(LatRad) * Math.tan(LatRad);
				C = eccPrimeSquared * Math.cos(LatRad) * Math.cos(LatRad);
				A5 = Math.cos(LatRad) * (LongRad - LongOriginRad);
				M2 =
					a *
					((1 -
						eccSquared / 4 -
						(3 * eccSquared * eccSquared) / 64 -
						(5 * eccSquared * eccSquared * eccSquared) / 256) *
						LatRad -
						((3 * eccSquared) / 8 +
							(3 * eccSquared * eccSquared) / 32 +
							(45 * eccSquared * eccSquared * eccSquared) /
								1024) *
							Math.sin(2 * LatRad) +
						((15 * eccSquared * eccSquared) / 256 +
							(45 * eccSquared * eccSquared * eccSquared) /
								1024) *
							Math.sin(4 * LatRad) -
						((35 * eccSquared * eccSquared * eccSquared) / 3072) *
							Math.sin(6 * LatRad));
				var UTMEasting =
					k0 *
						N *
						(A5 +
							((1 - T + C) * A5 * A5 * A5) / 6 +
							((5 -
								18 * T +
								T * T +
								72 * C -
								58 * eccPrimeSquared) *
								A5 *
								A5 *
								A5 *
								A5 *
								A5) /
								120) +
					5e5;
				var UTMNorthing =
					k0 *
					(M2 +
						N *
							Math.tan(LatRad) *
							((A5 * A5) / 2 +
								((5 - T + 9 * C + 4 * C * C) *
									A5 *
									A5 *
									A5 *
									A5) /
									24 +
								((61 -
									58 * T +
									T * T +
									600 * C -
									330 * eccPrimeSquared) *
									A5 *
									A5 *
									A5 *
									A5 *
									A5 *
									A5) /
									720));
				if (Lat < 0) {
					UTMNorthing += 1e7;
				}
				return {
					northing: Math.round(UTMNorthing),
					easting: Math.round(UTMEasting),
					zoneNumber: ZoneNumber,
					zoneLetter: getLetterDesignator(Lat),
				};
			}
			function UTMtoLL(utm2) {
				var UTMNorthing = utm2.northing;
				var UTMEasting = utm2.easting;
				var zoneLetter = utm2.zoneLetter;
				var zoneNumber = utm2.zoneNumber;
				if (zoneNumber < 0 || zoneNumber > 60) {
					return null;
				}
				var k0 = 0.9996;
				var a = 6378137;
				var eccSquared = 669438e-8;
				var eccPrimeSquared;
				var e1 =
					(1 - Math.sqrt(1 - eccSquared)) /
					(1 + Math.sqrt(1 - eccSquared));
				var N1, T1, C12, R1, D, M2;
				var LongOrigin;
				var mu, phi1Rad;
				var x = UTMEasting - 5e5;
				var y = UTMNorthing;
				if (zoneLetter < "N") {
					y -= 1e7;
				}
				LongOrigin = (zoneNumber - 1) * 6 - 180 + 3;
				eccPrimeSquared = eccSquared / (1 - eccSquared);
				M2 = y / k0;
				mu =
					M2 /
					(a *
						(1 -
							eccSquared / 4 -
							(3 * eccSquared * eccSquared) / 64 -
							(5 * eccSquared * eccSquared * eccSquared) / 256));
				phi1Rad =
					mu +
					((3 * e1) / 2 - (27 * e1 * e1 * e1) / 32) *
						Math.sin(2 * mu) +
					((21 * e1 * e1) / 16 - (55 * e1 * e1 * e1 * e1) / 32) *
						Math.sin(4 * mu) +
					((151 * e1 * e1 * e1) / 96) * Math.sin(6 * mu);
				N1 =
					a /
					Math.sqrt(
						1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad),
					);
				T1 = Math.tan(phi1Rad) * Math.tan(phi1Rad);
				C12 = eccPrimeSquared * Math.cos(phi1Rad) * Math.cos(phi1Rad);
				R1 =
					(a * (1 - eccSquared)) /
					Math.pow(
						1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad),
						1.5,
					);
				D = x / (N1 * k0);
				var lat =
					phi1Rad -
					((N1 * Math.tan(phi1Rad)) / R1) *
						((D * D) / 2 -
							((5 +
								3 * T1 +
								10 * C12 -
								4 * C12 * C12 -
								9 * eccPrimeSquared) *
								D *
								D *
								D *
								D) /
								24 +
							((61 +
								90 * T1 +
								298 * C12 +
								45 * T1 * T1 -
								252 * eccPrimeSquared -
								3 * C12 * C12) *
								D *
								D *
								D *
								D *
								D *
								D) /
								720);
				lat = radToDeg(lat);
				var lon =
					(D -
						((1 + 2 * T1 + C12) * D * D * D) / 6 +
						((5 -
							2 * C12 +
							28 * T1 -
							3 * C12 * C12 +
							8 * eccPrimeSquared +
							24 * T1 * T1) *
							D *
							D *
							D *
							D *
							D) /
							120) /
					Math.cos(phi1Rad);
				lon = LongOrigin + radToDeg(lon);
				var result;
				if (utm2.accuracy) {
					var topRight = UTMtoLL({
						northing: utm2.northing + utm2.accuracy,
						easting: utm2.easting + utm2.accuracy,
						zoneLetter: utm2.zoneLetter,
						zoneNumber: utm2.zoneNumber,
					});
					result = {
						top: topRight.lat,
						right: topRight.lon,
						bottom: lat,
						left: lon,
					};
				} else {
					result = {
						lat,
						lon,
					};
				}
				return result;
			}
			function getLetterDesignator(lat) {
				var LetterDesignator = "Z";
				if (84 >= lat && lat >= 72) {
					LetterDesignator = "X";
				} else if (72 > lat && lat >= 64) {
					LetterDesignator = "W";
				} else if (64 > lat && lat >= 56) {
					LetterDesignator = "V";
				} else if (56 > lat && lat >= 48) {
					LetterDesignator = "U";
				} else if (48 > lat && lat >= 40) {
					LetterDesignator = "T";
				} else if (40 > lat && lat >= 32) {
					LetterDesignator = "S";
				} else if (32 > lat && lat >= 24) {
					LetterDesignator = "R";
				} else if (24 > lat && lat >= 16) {
					LetterDesignator = "Q";
				} else if (16 > lat && lat >= 8) {
					LetterDesignator = "P";
				} else if (8 > lat && lat >= 0) {
					LetterDesignator = "N";
				} else if (0 > lat && lat >= -8) {
					LetterDesignator = "M";
				} else if (-8 > lat && lat >= -16) {
					LetterDesignator = "L";
				} else if (-16 > lat && lat >= -24) {
					LetterDesignator = "K";
				} else if (-24 > lat && lat >= -32) {
					LetterDesignator = "J";
				} else if (-32 > lat && lat >= -40) {
					LetterDesignator = "H";
				} else if (-40 > lat && lat >= -48) {
					LetterDesignator = "G";
				} else if (-48 > lat && lat >= -56) {
					LetterDesignator = "F";
				} else if (-56 > lat && lat >= -64) {
					LetterDesignator = "E";
				} else if (-64 > lat && lat >= -72) {
					LetterDesignator = "D";
				} else if (-72 > lat && lat >= -80) {
					LetterDesignator = "C";
				}
				return LetterDesignator;
			}
			function encode(utm2, accuracy) {
				var seasting = "00000" + utm2.easting,
					snorthing = "00000" + utm2.northing;
				return (
					utm2.zoneNumber +
					utm2.zoneLetter +
					get100kID(utm2.easting, utm2.northing, utm2.zoneNumber) +
					seasting.substr(seasting.length - 5, accuracy) +
					snorthing.substr(snorthing.length - 5, accuracy)
				);
			}
			function get100kID(easting, northing, zoneNumber) {
				var setParm = get100kSetForZone(zoneNumber);
				var setColumn = Math.floor(easting / 1e5);
				var setRow = Math.floor(northing / 1e5) % 20;
				return getLetter100kID(setColumn, setRow, setParm);
			}
			function get100kSetForZone(i) {
				var setParm = i % NUM_100K_SETS;
				if (setParm === 0) {
					setParm = NUM_100K_SETS;
				}
				return setParm;
			}
			function getLetter100kID(column, row, parm) {
				var index = parm - 1;
				var colOrigin = SET_ORIGIN_COLUMN_LETTERS.charCodeAt(index);
				var rowOrigin = SET_ORIGIN_ROW_LETTERS.charCodeAt(index);
				var colInt = colOrigin + column - 1;
				var rowInt = rowOrigin + row;
				var rollover = false;
				if (colInt > Z) {
					colInt = colInt - Z + A3 - 1;
					rollover = true;
				}
				if (
					colInt === I ||
					(colOrigin < I && colInt > I) ||
					((colInt > I || colOrigin < I) && rollover)
				) {
					colInt++;
				}
				if (
					colInt === O ||
					(colOrigin < O && colInt > O) ||
					((colInt > O || colOrigin < O) && rollover)
				) {
					colInt++;
					if (colInt === I) {
						colInt++;
					}
				}
				if (colInt > Z) {
					colInt = colInt - Z + A3 - 1;
				}
				if (rowInt > V) {
					rowInt = rowInt - V + A3 - 1;
					rollover = true;
				} else {
					rollover = false;
				}
				if (
					rowInt === I ||
					(rowOrigin < I && rowInt > I) ||
					((rowInt > I || rowOrigin < I) && rollover)
				) {
					rowInt++;
				}
				if (
					rowInt === O ||
					(rowOrigin < O && rowInt > O) ||
					((rowInt > O || rowOrigin < O) && rollover)
				) {
					rowInt++;
					if (rowInt === I) {
						rowInt++;
					}
				}
				if (rowInt > V) {
					rowInt = rowInt - V + A3 - 1;
				}
				var twoLetter =
					String.fromCharCode(colInt) + String.fromCharCode(rowInt);
				return twoLetter;
			}
			function decode(mgrsString) {
				if (mgrsString && mgrsString.length === 0) {
					throw "MGRSPoint coverting from nothing";
				}
				var length = mgrsString.length;
				var hunK = null;
				var sb = "";
				var testChar;
				var i = 0;
				while (!/[A-Z]/.test((testChar = mgrsString.charAt(i)))) {
					if (i >= 2) {
						throw "MGRSPoint bad conversion from: " + mgrsString;
					}
					sb += testChar;
					i++;
				}
				var zoneNumber = parseInt(sb, 10);
				if (i === 0 || i + 3 > length) {
					throw "MGRSPoint bad conversion from: " + mgrsString;
				}
				var zoneLetter = mgrsString.charAt(i++);
				if (
					zoneLetter <= "A" ||
					zoneLetter === "B" ||
					zoneLetter === "Y" ||
					zoneLetter >= "Z" ||
					zoneLetter === "I" ||
					zoneLetter === "O"
				) {
					throw (
						"MGRSPoint zone letter " +
						zoneLetter +
						" not handled: " +
						mgrsString
					);
				}
				hunK = mgrsString.substring(i, (i += 2));
				var set = get100kSetForZone(zoneNumber);
				var east100k = getEastingFromChar(hunK.charAt(0), set);
				var north100k = getNorthingFromChar(hunK.charAt(1), set);
				while (north100k < getMinNorthing(zoneLetter)) {
					north100k += 2e6;
				}
				var remainder = length - i;
				if (remainder % 2 !== 0) {
					throw (
						"MGRSPoint has to have an even number \nof digits after the zone letter and two 100km letters - front \nhalf for easting meters, second half for \nnorthing meters" +
						mgrsString
					);
				}
				var sep = remainder / 2;
				var sepEasting = 0;
				var sepNorthing = 0;
				var accuracyBonus,
					sepEastingString,
					sepNorthingString,
					easting,
					northing;
				if (sep > 0) {
					accuracyBonus = 1e5 / Math.pow(10, sep);
					sepEastingString = mgrsString.substring(i, i + sep);
					sepEasting = parseFloat(sepEastingString) * accuracyBonus;
					sepNorthingString = mgrsString.substring(i + sep);
					sepNorthing = parseFloat(sepNorthingString) * accuracyBonus;
				}
				easting = sepEasting + east100k;
				northing = sepNorthing + north100k;
				return {
					easting,
					northing,
					zoneLetter,
					zoneNumber,
					accuracy: accuracyBonus,
				};
			}
			function getEastingFromChar(e, set) {
				var curCol = SET_ORIGIN_COLUMN_LETTERS.charCodeAt(set - 1);
				var eastingValue = 1e5;
				var rewindMarker = false;
				while (curCol !== e.charCodeAt(0)) {
					curCol++;
					if (curCol === I) {
						curCol++;
					}
					if (curCol === O) {
						curCol++;
					}
					if (curCol > Z) {
						if (rewindMarker) {
							throw "Bad character: " + e;
						}
						curCol = A3;
						rewindMarker = true;
					}
					eastingValue += 1e5;
				}
				return eastingValue;
			}
			function getNorthingFromChar(n, set) {
				if (n > "V") {
					throw "MGRSPoint given invalid Northing " + n;
				}
				var curRow = SET_ORIGIN_ROW_LETTERS.charCodeAt(set - 1);
				var northingValue = 0;
				var rewindMarker = false;
				while (curRow !== n.charCodeAt(0)) {
					curRow++;
					if (curRow === I) {
						curRow++;
					}
					if (curRow === O) {
						curRow++;
					}
					if (curRow > V) {
						if (rewindMarker) {
							throw "Bad character: " + n;
						}
						curRow = A3;
						rewindMarker = true;
					}
					northingValue += 1e5;
				}
				return northingValue;
			}
			function getMinNorthing(zoneLetter) {
				var northing;
				switch (zoneLetter) {
					case "C":
						northing = 11e5;
						break;
					case "D":
						northing = 2e6;
						break;
					case "E":
						northing = 28e5;
						break;
					case "F":
						northing = 37e5;
						break;
					case "G":
						northing = 46e5;
						break;
					case "H":
						northing = 55e5;
						break;
					case "J":
						northing = 64e5;
						break;
					case "K":
						northing = 73e5;
						break;
					case "L":
						northing = 82e5;
						break;
					case "M":
						northing = 91e5;
						break;
					case "N":
						northing = 0;
						break;
					case "P":
						northing = 8e5;
						break;
					case "Q":
						northing = 17e5;
						break;
					case "R":
						northing = 26e5;
						break;
					case "S":
						northing = 35e5;
						break;
					case "T":
						northing = 44e5;
						break;
					case "U":
						northing = 53e5;
						break;
					case "V":
						northing = 62e5;
						break;
					case "W":
						northing = 7e6;
						break;
					case "X":
						northing = 79e5;
						break;
					default:
						northing = -1;
				}
				if (northing >= 0) {
					return northing;
				} else {
					throw "Invalid zone letter: " + zoneLetter;
				}
			}
			function Point(x, y, z) {
				if (!(this instanceof Point)) {
					return new Point(x, y, z);
				}
				if (Array.isArray(x)) {
					this.x = x[0];
					this.y = x[1];
					this.z = x[2] || 0;
				} else if (typeof x === "object") {
					this.x = x.x;
					this.y = x.y;
					this.z = x.z || 0;
				} else if (typeof x === "string" && typeof y === "undefined") {
					var coords = x.split(",");
					this.x = parseFloat(coords[0]);
					this.y = parseFloat(coords[1]);
					this.z = parseFloat(coords[2]) || 0;
				} else {
					this.x = x;
					this.y = y;
					this.z = z || 0;
				}
				console.warn(
					"proj4.Point will be removed in version 3, use proj4.toPoint",
				);
			}
			Point.fromMGRS = function (mgrsStr) {
				return new Point(toPoint(mgrsStr));
			};
			Point.prototype.toMGRS = function (accuracy) {
				return forward$w([this.x, this.y], accuracy);
			};
			var C00 = 1;
			var C02 = 0.25;
			var C04 = 0.046875;
			var C06 = 0.01953125;
			var C08 = 0.01068115234375;
			var C22 = 0.75;
			var C44 = 0.46875;
			var C46 = 0.013020833333333334;
			var C48 = 0.007120768229166667;
			var C66 = 0.3645833333333333;
			var C68 = 0.005696614583333333;
			var C88 = 0.3076171875;
			function pj_enfn(es) {
				var en = [];
				en[0] = C00 - es * (C02 + es * (C04 + es * (C06 + es * C08)));
				en[1] = es * (C22 - es * (C04 + es * (C06 + es * C08)));
				var t = es * es;
				en[2] = t * (C44 - es * (C46 + es * C48));
				t *= es;
				en[3] = t * (C66 - es * C68);
				en[4] = t * es * C88;
				return en;
			}
			function pj_mlfn(phi, sphi, cphi, en) {
				cphi *= sphi;
				sphi *= sphi;
				return (
					en[0] * phi -
					cphi *
						(en[1] + sphi * (en[2] + sphi * (en[3] + sphi * en[4])))
				);
			}
			var MAX_ITER$3 = 20;
			function pj_inv_mlfn(arg, es, en) {
				var k = 1 / (1 - es);
				var phi = arg;
				for (var i = MAX_ITER$3; i; --i) {
					var s = Math.sin(phi);
					var t = 1 - es * s * s;
					t =
						(pj_mlfn(phi, s, Math.cos(phi), en) - arg) *
						(t * Math.sqrt(t)) *
						k;
					phi -= t;
					if (Math.abs(t) < EPSLN) {
						return phi;
					}
				}
				return phi;
			}
			function init$x() {
				this.x0 = this.x0 !== void 0 ? this.x0 : 0;
				this.y0 = this.y0 !== void 0 ? this.y0 : 0;
				this.long0 = this.long0 !== void 0 ? this.long0 : 0;
				this.lat0 = this.lat0 !== void 0 ? this.lat0 : 0;
				if (this.es) {
					this.en = pj_enfn(this.es);
					this.ml0 = pj_mlfn(
						this.lat0,
						Math.sin(this.lat0),
						Math.cos(this.lat0),
						this.en,
					);
				}
			}
			function forward$v(p) {
				var lon = p.x;
				var lat = p.y;
				var delta_lon = adjust_lon(lon - this.long0, this.over);
				var con;
				var x, y;
				var sin_phi = Math.sin(lat);
				var cos_phi = Math.cos(lat);
				if (!this.es) {
					var b = cos_phi * Math.sin(delta_lon);
					if (Math.abs(Math.abs(b) - 1) < EPSLN) {
						return 93;
					} else {
						x =
							0.5 *
								this.a *
								this.k0 *
								Math.log((1 + b) / (1 - b)) +
							this.x0;
						y =
							(cos_phi * Math.cos(delta_lon)) /
							Math.sqrt(1 - Math.pow(b, 2));
						b = Math.abs(y);
						if (b >= 1) {
							if (b - 1 > EPSLN) {
								return 93;
							} else {
								y = 0;
							}
						} else {
							y = Math.acos(y);
						}
						if (lat < 0) {
							y = -y;
						}
						y = this.a * this.k0 * (y - this.lat0) + this.y0;
					}
				} else {
					var al = cos_phi * delta_lon;
					var als = Math.pow(al, 2);
					var c = this.ep2 * Math.pow(cos_phi, 2);
					var cs = Math.pow(c, 2);
					var tq = Math.abs(cos_phi) > EPSLN ? Math.tan(lat) : 0;
					var t = Math.pow(tq, 2);
					var ts = Math.pow(t, 2);
					con = 1 - this.es * Math.pow(sin_phi, 2);
					al = al / Math.sqrt(con);
					var ml = pj_mlfn(lat, sin_phi, cos_phi, this.en);
					x =
						this.a *
							(this.k0 *
								al *
								(1 +
									(als / 6) *
										(1 -
											t +
											c +
											(als / 20) *
												(5 -
													18 * t +
													ts +
													14 * c -
													58 * t * c +
													(als / 42) *
														(61 +
															179 * ts -
															ts * t -
															479 * t))))) +
						this.x0;
					y =
						this.a *
							(this.k0 *
								(ml -
									this.ml0 +
									((sin_phi * delta_lon * al) / 2) *
										(1 +
											(als / 12) *
												(5 -
													t +
													9 * c +
													4 * cs +
													(als / 30) *
														(61 +
															ts -
															58 * t +
															270 * c -
															330 * t * c +
															(als / 56) *
																(1385 +
																	543 * ts -
																	ts * t -
																	3111 *
																		t)))))) +
						this.y0;
				}
				p.x = x;
				p.y = y;
				return p;
			}
			function inverse$v(p) {
				var con, phi;
				var lat, lon;
				var x = (p.x - this.x0) * (1 / this.a);
				var y = (p.y - this.y0) * (1 / this.a);
				if (!this.es) {
					var f = Math.exp(x / this.k0);
					var g = 0.5 * (f - 1 / f);
					var temp = this.lat0 + y / this.k0;
					var h = Math.cos(temp);
					con = Math.sqrt(
						(1 - Math.pow(h, 2)) / (1 + Math.pow(g, 2)),
					);
					lat = Math.asin(con);
					if (y < 0) {
						lat = -lat;
					}
					if (g === 0 && h === 0) {
						lon = 0;
					} else {
						lon = adjust_lon(
							Math.atan2(g, h) + this.long0,
							this.over,
						);
					}
				} else {
					con = this.ml0 + y / this.k0;
					phi = pj_inv_mlfn(con, this.es, this.en);
					if (Math.abs(phi) < HALF_PI) {
						var sin_phi = Math.sin(phi);
						var cos_phi = Math.cos(phi);
						var tan_phi =
							Math.abs(cos_phi) > EPSLN ? Math.tan(phi) : 0;
						var c = this.ep2 * Math.pow(cos_phi, 2);
						var cs = Math.pow(c, 2);
						var t = Math.pow(tan_phi, 2);
						var ts = Math.pow(t, 2);
						con = 1 - this.es * Math.pow(sin_phi, 2);
						var d = (x * Math.sqrt(con)) / this.k0;
						var ds = Math.pow(d, 2);
						con = con * tan_phi;
						lat =
							phi -
							((con * ds) / (1 - this.es)) *
								0.5 *
								(1 -
									(ds / 12) *
										(5 +
											3 * t -
											9 * c * t +
											c -
											4 * cs -
											(ds / 30) *
												(61 +
													90 * t -
													252 * c * t +
													45 * ts +
													46 * c -
													(ds / 56) *
														(1385 +
															3633 * t +
															4095 * ts +
															1574 * ts * t))));
						lon = adjust_lon(
							this.long0 +
								(d *
									(1 -
										(ds / 6) *
											(1 +
												2 * t +
												c -
												(ds / 20) *
													(5 +
														28 * t +
														24 * ts +
														8 * c * t +
														6 * c -
														(ds / 42) *
															(61 +
																662 * t +
																1320 * ts +
																720 *
																	ts *
																	t))))) /
									cos_phi,
							this.over,
						);
					} else {
						lat = HALF_PI * sign(y);
						lon = 0;
					}
				}
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$w = [
				"Fast_Transverse_Mercator",
				"Fast Transverse Mercator",
			];
			var tmerc = {
				init: init$x,
				forward: forward$v,
				inverse: inverse$v,
				names: names$w,
			};
			function sinh(x) {
				var r = Math.exp(x);
				r = (r - 1 / r) / 2;
				return r;
			}
			function hypot(x, y) {
				x = Math.abs(x);
				y = Math.abs(y);
				var a = Math.max(x, y);
				var b = Math.min(x, y) / (a ? a : 1);
				return a * Math.sqrt(1 + Math.pow(b, 2));
			}
			function log1py(x) {
				var y = 1 + x;
				var z = y - 1;
				return z === 0 ? x : (x * Math.log(y)) / z;
			}
			function asinhy(x) {
				var y = Math.abs(x);
				y = log1py(y * (1 + y / (hypot(1, y) + 1)));
				return x < 0 ? -y : y;
			}
			function gatg(pp, B) {
				var cos_2B = 2 * Math.cos(2 * B);
				var i = pp.length - 1;
				var h1 = pp[i];
				var h2 = 0;
				var h;
				while (--i >= 0) {
					h = -h2 + cos_2B * h1 + pp[i];
					h2 = h1;
					h1 = h;
				}
				return B + h * Math.sin(2 * B);
			}
			function clens(pp, arg_r) {
				var r = 2 * Math.cos(arg_r);
				var i = pp.length - 1;
				var hr1 = pp[i];
				var hr2 = 0;
				var hr;
				while (--i >= 0) {
					hr = -hr2 + r * hr1 + pp[i];
					hr2 = hr1;
					hr1 = hr;
				}
				return Math.sin(arg_r) * hr;
			}
			function cosh(x) {
				var r = Math.exp(x);
				r = (r + 1 / r) / 2;
				return r;
			}
			function clens_cmplx(pp, arg_r, arg_i) {
				var sin_arg_r = Math.sin(arg_r);
				var cos_arg_r = Math.cos(arg_r);
				var sinh_arg_i = sinh(arg_i);
				var cosh_arg_i = cosh(arg_i);
				var r = 2 * cos_arg_r * cosh_arg_i;
				var i = -2 * sin_arg_r * sinh_arg_i;
				var j = pp.length - 1;
				var hr = pp[j];
				var hi1 = 0;
				var hr1 = 0;
				var hi = 0;
				var hr2;
				var hi2;
				while (--j >= 0) {
					hr2 = hr1;
					hi2 = hi1;
					hr1 = hr;
					hi1 = hi;
					hr = -hr2 + r * hr1 - i * hi1 + pp[j];
					hi = -hi2 + i * hr1 + r * hi1;
				}
				r = sin_arg_r * cosh_arg_i;
				i = cos_arg_r * sinh_arg_i;
				return [r * hr - i * hi, r * hi + i * hr];
			}
			function init$w() {
				if (!this.approx && (isNaN(this.es) || this.es <= 0)) {
					throw new Error(
						'Incorrect elliptical usage. Try using the +approx option in the proj string, or PROJECTION["Fast_Transverse_Mercator"] in the WKT.',
					);
				}
				if (this.approx) {
					tmerc.init.apply(this);
					this.forward = tmerc.forward;
					this.inverse = tmerc.inverse;
				}
				this.x0 = this.x0 !== void 0 ? this.x0 : 0;
				this.y0 = this.y0 !== void 0 ? this.y0 : 0;
				this.long0 = this.long0 !== void 0 ? this.long0 : 0;
				this.lat0 = this.lat0 !== void 0 ? this.lat0 : 0;
				this.k0 = this.k0 !== void 0 ? this.k0 : 1;
				this.cgb = [];
				this.cbg = [];
				this.utg = [];
				this.gtu = [];
				var f = this.es / (1 + Math.sqrt(1 - this.es));
				var n = f / (2 - f);
				var np = n;
				this.cgb[0] =
					n *
					(2 +
						n *
							(-2 / 3 +
								n *
									(-2 +
										n *
											(116 / 45 +
												n *
													(26 / 45 +
														n * (-2854 / 675))))));
				this.cbg[0] =
					n *
					(-2 +
						n *
							(2 / 3 +
								n *
									(4 / 3 +
										n *
											(-82 / 45 +
												n *
													(32 / 45 +
														n * (4642 / 4725))))));
				np = np * n;
				this.cgb[1] =
					np *
					(7 / 3 +
						n *
							(-8 / 5 +
								n *
									(-227 / 45 +
										n * (2704 / 315 + n * (2323 / 945)))));
				this.cbg[1] =
					np *
					(5 / 3 +
						n *
							(-16 / 15 +
								n *
									(-13 / 9 +
										n * (904 / 315 + n * (-1522 / 945)))));
				np = np * n;
				this.cgb[2] =
					np *
					(56 / 15 +
						n *
							(-136 / 35 +
								n * (-1262 / 105 + n * (73814 / 2835))));
				this.cbg[2] =
					np *
					(-26 / 15 +
						n * (34 / 21 + n * (8 / 5 + n * (-12686 / 2835))));
				np = np * n;
				this.cgb[3] =
					np * (4279 / 630 + n * (-332 / 35 + n * (-399572 / 14175)));
				this.cbg[3] =
					np * (1237 / 630 + n * (-12 / 5 + n * (-24832 / 14175)));
				np = np * n;
				this.cgb[4] = np * (4174 / 315 + n * (-144838 / 6237));
				this.cbg[4] = np * (-734 / 315 + n * (109598 / 31185));
				np = np * n;
				this.cgb[5] = np * (601676 / 22275);
				this.cbg[5] = np * (444337 / 155925);
				np = Math.pow(n, 2);
				this.Qn =
					(this.k0 / (1 + n)) *
					(1 + np * (1 / 4 + np * (1 / 64 + np / 256)));
				this.utg[0] =
					n *
					(-0.5 +
						n *
							(2 / 3 +
								n *
									(-37 / 96 +
										n *
											(1 / 360 +
												n *
													(81 / 512 +
														n *
															(-96199 /
																604800))))));
				this.gtu[0] =
					n *
					(0.5 +
						n *
							(-2 / 3 +
								n *
									(5 / 16 +
										n *
											(41 / 180 +
												n *
													(-127 / 288 +
														n * (7891 / 37800))))));
				this.utg[1] =
					np *
					(-1 / 48 +
						n *
							(-1 / 15 +
								n *
									(437 / 1440 +
										n *
											(-46 / 105 +
												n * (1118711 / 3870720)))));
				this.gtu[1] =
					np *
					(13 / 48 +
						n *
							(-3 / 5 +
								n *
									(557 / 1440 +
										n *
											(281 / 630 +
												n * (-1983433 / 1935360)))));
				np = np * n;
				this.utg[2] =
					np *
					(-17 / 480 +
						n *
							(37 / 840 +
								n * (209 / 4480 + n * (-5569 / 90720))));
				this.gtu[2] =
					np *
					(61 / 240 +
						n *
							(-103 / 140 +
								n * (15061 / 26880 + n * (167603 / 181440))));
				np = np * n;
				this.utg[3] =
					np *
					(-4397 / 161280 + n * (11 / 504 + n * (830251 / 7257600)));
				this.gtu[3] =
					np *
					(49561 / 161280 +
						n * (-179 / 168 + n * (6601661 / 7257600)));
				np = np * n;
				this.utg[4] = np * (-4583 / 161280 + n * (108847 / 3991680));
				this.gtu[4] = np * (34729 / 80640 + n * (-3418889 / 1995840));
				np = np * n;
				this.utg[5] = np * (-20648693 / 638668800);
				this.gtu[5] = np * (212378941 / 319334400);
				var Z2 = gatg(this.cbg, this.lat0);
				this.Zb = -this.Qn * (Z2 + clens(this.gtu, 2 * Z2));
			}
			function forward$u(p) {
				var Ce = adjust_lon(p.x - this.long0, this.over);
				var Cn = p.y;
				Cn = gatg(this.cbg, Cn);
				var sin_Cn = Math.sin(Cn);
				var cos_Cn = Math.cos(Cn);
				var sin_Ce = Math.sin(Ce);
				var cos_Ce = Math.cos(Ce);
				Cn = Math.atan2(sin_Cn, cos_Ce * cos_Cn);
				Ce = Math.atan2(
					sin_Ce * cos_Cn,
					hypot(sin_Cn, cos_Cn * cos_Ce),
				);
				Ce = asinhy(Math.tan(Ce));
				var tmp = clens_cmplx(this.gtu, 2 * Cn, 2 * Ce);
				Cn = Cn + tmp[0];
				Ce = Ce + tmp[1];
				var x;
				var y;
				if (Math.abs(Ce) <= 2.623395162778) {
					x = this.a * (this.Qn * Ce) + this.x0;
					y = this.a * (this.Qn * Cn + this.Zb) + this.y0;
				} else {
					x = Infinity;
					y = Infinity;
				}
				p.x = x;
				p.y = y;
				return p;
			}
			function inverse$u(p) {
				var Ce = (p.x - this.x0) * (1 / this.a);
				var Cn = (p.y - this.y0) * (1 / this.a);
				Cn = (Cn - this.Zb) / this.Qn;
				Ce = Ce / this.Qn;
				var lon;
				var lat;
				if (Math.abs(Ce) <= 2.623395162778) {
					var tmp = clens_cmplx(this.utg, 2 * Cn, 2 * Ce);
					Cn = Cn + tmp[0];
					Ce = Ce + tmp[1];
					Ce = Math.atan(sinh(Ce));
					var sin_Cn = Math.sin(Cn);
					var cos_Cn = Math.cos(Cn);
					var sin_Ce = Math.sin(Ce);
					var cos_Ce = Math.cos(Ce);
					Cn = Math.atan2(
						sin_Cn * cos_Ce,
						hypot(sin_Ce, cos_Ce * cos_Cn),
					);
					Ce = Math.atan2(sin_Ce, cos_Ce * cos_Cn);
					lon = adjust_lon(Ce + this.long0, this.over);
					lat = gatg(this.cgb, Cn);
				} else {
					lon = Infinity;
					lat = Infinity;
				}
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$v = [
				"Extended_Transverse_Mercator",
				"Extended Transverse Mercator",
				"etmerc",
				"Transverse_Mercator",
				"Transverse Mercator",
				"Gauss Kruger",
				"Gauss_Kruger",
				"tmerc",
			];
			var etmerc = {
				init: init$w,
				forward: forward$u,
				inverse: inverse$u,
				names: names$v,
			};
			function adjust_zone(zone, lon) {
				if (zone === void 0) {
					zone =
						Math.floor(
							((adjust_lon(lon) + Math.PI) * 30) / Math.PI,
						) + 1;
					if (zone < 0) {
						return 0;
					} else if (zone > 60) {
						return 60;
					}
				}
				return zone;
			}
			var dependsOn = "etmerc";
			function init$v() {
				var zone = adjust_zone(this.zone, this.long0);
				if (zone === void 0) {
					throw new Error("unknown utm zone");
				}
				this.lat0 = 0;
				this.long0 = (6 * Math.abs(zone) - 183) * D2R$1;
				this.x0 = 5e5;
				this.y0 = this.utmSouth ? 1e7 : 0;
				this.k0 = 0.9996;
				etmerc.init.apply(this);
				this.forward = etmerc.forward;
				this.inverse = etmerc.inverse;
			}
			var names$u = ["Universal Transverse Mercator System", "utm"];
			var utm = {
				init: init$v,
				names: names$u,
				dependsOn,
			};
			function srat(esinp, exp) {
				return Math.pow((1 - esinp) / (1 + esinp), exp);
			}
			var MAX_ITER$2 = 20;
			function init$u() {
				var sphi = Math.sin(this.lat0);
				var cphi = Math.cos(this.lat0);
				cphi *= cphi;
				this.rc = Math.sqrt(1 - this.es) / (1 - this.es * sphi * sphi);
				this.C = Math.sqrt(1 + (this.es * cphi * cphi) / (1 - this.es));
				this.phic0 = Math.asin(sphi / this.C);
				this.ratexp = 0.5 * this.C * this.e;
				this.K =
					Math.tan(0.5 * this.phic0 + FORTPI) /
					(Math.pow(Math.tan(0.5 * this.lat0 + FORTPI), this.C) *
						srat(this.e * sphi, this.ratexp));
			}
			function forward$t(p) {
				var lon = p.x;
				var lat = p.y;
				p.y =
					2 *
						Math.atan(
							this.K *
								Math.pow(Math.tan(0.5 * lat + FORTPI), this.C) *
								srat(this.e * Math.sin(lat), this.ratexp),
						) -
					HALF_PI;
				p.x = this.C * lon;
				return p;
			}
			function inverse$t(p) {
				var DEL_TOL = 1e-14;
				var lon = p.x / this.C;
				var lat = p.y;
				var num = Math.pow(
					Math.tan(0.5 * lat + FORTPI) / this.K,
					1 / this.C,
				);
				for (var i = MAX_ITER$2; i > 0; --i) {
					lat =
						2 *
							Math.atan(
								num *
									srat(this.e * Math.sin(p.y), -0.5 * this.e),
							) -
						HALF_PI;
					if (Math.abs(lat - p.y) < DEL_TOL) {
						break;
					}
					p.y = lat;
				}
				if (!i) {
					return null;
				}
				p.x = lon;
				p.y = lat;
				return p;
			}
			var gauss = {
				init: init$u,
				forward: forward$t,
				inverse: inverse$t,
			};
			function init$t() {
				gauss.init.apply(this);
				if (!this.rc) {
					return;
				}
				this.sinc0 = Math.sin(this.phic0);
				this.cosc0 = Math.cos(this.phic0);
				this.R2 = 2 * this.rc;
				if (!this.title) {
					this.title = "Oblique Stereographic Alternative";
				}
			}
			function forward$s(p) {
				var sinc, cosc, cosl, k;
				p.x = adjust_lon(p.x - this.long0, this.over);
				gauss.forward.apply(this, [p]);
				sinc = Math.sin(p.y);
				cosc = Math.cos(p.y);
				cosl = Math.cos(p.x);
				k =
					(this.k0 * this.R2) /
					(1 + this.sinc0 * sinc + this.cosc0 * cosc * cosl);
				p.x = k * cosc * Math.sin(p.x);
				p.y = k * (this.cosc0 * sinc - this.sinc0 * cosc * cosl);
				p.x = this.a * p.x + this.x0;
				p.y = this.a * p.y + this.y0;
				return p;
			}
			function inverse$s(p) {
				var sinc, cosc, lon, lat, rho;
				p.x = (p.x - this.x0) / this.a;
				p.y = (p.y - this.y0) / this.a;
				p.x /= this.k0;
				p.y /= this.k0;
				if ((rho = hypot(p.x, p.y))) {
					var c = 2 * Math.atan2(rho, this.R2);
					sinc = Math.sin(c);
					cosc = Math.cos(c);
					lat = Math.asin(
						cosc * this.sinc0 + (p.y * sinc * this.cosc0) / rho,
					);
					lon = Math.atan2(
						p.x * sinc,
						rho * this.cosc0 * cosc - p.y * this.sinc0 * sinc,
					);
				} else {
					lat = this.phic0;
					lon = 0;
				}
				p.x = lon;
				p.y = lat;
				gauss.inverse.apply(this, [p]);
				p.x = adjust_lon(p.x + this.long0, this.over);
				return p;
			}
			var names$t = [
				"Stereographic_North_Pole",
				"Oblique_Stereographic",
				"sterea",
				"Oblique Stereographic Alternative",
				"Double_Stereographic",
			];
			var sterea = {
				init: init$t,
				forward: forward$s,
				inverse: inverse$s,
				names: names$t,
			};
			function ssfn_(phit, sinphi, eccen) {
				sinphi *= eccen;
				return (
					Math.tan(0.5 * (HALF_PI + phit)) *
					Math.pow((1 - sinphi) / (1 + sinphi), 0.5 * eccen)
				);
			}
			function init$s() {
				this.x0 = this.x0 || 0;
				this.y0 = this.y0 || 0;
				this.lat0 = this.lat0 || 0;
				this.long0 = this.long0 || 0;
				this.coslat0 = Math.cos(this.lat0);
				this.sinlat0 = Math.sin(this.lat0);
				if (this.sphere) {
					if (
						!isNaN(this.lat_ts) &&
						Math.abs(this.coslat0) <= EPSLN
					) {
						this.k0 =
							0.5 * (1 + sign(this.lat0) * Math.sin(this.lat_ts));
					}
				} else {
					if (Math.abs(this.coslat0) <= EPSLN) {
						if (this.lat0 > 0) {
							this.con = 1;
						} else {
							this.con = -1;
						}
					}
					this.cons = Math.sqrt(
						Math.pow(1 + this.e, 1 + this.e) *
							Math.pow(1 - this.e, 1 - this.e),
					);
					if (
						!isNaN(this.lat_ts) &&
						Math.abs(this.coslat0) <= EPSLN &&
						Math.abs(Math.cos(this.lat_ts)) > EPSLN
					) {
						this.k0 =
							(0.5 *
								this.cons *
								msfnz(
									this.e,
									Math.sin(this.lat_ts),
									Math.cos(this.lat_ts),
								)) /
							tsfnz(
								this.e,
								this.con * this.lat_ts,
								this.con * Math.sin(this.lat_ts),
							);
					}
					this.ms1 = msfnz(this.e, this.sinlat0, this.coslat0);
					this.X0 =
						2 * Math.atan(ssfn_(this.lat0, this.sinlat0, this.e)) -
						HALF_PI;
					this.cosX0 = Math.cos(this.X0);
					this.sinX0 = Math.sin(this.X0);
				}
			}
			function forward$r(p) {
				var lon = p.x;
				var lat = p.y;
				var sinlat = Math.sin(lat);
				var coslat = Math.cos(lat);
				var A5, X, sinX, cosX, ts, rh;
				var dlon = adjust_lon(lon - this.long0, this.over);
				if (
					Math.abs(Math.abs(lon - this.long0) - Math.PI) <= EPSLN &&
					Math.abs(lat + this.lat0) <= EPSLN
				) {
					p.x = NaN;
					p.y = NaN;
					return p;
				}
				if (this.sphere) {
					A5 =
						(2 * this.k0) /
						(1 +
							this.sinlat0 * sinlat +
							this.coslat0 * coslat * Math.cos(dlon));
					p.x = this.a * A5 * coslat * Math.sin(dlon) + this.x0;
					p.y =
						this.a *
							A5 *
							(this.coslat0 * sinlat -
								this.sinlat0 * coslat * Math.cos(dlon)) +
						this.y0;
					return p;
				} else {
					X = 2 * Math.atan(ssfn_(lat, sinlat, this.e)) - HALF_PI;
					cosX = Math.cos(X);
					sinX = Math.sin(X);
					if (Math.abs(this.coslat0) <= EPSLN) {
						ts = tsfnz(this.e, lat * this.con, this.con * sinlat);
						rh = (2 * this.a * this.k0 * ts) / this.cons;
						p.x = this.x0 + rh * Math.sin(lon - this.long0);
						p.y =
							this.y0 -
							this.con * rh * Math.cos(lon - this.long0);
						return p;
					} else if (Math.abs(this.sinlat0) < EPSLN) {
						A5 =
							(2 * this.a * this.k0) /
							(1 + cosX * Math.cos(dlon));
						p.y = A5 * sinX;
					} else {
						A5 =
							(2 * this.a * this.k0 * this.ms1) /
							(this.cosX0 *
								(1 +
									this.sinX0 * sinX +
									this.cosX0 * cosX * Math.cos(dlon)));
						p.y =
							A5 *
								(this.cosX0 * sinX -
									this.sinX0 * cosX * Math.cos(dlon)) +
							this.y0;
					}
					p.x = A5 * cosX * Math.sin(dlon) + this.x0;
				}
				return p;
			}
			function inverse$r(p) {
				p.x -= this.x0;
				p.y -= this.y0;
				var lon, lat, ts, ce, Chi;
				var rh = Math.sqrt(p.x * p.x + p.y * p.y);
				if (this.sphere) {
					var c = 2 * Math.atan(rh / (2 * this.a * this.k0));
					lon = this.long0;
					lat = this.lat0;
					if (rh <= EPSLN) {
						p.x = lon;
						p.y = lat;
						return p;
					}
					lat = Math.asin(
						Math.cos(c) * this.sinlat0 +
							(p.y * Math.sin(c) * this.coslat0) / rh,
					);
					if (Math.abs(this.coslat0) < EPSLN) {
						if (this.lat0 > 0) {
							lon = adjust_lon(
								this.long0 + Math.atan2(p.x, -1 * p.y),
								this.over,
							);
						} else {
							lon = adjust_lon(
								this.long0 + Math.atan2(p.x, p.y),
								this.over,
							);
						}
					} else {
						lon = adjust_lon(
							this.long0 +
								Math.atan2(
									p.x * Math.sin(c),
									rh * this.coslat0 * Math.cos(c) -
										p.y * this.sinlat0 * Math.sin(c),
								),
							this.over,
						);
					}
					p.x = lon;
					p.y = lat;
					return p;
				} else {
					if (Math.abs(this.coslat0) <= EPSLN) {
						if (rh <= EPSLN) {
							lat = this.lat0;
							lon = this.long0;
							p.x = lon;
							p.y = lat;
							return p;
						}
						p.x *= this.con;
						p.y *= this.con;
						ts = (rh * this.cons) / (2 * this.a * this.k0);
						lat = this.con * phi2z(this.e, ts);
						lon =
							this.con *
							adjust_lon(
								this.con * this.long0 +
									Math.atan2(p.x, -1 * p.y),
								this.over,
							);
					} else {
						ce =
							2 *
							Math.atan(
								(rh * this.cosX0) /
									(2 * this.a * this.k0 * this.ms1),
							);
						lon = this.long0;
						if (rh <= EPSLN) {
							Chi = this.X0;
						} else {
							Chi = Math.asin(
								Math.cos(ce) * this.sinX0 +
									(p.y * Math.sin(ce) * this.cosX0) / rh,
							);
							lon = adjust_lon(
								this.long0 +
									Math.atan2(
										p.x * Math.sin(ce),
										rh * this.cosX0 * Math.cos(ce) -
											p.y * this.sinX0 * Math.sin(ce),
									),
								this.over,
							);
						}
						lat =
							-1 * phi2z(this.e, Math.tan(0.5 * (HALF_PI + Chi)));
					}
				}
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$s = [
				"stere",
				"Stereographic_South_Pole",
				"Polar_Stereographic_variant_A",
				"Polar_Stereographic_variant_B",
				"Polar_Stereographic",
			];
			var stere = {
				init: init$s,
				forward: forward$r,
				inverse: inverse$r,
				names: names$s,
				ssfn_,
			};
			function init$r() {
				if (!this.k0) {
					this.k0 = 1;
				}
				var phy0 = this.lat0;
				this.lambda0 = this.long0;
				var sinPhy0 = Math.sin(phy0);
				var semiMajorAxis = this.a;
				var invF = this.rf;
				var flattening = 1 / invF;
				var e2 = 2 * flattening - Math.pow(flattening, 2);
				var e = (this.e = Math.sqrt(e2));
				this.R =
					(this.k0 * semiMajorAxis * Math.sqrt(1 - e2)) /
					(1 - e2 * Math.pow(sinPhy0, 2));
				this.alpha = Math.sqrt(
					1 + (e2 / (1 - e2)) * Math.pow(Math.cos(phy0), 4),
				);
				this.b0 = Math.asin(sinPhy0 / this.alpha);
				var k1 = Math.log(Math.tan(Math.PI / 4 + this.b0 / 2));
				var k2 = Math.log(Math.tan(Math.PI / 4 + phy0 / 2));
				var k3 = Math.log((1 + e * sinPhy0) / (1 - e * sinPhy0));
				this.K = k1 - this.alpha * k2 + ((this.alpha * e) / 2) * k3;
			}
			function forward$q(p) {
				var Sa1 = Math.log(Math.tan(Math.PI / 4 - p.y / 2));
				var Sa2 =
					(this.e / 2) *
					Math.log(
						(1 + this.e * Math.sin(p.y)) /
							(1 - this.e * Math.sin(p.y)),
					);
				var S = -this.alpha * (Sa1 + Sa2) + this.K;
				var b = 2 * (Math.atan(Math.exp(S)) - Math.PI / 4);
				var I2 = this.alpha * (p.x - this.lambda0);
				var rotI = Math.atan(
					Math.sin(I2) /
						(Math.sin(this.b0) * Math.tan(b) +
							Math.cos(this.b0) * Math.cos(I2)),
				);
				var rotB = Math.asin(
					Math.cos(this.b0) * Math.sin(b) -
						Math.sin(this.b0) * Math.cos(b) * Math.cos(I2),
				);
				p.y =
					(this.R / 2) *
						Math.log((1 + Math.sin(rotB)) / (1 - Math.sin(rotB))) +
					this.y0;
				p.x = this.R * rotI + this.x0;
				return p;
			}
			function inverse$q(p) {
				var Y = p.x - this.x0;
				var X = p.y - this.y0;
				var rotI = Y / this.R;
				var rotB = 2 * (Math.atan(Math.exp(X / this.R)) - Math.PI / 4);
				var b = Math.asin(
					Math.cos(this.b0) * Math.sin(rotB) +
						Math.sin(this.b0) * Math.cos(rotB) * Math.cos(rotI),
				);
				var I2 = Math.atan(
					Math.sin(rotI) /
						(Math.cos(this.b0) * Math.cos(rotI) -
							Math.sin(this.b0) * Math.tan(rotB)),
				);
				var lambda = this.lambda0 + I2 / this.alpha;
				var S = 0;
				var phy = b;
				var prevPhy = -1e3;
				var iteration = 0;
				while (Math.abs(phy - prevPhy) > 1e-7) {
					if (++iteration > 20) {
						return;
					}
					S =
						(1 / this.alpha) *
							(Math.log(Math.tan(Math.PI / 4 + b / 2)) - this.K) +
						this.e *
							Math.log(
								Math.tan(
									Math.PI / 4 +
										Math.asin(this.e * Math.sin(phy)) / 2,
								),
							);
					prevPhy = phy;
					phy = 2 * Math.atan(Math.exp(S)) - Math.PI / 2;
				}
				p.x = lambda;
				p.y = phy;
				return p;
			}
			var names$r = ["somerc"];
			var somerc = {
				init: init$r,
				forward: forward$q,
				inverse: inverse$q,
				names: names$r,
			};
			var TOL = 1e-7;
			function isTypeA(P) {
				var typeAProjections = [
					"Hotine_Oblique_Mercator",
					"Hotine_Oblique_Mercator_variant_A",
					"Hotine_Oblique_Mercator_Azimuth_Natural_Origin",
				];
				var projectionName =
					typeof P.projName === "object"
						? Object.keys(P.projName)[0]
						: P.projName;
				return (
					"no_uoff" in P ||
					"no_off" in P ||
					typeAProjections.indexOf(projectionName) !== -1 ||
					typeAProjections.indexOf(
						getNormalizedProjName(projectionName),
					) !== -1
				);
			}
			function init$q() {
				var con,
					com,
					cosph0,
					D,
					F3,
					H,
					L,
					sinph0,
					p,
					J,
					gamma = 0,
					gamma0,
					lamc = 0,
					lam1 = 0,
					lam2 = 0,
					phi1 = 0,
					phi2 = 0,
					alpha_c = 0;
				if (!this.k0) {
					this.k0 = 1;
				}
				this.no_off = isTypeA(this);
				this.no_rot = "no_rot" in this;
				var alp = false;
				if ("alpha" in this) {
					alp = true;
				}
				var gam = false;
				if ("rectified_grid_angle" in this) {
					gam = true;
				}
				if (alp) {
					alpha_c = this.alpha;
				}
				if (gam) {
					gamma = this.rectified_grid_angle;
					if (!alp) {
						alpha_c = 0;
						alp = true;
					}
				}
				if (alp || gam) {
					lamc = this.longc;
				} else {
					lam1 = this.long1;
					phi1 = this.lat1;
					lam2 = this.long2;
					phi2 = this.lat2;
					if (
						Math.abs(phi1 - phi2) <= TOL ||
						(con = Math.abs(phi1)) <= TOL ||
						Math.abs(con - HALF_PI) <= TOL ||
						Math.abs(Math.abs(this.lat0) - HALF_PI) <= TOL ||
						Math.abs(Math.abs(phi2) - HALF_PI) <= TOL
					) {
						throw new Error();
					}
				}
				var one_es = 1 - this.es;
				com = Math.sqrt(one_es);
				if (Math.abs(this.lat0) > EPSLN) {
					sinph0 = Math.sin(this.lat0);
					cosph0 = Math.cos(this.lat0);
					con = 1 - this.es * sinph0 * sinph0;
					this.B = cosph0 * cosph0;
					this.B = Math.sqrt(
						1 + (this.es * this.B * this.B) / one_es,
					);
					this.A = (this.B * this.k0 * com) / con;
					D = (this.B * com) / (cosph0 * Math.sqrt(con));
					F3 = D * D - 1;
					if (F3 <= 0) {
						F3 = 0;
					} else {
						F3 = Math.sqrt(F3);
						if (this.lat0 < 0) {
							F3 = -F3;
						}
					}
					this.E = F3 += D;
					this.E *= Math.pow(
						tsfnz(this.e, this.lat0, sinph0),
						this.B,
					);
				} else {
					this.B = 1 / com;
					this.A = this.k0;
					this.E = D = F3 = 1;
				}
				if (alp || gam) {
					if (alp) {
						gamma0 = Math.asin(Math.sin(alpha_c) / D);
						if (!gam) {
							gamma = alpha_c;
						}
					} else {
						gamma0 = gamma;
						alpha_c = Math.asin(D * Math.sin(gamma0));
					}
					this.lam0 =
						lamc -
						Math.asin(0.5 * (F3 - 1 / F3) * Math.tan(gamma0)) /
							this.B;
				} else {
					H = Math.pow(tsfnz(this.e, phi1, Math.sin(phi1)), this.B);
					L = Math.pow(tsfnz(this.e, phi2, Math.sin(phi2)), this.B);
					F3 = this.E / H;
					p = (L - H) / (L + H);
					J = this.E * this.E;
					J = (J - L * H) / (J + L * H);
					con = lam1 - lam2;
					if (con < -Math.PI) {
						lam2 -= TWO_PI;
					} else if (con > Math.PI) {
						lam2 += TWO_PI;
					}
					this.lam0 = adjust_lon(
						0.5 * (lam1 + lam2) -
							Math.atan(
								(J * Math.tan(0.5 * this.B * (lam1 - lam2))) /
									p,
							) /
								this.B,
						this.over,
					);
					gamma0 = Math.atan(
						(2 *
							Math.sin(
								this.B *
									adjust_lon(lam1 - this.lam0, this.over),
							)) /
							(F3 - 1 / F3),
					);
					gamma = alpha_c = Math.asin(D * Math.sin(gamma0));
				}
				this.singam = Math.sin(gamma0);
				this.cosgam = Math.cos(gamma0);
				this.sinrot = Math.sin(gamma);
				this.cosrot = Math.cos(gamma);
				this.rB = 1 / this.B;
				this.ArB = this.A * this.rB;
				this.BrA = 1 / this.ArB;
				if (this.no_off) {
					this.u_0 = 0;
				} else {
					this.u_0 = Math.abs(
						this.ArB *
							Math.atan(Math.sqrt(D * D - 1) / Math.cos(alpha_c)),
					);
					if (this.lat0 < 0) {
						this.u_0 = -this.u_0;
					}
				}
				F3 = 0.5 * gamma0;
				this.v_pole_n = this.ArB * Math.log(Math.tan(FORTPI - F3));
				this.v_pole_s = this.ArB * Math.log(Math.tan(FORTPI + F3));
			}
			function forward$p(p) {
				var coords = {};
				var S, T, U, V2, W, temp, u, v;
				p.x = p.x - this.lam0;
				if (Math.abs(Math.abs(p.y) - HALF_PI) > EPSLN) {
					W =
						this.E /
						Math.pow(tsfnz(this.e, p.y, Math.sin(p.y)), this.B);
					temp = 1 / W;
					S = 0.5 * (W - temp);
					T = 0.5 * (W + temp);
					V2 = Math.sin(this.B * p.x);
					U = (S * this.singam - V2 * this.cosgam) / T;
					if (Math.abs(Math.abs(U) - 1) < EPSLN) {
						throw new Error();
					}
					v = 0.5 * this.ArB * Math.log((1 - U) / (1 + U));
					temp = Math.cos(this.B * p.x);
					if (Math.abs(temp) < TOL) {
						u = this.A * p.x;
					} else {
						u =
							this.ArB *
							Math.atan2(
								S * this.cosgam + V2 * this.singam,
								temp,
							);
					}
				} else {
					v = p.y > 0 ? this.v_pole_n : this.v_pole_s;
					u = this.ArB * p.y;
				}
				if (this.no_rot) {
					coords.x = u;
					coords.y = v;
				} else {
					u -= this.u_0;
					coords.x = v * this.cosrot + u * this.sinrot;
					coords.y = u * this.cosrot - v * this.sinrot;
				}
				coords.x = this.a * coords.x + this.x0;
				coords.y = this.a * coords.y + this.y0;
				if (p.z !== void 0) {
					coords.z = p.z;
				}
				if (p.m !== void 0) {
					coords.m = p.m;
				}
				return coords;
			}
			function inverse$p(p) {
				var u, v, Qp, Sp, Tp, Vp, Up;
				var coords = {};
				p.x = (p.x - this.x0) * (1 / this.a);
				p.y = (p.y - this.y0) * (1 / this.a);
				if (this.no_rot) {
					v = p.y;
					u = p.x;
				} else {
					v = p.x * this.cosrot - p.y * this.sinrot;
					u = p.y * this.cosrot + p.x * this.sinrot + this.u_0;
				}
				Qp = Math.exp(-this.BrA * v);
				Sp = 0.5 * (Qp - 1 / Qp);
				Tp = 0.5 * (Qp + 1 / Qp);
				Vp = Math.sin(this.BrA * u);
				Up = (Vp * this.cosgam + Sp * this.singam) / Tp;
				if (Math.abs(Math.abs(Up) - 1) < EPSLN) {
					coords.x = 0;
					coords.y = Up < 0 ? -HALF_PI : HALF_PI;
				} else {
					coords.y = this.E / Math.sqrt((1 + Up) / (1 - Up));
					coords.y = phi2z(this.e, Math.pow(coords.y, 1 / this.B));
					if (coords.y === Infinity) {
						throw new Error();
					}
					coords.x =
						-this.rB *
						Math.atan2(
							Sp * this.cosgam - Vp * this.singam,
							Math.cos(this.BrA * u),
						);
				}
				coords.x += this.lam0;
				if (p.z !== void 0) {
					coords.z = p.z;
				}
				if (p.m !== void 0) {
					coords.m = p.m;
				}
				return coords;
			}
			var names$q = [
				"Hotine_Oblique_Mercator",
				"Hotine Oblique Mercator",
				"Hotine_Oblique_Mercator_variant_A",
				"Hotine_Oblique_Mercator_Variant_B",
				"Hotine_Oblique_Mercator_Azimuth_Natural_Origin",
				"Hotine_Oblique_Mercator_Two_Point_Natural_Origin",
				"Hotine_Oblique_Mercator_Azimuth_Center",
				"Oblique_Mercator",
				"omerc",
			];
			var omerc = {
				init: init$q,
				forward: forward$p,
				inverse: inverse$p,
				names: names$q,
			};
			function init$p() {
				if (!this.lat2) {
					this.lat2 = this.lat1;
				}
				if (!this.k0) {
					this.k0 = 1;
				}
				this.x0 = this.x0 || 0;
				this.y0 = this.y0 || 0;
				this.long0 = this.long0 || 0;
				if (Math.abs(this.lat1 + this.lat2) < EPSLN) {
					return;
				}
				var temp = this.b / this.a;
				this.e = Math.sqrt(1 - temp * temp);
				var sin1 = Math.sin(this.lat1);
				var cos1 = Math.cos(this.lat1);
				var ms1 = msfnz(this.e, sin1, cos1);
				var ts1 = tsfnz(this.e, this.lat1, sin1);
				var sin2 = Math.sin(this.lat2);
				var cos2 = Math.cos(this.lat2);
				var ms2 = msfnz(this.e, sin2, cos2);
				var ts2 = tsfnz(this.e, this.lat2, sin2);
				var ts0 = tsfnz(this.e, this.lat0, Math.sin(this.lat0));
				if (Math.abs(this.lat1 - this.lat2) > EPSLN) {
					this.ns = Math.log(ms1 / ms2) / Math.log(ts1 / ts2);
				} else {
					this.ns = sin1;
				}
				if (isNaN(this.ns)) {
					this.ns = sin1;
				}
				this.f0 = ms1 / (this.ns * Math.pow(ts1, this.ns));
				this.rh =
					Math.abs(Math.abs(this.lat0) - HALF_PI) < EPSLN
						? 0
						: this.a * this.f0 * Math.pow(ts0, this.ns);
				if (!this.title) {
					this.title = "Lambert Conformal Conic";
				}
			}
			function forward$o(p) {
				var lon = p.x;
				var lat = p.y;
				if (Math.abs(2 * Math.abs(lat) - Math.PI) <= EPSLN) {
					lat = sign(lat) * (HALF_PI - 2 * EPSLN);
				}
				var con = Math.abs(Math.abs(lat) - HALF_PI);
				var ts, rh1;
				if (con > EPSLN) {
					ts = tsfnz(this.e, lat, Math.sin(lat));
					rh1 = this.a * this.f0 * Math.pow(ts, this.ns);
				} else {
					con = lat * this.ns;
					if (con <= 0) {
						return null;
					}
					rh1 = 0;
				}
				var theta = this.ns * adjust_lon(lon - this.long0, this.over);
				p.x = this.k0 * (rh1 * Math.sin(theta)) + this.x0;
				p.y = this.k0 * (this.rh - rh1 * Math.cos(theta)) + this.y0;
				return p;
			}
			function inverse$o(p) {
				var rh1, con, ts;
				var lat, lon;
				var x = (p.x - this.x0) / this.k0;
				var y = this.rh - (p.y - this.y0) / this.k0;
				if (this.ns > 0) {
					rh1 = Math.sqrt(x * x + y * y);
					con = 1;
				} else {
					rh1 = -Math.sqrt(x * x + y * y);
					con = -1;
				}
				var theta = 0;
				if (rh1 !== 0) {
					theta = Math.atan2(con * x, con * y);
				}
				if (rh1 !== 0 || this.ns > 0) {
					con = 1 / this.ns;
					ts = Math.pow(rh1 / (this.a * this.f0), con);
					lat = phi2z(this.e, ts);
					if (lat === -9999) {
						return null;
					}
				} else {
					lat = -HALF_PI;
				}
				lon = adjust_lon(theta / this.ns + this.long0, this.over);
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$p = [
				"Lambert Tangential Conformal Conic Projection",
				"Lambert_Conformal_Conic",
				"Lambert_Conformal_Conic_1SP",
				"Lambert_Conformal_Conic_2SP",
				"lcc",
				"Lambert Conic Conformal (1SP)",
				"Lambert Conic Conformal (2SP)",
			];
			var lcc = {
				init: init$p,
				forward: forward$o,
				inverse: inverse$o,
				names: names$p,
			};
			function init$o() {
				this.a = 6377397155e-3;
				this.es = 0.006674372230614;
				this.e = Math.sqrt(this.es);
				if (!this.lat0) {
					this.lat0 = 0.863937979737193;
				}
				if (!this.long0) {
					this.long0 = 0.7417649320975901 - 0.308341501185665;
				}
				if (!this.k0) {
					this.k0 = 0.9999;
				}
				this.s45 = 0.785398163397448;
				this.s90 = 2 * this.s45;
				this.fi0 = this.lat0;
				this.e2 = this.es;
				this.e = Math.sqrt(this.e2);
				this.alfa = Math.sqrt(
					1 +
						(this.e2 * Math.pow(Math.cos(this.fi0), 4)) /
							(1 - this.e2),
				);
				this.uq = 1.04216856380474;
				this.u0 = Math.asin(Math.sin(this.fi0) / this.alfa);
				this.g = Math.pow(
					(1 + this.e * Math.sin(this.fi0)) /
						(1 - this.e * Math.sin(this.fi0)),
					(this.alfa * this.e) / 2,
				);
				this.k =
					(Math.tan(this.u0 / 2 + this.s45) /
						Math.pow(
							Math.tan(this.fi0 / 2 + this.s45),
							this.alfa,
						)) *
					this.g;
				this.k1 = this.k0;
				this.n0 =
					(this.a * Math.sqrt(1 - this.e2)) /
					(1 - this.e2 * Math.pow(Math.sin(this.fi0), 2));
				this.s0 = 1.37008346281555;
				this.n = Math.sin(this.s0);
				this.ro0 = (this.k1 * this.n0) / Math.tan(this.s0);
				this.ad = this.s90 - this.uq;
			}
			function forward$n(p) {
				var gfi, u, deltav, s, d, eps, ro;
				var lon = p.x;
				var lat = p.y;
				var delta_lon = adjust_lon(lon - this.long0, this.over);
				gfi = Math.pow(
					(1 + this.e * Math.sin(lat)) / (1 - this.e * Math.sin(lat)),
					(this.alfa * this.e) / 2,
				);
				u =
					2 *
					(Math.atan(
						(this.k *
							Math.pow(Math.tan(lat / 2 + this.s45), this.alfa)) /
							gfi,
					) -
						this.s45);
				deltav = -delta_lon * this.alfa;
				s = Math.asin(
					Math.cos(this.ad) * Math.sin(u) +
						Math.sin(this.ad) * Math.cos(u) * Math.cos(deltav),
				);
				d = Math.asin((Math.cos(u) * Math.sin(deltav)) / Math.cos(s));
				eps = this.n * d;
				ro =
					(this.ro0 *
						Math.pow(Math.tan(this.s0 / 2 + this.s45), this.n)) /
					Math.pow(Math.tan(s / 2 + this.s45), this.n);
				p.y = (ro * Math.cos(eps)) / 1;
				p.x = (ro * Math.sin(eps)) / 1;
				if (!this.czech) {
					p.y *= -1;
					p.x *= -1;
				}
				return p;
			}
			function inverse$n(p) {
				var u, deltav, s, d, eps, ro, fi1;
				var ok;
				var tmp = p.x;
				p.x = p.y;
				p.y = tmp;
				if (!this.czech) {
					p.y *= -1;
					p.x *= -1;
				}
				ro = Math.sqrt(p.x * p.x + p.y * p.y);
				eps = Math.atan2(p.y, p.x);
				d = eps / Math.sin(this.s0);
				s =
					2 *
					(Math.atan(
						Math.pow(this.ro0 / ro, 1 / this.n) *
							Math.tan(this.s0 / 2 + this.s45),
					) -
						this.s45);
				u = Math.asin(
					Math.cos(this.ad) * Math.sin(s) -
						Math.sin(this.ad) * Math.cos(s) * Math.cos(d),
				);
				deltav = Math.asin((Math.cos(s) * Math.sin(d)) / Math.cos(u));
				p.x = this.long0 - deltav / this.alfa;
				fi1 = u;
				ok = 0;
				var iter = 0;
				do {
					p.y =
						2 *
						(Math.atan(
							Math.pow(this.k, -1 / this.alfa) *
								Math.pow(
									Math.tan(u / 2 + this.s45),
									1 / this.alfa,
								) *
								Math.pow(
									(1 + this.e * Math.sin(fi1)) /
										(1 - this.e * Math.sin(fi1)),
									this.e / 2,
								),
						) -
							this.s45);
					if (Math.abs(fi1 - p.y) < 1e-10) {
						ok = 1;
					}
					fi1 = p.y;
					iter += 1;
				} while (ok === 0 && iter < 15);
				if (iter >= 15) {
					return null;
				}
				return p;
			}
			var names$o = [
				"Krovak",
				"Krovak Modified",
				"Krovak (North Orientated)",
				"Krovak Modified (North Orientated)",
				"krovak",
			];
			var krovak = {
				init: init$o,
				forward: forward$n,
				inverse: inverse$n,
				names: names$o,
			};
			function mlfn(e0, e1, e2, e3, phi) {
				return (
					e0 * phi -
					e1 * Math.sin(2 * phi) +
					e2 * Math.sin(4 * phi) -
					e3 * Math.sin(6 * phi)
				);
			}
			function e0fn(x) {
				return 1 - 0.25 * x * (1 + (x / 16) * (3 + 1.25 * x));
			}
			function e1fn(x) {
				return 0.375 * x * (1 + 0.25 * x * (1 + 0.46875 * x));
			}
			function e2fn(x) {
				return 0.05859375 * x * x * (1 + 0.75 * x);
			}
			function e3fn(x) {
				return x * x * x * (35 / 3072);
			}
			function gN(a, e, sinphi) {
				var temp = e * sinphi;
				return a / Math.sqrt(1 - temp * temp);
			}
			function adjust_lat(x) {
				return Math.abs(x) < HALF_PI ? x : x - sign(x) * Math.PI;
			}
			function imlfn(ml, e0, e1, e2, e3) {
				var phi;
				var dphi;
				phi = ml / e0;
				for (var i = 0; i < 15; i++) {
					dphi =
						(ml -
							(e0 * phi -
								e1 * Math.sin(2 * phi) +
								e2 * Math.sin(4 * phi) -
								e3 * Math.sin(6 * phi))) /
						(e0 -
							2 * e1 * Math.cos(2 * phi) +
							4 * e2 * Math.cos(4 * phi) -
							6 * e3 * Math.cos(6 * phi));
					phi += dphi;
					if (Math.abs(dphi) <= 1e-10) {
						return phi;
					}
				}
				return NaN;
			}
			function init$n() {
				if (!this.sphere) {
					this.e0 = e0fn(this.es);
					this.e1 = e1fn(this.es);
					this.e2 = e2fn(this.es);
					this.e3 = e3fn(this.es);
					this.ml0 =
						this.a *
						mlfn(this.e0, this.e1, this.e2, this.e3, this.lat0);
				}
			}
			function forward$m(p) {
				var x, y;
				var lam = p.x;
				var phi = p.y;
				lam = adjust_lon(lam - this.long0, this.over);
				if (this.sphere) {
					x = this.a * Math.asin(Math.cos(phi) * Math.sin(lam));
					y =
						this.a *
						(Math.atan2(Math.tan(phi), Math.cos(lam)) - this.lat0);
				} else {
					var sinphi = Math.sin(phi);
					var cosphi = Math.cos(phi);
					var nl = gN(this.a, this.e, sinphi);
					var tl = Math.tan(phi) * Math.tan(phi);
					var al = lam * Math.cos(phi);
					var asq = al * al;
					var cl = (this.es * cosphi * cosphi) / (1 - this.es);
					var ml =
						this.a * mlfn(this.e0, this.e1, this.e2, this.e3, phi);
					x =
						nl *
						al *
						(1 -
							asq *
								tl *
								(1 / 6 - ((8 - tl + 8 * cl) * asq) / 120));
					y =
						ml -
						this.ml0 +
						((nl * sinphi) / cosphi) *
							asq *
							(0.5 + ((5 - tl + 6 * cl) * asq) / 24);
				}
				p.x = x + this.x0;
				p.y = y + this.y0;
				return p;
			}
			function inverse$m(p) {
				p.x -= this.x0;
				p.y -= this.y0;
				var x = p.x / this.a;
				var y = p.y / this.a;
				var phi, lam;
				if (this.sphere) {
					var dd = y + this.lat0;
					phi = Math.asin(Math.sin(dd) * Math.cos(x));
					lam = Math.atan2(Math.tan(x), Math.cos(dd));
				} else {
					var ml1 = this.ml0 / this.a + y;
					var phi1 = imlfn(ml1, this.e0, this.e1, this.e2, this.e3);
					if (Math.abs(Math.abs(phi1) - HALF_PI) <= EPSLN) {
						p.x = this.long0;
						p.y = HALF_PI;
						if (y < 0) {
							p.y *= -1;
						}
						return p;
					}
					var nl1 = gN(this.a, this.e, Math.sin(phi1));
					var rl1 =
						((nl1 * nl1 * nl1) / this.a / this.a) * (1 - this.es);
					var tl1 = Math.pow(Math.tan(phi1), 2);
					var dl = (x * this.a) / nl1;
					var dsq = dl * dl;
					phi =
						phi1 -
						((nl1 * Math.tan(phi1)) / rl1) *
							dl *
							dl *
							(0.5 - ((1 + 3 * tl1) * dl * dl) / 24);
					lam =
						(dl *
							(1 -
								dsq *
									(tl1 / 3 +
										((1 + 3 * tl1) * tl1 * dsq) / 15))) /
						Math.cos(phi1);
				}
				p.x = adjust_lon(lam + this.long0, this.over);
				p.y = adjust_lat(phi);
				return p;
			}
			var names$n = ["Cassini", "Cassini_Soldner", "cass"];
			var cass = {
				init: init$n,
				forward: forward$m,
				inverse: inverse$m,
				names: names$n,
			};
			function qsfnz(eccent, sinphi) {
				var con;
				if (eccent > 1e-7) {
					con = eccent * sinphi;
					return (
						(1 - eccent * eccent) *
						(sinphi / (1 - con * con) -
							(0.5 / eccent) * Math.log((1 - con) / (1 + con)))
					);
				} else {
					return 2 * sinphi;
				}
			}
			var P00 = 0.3333333333333333;
			var P01 = 0.17222222222222222;
			var P02 = 0.10257936507936508;
			var P10 = 0.06388888888888888;
			var P11 = 0.0664021164021164;
			var P20 = 0.016415012942191543;
			function authset(es) {
				var t;
				var APA = [];
				APA[0] = es * P00;
				t = es * es;
				APA[0] += t * P01;
				APA[1] = t * P10;
				t *= es;
				APA[0] += t * P02;
				APA[1] += t * P11;
				APA[2] = t * P20;
				return APA;
			}
			function authlat(beta, APA) {
				var t = beta + beta;
				return (
					beta +
					APA[0] * Math.sin(t) +
					APA[1] * Math.sin(t + t) +
					APA[2] * Math.sin(t + t + t)
				);
			}
			var S_POLE = 1;
			var N_POLE = 2;
			var EQUIT = 3;
			var OBLIQ = 4;
			function init$m() {
				var t = Math.abs(this.lat0);
				if (Math.abs(t - HALF_PI) < EPSLN) {
					this.mode = this.lat0 < 0 ? S_POLE : N_POLE;
				} else if (Math.abs(t) < EPSLN) {
					this.mode = EQUIT;
				} else {
					this.mode = OBLIQ;
				}
				if (this.es > 0) {
					var sinphi;
					this.qp = qsfnz(this.e, 1);
					this.mmf = 0.5 / (1 - this.es);
					this.apa = authset(this.es);
					switch (this.mode) {
						case N_POLE:
							this.dd = 1;
							break;
						case S_POLE:
							this.dd = 1;
							break;
						case EQUIT:
							this.rq = Math.sqrt(0.5 * this.qp);
							this.dd = 1 / this.rq;
							this.xmf = 1;
							this.ymf = 0.5 * this.qp;
							break;
						case OBLIQ:
							this.rq = Math.sqrt(0.5 * this.qp);
							sinphi = Math.sin(this.lat0);
							this.sinb1 = qsfnz(this.e, sinphi) / this.qp;
							this.cosb1 = Math.sqrt(1 - this.sinb1 * this.sinb1);
							this.dd =
								Math.cos(this.lat0) /
								(Math.sqrt(1 - this.es * sinphi * sinphi) *
									this.rq *
									this.cosb1);
							this.ymf = (this.xmf = this.rq) / this.dd;
							this.xmf *= this.dd;
							break;
					}
				} else {
					if (this.mode === OBLIQ) {
						this.sinph0 = Math.sin(this.lat0);
						this.cosph0 = Math.cos(this.lat0);
					}
				}
			}
			function forward$l(p) {
				var x, y, coslam, sinlam, sinphi, q, sinb, cosb, b, cosphi;
				var lam = p.x;
				var phi = p.y;
				lam = adjust_lon(lam - this.long0, this.over);
				if (this.sphere) {
					sinphi = Math.sin(phi);
					cosphi = Math.cos(phi);
					coslam = Math.cos(lam);
					if (this.mode === this.OBLIQ || this.mode === this.EQUIT) {
						y =
							this.mode === this.EQUIT
								? 1 + cosphi * coslam
								: 1 +
									this.sinph0 * sinphi +
									this.cosph0 * cosphi * coslam;
						if (y <= EPSLN) {
							return null;
						}
						y = Math.sqrt(2 / y);
						x = y * cosphi * Math.sin(lam);
						y *=
							this.mode === this.EQUIT
								? sinphi
								: this.cosph0 * sinphi -
									this.sinph0 * cosphi * coslam;
					} else if (
						this.mode === this.N_POLE ||
						this.mode === this.S_POLE
					) {
						if (this.mode === this.N_POLE) {
							coslam = -coslam;
						}
						if (Math.abs(phi + this.lat0) < EPSLN) {
							return null;
						}
						y = FORTPI - phi * 0.5;
						y =
							2 *
							(this.mode === this.S_POLE
								? Math.cos(y)
								: Math.sin(y));
						x = y * Math.sin(lam);
						y *= coslam;
					}
				} else {
					sinb = 0;
					cosb = 0;
					b = 0;
					coslam = Math.cos(lam);
					sinlam = Math.sin(lam);
					sinphi = Math.sin(phi);
					q = qsfnz(this.e, sinphi);
					if (this.mode === this.OBLIQ || this.mode === this.EQUIT) {
						sinb = q / this.qp;
						cosb = Math.sqrt(1 - sinb * sinb);
					}
					switch (this.mode) {
						case this.OBLIQ:
							b =
								1 +
								this.sinb1 * sinb +
								this.cosb1 * cosb * coslam;
							break;
						case this.EQUIT:
							b = 1 + cosb * coslam;
							break;
						case this.N_POLE:
							b = HALF_PI + phi;
							q = this.qp - q;
							break;
						case this.S_POLE:
							b = phi - HALF_PI;
							q = this.qp + q;
							break;
					}
					if (Math.abs(b) < EPSLN) {
						return null;
					}
					switch (this.mode) {
						case this.OBLIQ:
						case this.EQUIT:
							b = Math.sqrt(2 / b);
							if (this.mode === this.OBLIQ) {
								y =
									this.ymf *
									b *
									(this.cosb1 * sinb -
										this.sinb1 * cosb * coslam);
							} else {
								y =
									(b = Math.sqrt(2 / (1 + cosb * coslam))) *
									sinb *
									this.ymf;
							}
							x = this.xmf * b * cosb * sinlam;
							break;
						case this.N_POLE:
						case this.S_POLE:
							if (q >= 0) {
								x = (b = Math.sqrt(q)) * sinlam;
								y =
									coslam *
									(this.mode === this.S_POLE ? b : -b);
							} else {
								x = y = 0;
							}
							break;
					}
				}
				p.x = this.a * x + this.x0;
				p.y = this.a * y + this.y0;
				return p;
			}
			function inverse$l(p) {
				p.x -= this.x0;
				p.y -= this.y0;
				var x = p.x / this.a;
				var y = p.y / this.a;
				var lam, phi, cCe, sCe, q, rho, ab;
				if (this.sphere) {
					var cosz = 0,
						rh,
						sinz = 0;
					rh = Math.sqrt(x * x + y * y);
					phi = rh * 0.5;
					if (phi > 1) {
						return null;
					}
					phi = 2 * Math.asin(phi);
					if (this.mode === this.OBLIQ || this.mode === this.EQUIT) {
						sinz = Math.sin(phi);
						cosz = Math.cos(phi);
					}
					switch (this.mode) {
						case this.EQUIT:
							phi =
								Math.abs(rh) <= EPSLN
									? 0
									: Math.asin((y * sinz) / rh);
							x *= sinz;
							y = cosz * rh;
							break;
						case this.OBLIQ:
							phi =
								Math.abs(rh) <= EPSLN
									? this.lat0
									: Math.asin(
											cosz * this.sinph0 +
												(y * sinz * this.cosph0) / rh,
										);
							x *= sinz * this.cosph0;
							y = (cosz - Math.sin(phi) * this.sinph0) * rh;
							break;
						case this.N_POLE:
							y = -y;
							phi = HALF_PI - phi;
							break;
						case this.S_POLE:
							phi -= HALF_PI;
							break;
					}
					lam =
						y === 0 &&
						(this.mode === this.EQUIT || this.mode === this.OBLIQ)
							? 0
							: Math.atan2(x, y);
				} else {
					ab = 0;
					if (this.mode === this.OBLIQ || this.mode === this.EQUIT) {
						x /= this.dd;
						y *= this.dd;
						rho = Math.sqrt(x * x + y * y);
						if (rho < EPSLN) {
							p.x = this.long0;
							p.y = this.lat0;
							return p;
						}
						sCe = 2 * Math.asin((0.5 * rho) / this.rq);
						cCe = Math.cos(sCe);
						x *= sCe = Math.sin(sCe);
						if (this.mode === this.OBLIQ) {
							ab =
								cCe * this.sinb1 + (y * sCe * this.cosb1) / rho;
							q = this.qp * ab;
							y = rho * this.cosb1 * cCe - y * this.sinb1 * sCe;
						} else {
							ab = (y * sCe) / rho;
							q = this.qp * ab;
							y = rho * cCe;
						}
					} else if (
						this.mode === this.N_POLE ||
						this.mode === this.S_POLE
					) {
						if (this.mode === this.N_POLE) {
							y = -y;
						}
						q = x * x + y * y;
						if (!q) {
							p.x = this.long0;
							p.y = this.lat0;
							return p;
						}
						ab = 1 - q / this.qp;
						if (this.mode === this.S_POLE) {
							ab = -ab;
						}
					}
					lam = Math.atan2(x, y);
					phi = authlat(Math.asin(ab), this.apa);
				}
				p.x = adjust_lon(this.long0 + lam, this.over);
				p.y = phi;
				return p;
			}
			var names$m = [
				"Lambert Azimuthal Equal Area",
				"Lambert_Azimuthal_Equal_Area",
				"laea",
			];
			var laea = {
				init: init$m,
				forward: forward$l,
				inverse: inverse$l,
				names: names$m,
				S_POLE,
				N_POLE,
				EQUIT,
				OBLIQ,
			};
			function asinz(x) {
				if (Math.abs(x) > 1) {
					x = x > 1 ? 1 : -1;
				}
				return Math.asin(x);
			}
			function init$l() {
				if (Math.abs(this.lat1 + this.lat2) < EPSLN) {
					return;
				}
				this.temp = this.b / this.a;
				this.es = 1 - Math.pow(this.temp, 2);
				this.e3 = Math.sqrt(this.es);
				this.sin_po = Math.sin(this.lat1);
				this.cos_po = Math.cos(this.lat1);
				this.t1 = this.sin_po;
				this.con = this.sin_po;
				this.ms1 = msfnz(this.e3, this.sin_po, this.cos_po);
				this.qs1 = qsfnz(this.e3, this.sin_po);
				this.sin_po = Math.sin(this.lat2);
				this.cos_po = Math.cos(this.lat2);
				this.t2 = this.sin_po;
				this.ms2 = msfnz(this.e3, this.sin_po, this.cos_po);
				this.qs2 = qsfnz(this.e3, this.sin_po);
				this.sin_po = Math.sin(this.lat0);
				this.cos_po = Math.cos(this.lat0);
				this.t3 = this.sin_po;
				this.qs0 = qsfnz(this.e3, this.sin_po);
				if (Math.abs(this.lat1 - this.lat2) > EPSLN) {
					this.ns0 =
						(this.ms1 * this.ms1 - this.ms2 * this.ms2) /
						(this.qs2 - this.qs1);
				} else {
					this.ns0 = this.con;
				}
				this.c = this.ms1 * this.ms1 + this.ns0 * this.qs1;
				this.rh =
					(this.a * Math.sqrt(this.c - this.ns0 * this.qs0)) /
					this.ns0;
			}
			function forward$k(p) {
				var lon = p.x;
				var lat = p.y;
				this.sin_phi = Math.sin(lat);
				this.cos_phi = Math.cos(lat);
				var qs = qsfnz(this.e3, this.sin_phi);
				var rh1 =
					(this.a * Math.sqrt(this.c - this.ns0 * qs)) / this.ns0;
				var theta = this.ns0 * adjust_lon(lon - this.long0, this.over);
				var x = rh1 * Math.sin(theta) + this.x0;
				var y = this.rh - rh1 * Math.cos(theta) + this.y0;
				p.x = x;
				p.y = y;
				return p;
			}
			function inverse$k(p) {
				var rh1, qs, con, theta, lon, lat;
				p.x -= this.x0;
				p.y = this.rh - p.y + this.y0;
				if (this.ns0 >= 0) {
					rh1 = Math.sqrt(p.x * p.x + p.y * p.y);
					con = 1;
				} else {
					rh1 = -Math.sqrt(p.x * p.x + p.y * p.y);
					con = -1;
				}
				theta = 0;
				if (rh1 !== 0) {
					theta = Math.atan2(con * p.x, con * p.y);
				}
				con = (rh1 * this.ns0) / this.a;
				if (this.sphere) {
					lat = Math.asin((this.c - con * con) / (2 * this.ns0));
				} else {
					qs = (this.c - con * con) / this.ns0;
					lat = this.phi1z(this.e3, qs);
				}
				lon = adjust_lon(theta / this.ns0 + this.long0, this.over);
				p.x = lon;
				p.y = lat;
				return p;
			}
			function phi1z(eccent, qs) {
				var sinphi, cosphi, con, com, dphi;
				var phi = asinz(0.5 * qs);
				if (eccent < EPSLN) {
					return phi;
				}
				var eccnts = eccent * eccent;
				for (var i = 1; i <= 25; i++) {
					sinphi = Math.sin(phi);
					cosphi = Math.cos(phi);
					con = eccent * sinphi;
					com = 1 - con * con;
					dphi =
						((0.5 * com * com) / cosphi) *
						(qs / (1 - eccnts) -
							sinphi / com +
							(0.5 / eccent) * Math.log((1 - con) / (1 + con)));
					phi = phi + dphi;
					if (Math.abs(dphi) <= 1e-7) {
						return phi;
					}
				}
				return null;
			}
			var names$l = [
				"Albers_Conic_Equal_Area",
				"Albers_Equal_Area",
				"Albers",
				"aea",
			];
			var aea = {
				init: init$l,
				forward: forward$k,
				inverse: inverse$k,
				names: names$l,
				phi1z,
			};
			function init$k() {
				this.sin_p14 = Math.sin(this.lat0);
				this.cos_p14 = Math.cos(this.lat0);
				this.infinity_dist = 1e3 * this.a;
				this.rc = 1;
			}
			function forward$j(p) {
				var sinphi, cosphi;
				var dlon;
				var coslon;
				var ksp;
				var g;
				var x, y;
				var lon = p.x;
				var lat = p.y;
				dlon = adjust_lon(lon - this.long0, this.over);
				sinphi = Math.sin(lat);
				cosphi = Math.cos(lat);
				coslon = Math.cos(dlon);
				g = this.sin_p14 * sinphi + this.cos_p14 * cosphi * coslon;
				ksp = 1;
				if (g > 0 || Math.abs(g) <= EPSLN) {
					x = this.x0 + (this.a * ksp * cosphi * Math.sin(dlon)) / g;
					y =
						this.y0 +
						(this.a *
							ksp *
							(this.cos_p14 * sinphi -
								this.sin_p14 * cosphi * coslon)) /
							g;
				} else {
					x = this.x0 + this.infinity_dist * cosphi * Math.sin(dlon);
					y =
						this.y0 +
						this.infinity_dist *
							(this.cos_p14 * sinphi -
								this.sin_p14 * cosphi * coslon);
				}
				p.x = x;
				p.y = y;
				return p;
			}
			function inverse$j(p) {
				var rh;
				var sinc, cosc;
				var c;
				var lon, lat;
				p.x = (p.x - this.x0) / this.a;
				p.y = (p.y - this.y0) / this.a;
				p.x /= this.k0;
				p.y /= this.k0;
				if ((rh = Math.sqrt(p.x * p.x + p.y * p.y))) {
					c = Math.atan2(rh, this.rc);
					sinc = Math.sin(c);
					cosc = Math.cos(c);
					lat = asinz(
						cosc * this.sin_p14 + (p.y * sinc * this.cos_p14) / rh,
					);
					lon = Math.atan2(
						p.x * sinc,
						rh * this.cos_p14 * cosc - p.y * this.sin_p14 * sinc,
					);
					lon = adjust_lon(this.long0 + lon, this.over);
				} else {
					lat = this.phic0;
					lon = 0;
				}
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$k = ["gnom"];
			var gnom = {
				init: init$k,
				forward: forward$j,
				inverse: inverse$j,
				names: names$k,
			};
			function iqsfnz(eccent, q) {
				var temp =
					1 -
					((1 - eccent * eccent) / (2 * eccent)) *
						Math.log((1 - eccent) / (1 + eccent));
				if (Math.abs(Math.abs(q) - temp) < 1e-6) {
					if (q < 0) {
						return -1 * HALF_PI;
					} else {
						return HALF_PI;
					}
				}
				var phi = Math.asin(0.5 * q);
				var dphi;
				var sin_phi;
				var cos_phi;
				var con;
				for (var i = 0; i < 30; i++) {
					sin_phi = Math.sin(phi);
					cos_phi = Math.cos(phi);
					con = eccent * sin_phi;
					dphi =
						(Math.pow(1 - con * con, 2) / (2 * cos_phi)) *
						(q / (1 - eccent * eccent) -
							sin_phi / (1 - con * con) +
							(0.5 / eccent) * Math.log((1 - con) / (1 + con)));
					phi += dphi;
					if (Math.abs(dphi) <= 1e-10) {
						return phi;
					}
				}
				return NaN;
			}
			function init$j() {
				if (!this.sphere) {
					this.k0 = msfnz(
						this.e,
						Math.sin(this.lat_ts),
						Math.cos(this.lat_ts),
					);
				}
			}
			function forward$i(p) {
				var lon = p.x;
				var lat = p.y;
				var x, y;
				var dlon = adjust_lon(lon - this.long0, this.over);
				if (this.sphere) {
					x = this.x0 + this.a * dlon * Math.cos(this.lat_ts);
					y =
						this.y0 +
						(this.a * Math.sin(lat)) / Math.cos(this.lat_ts);
				} else {
					var qs = qsfnz(this.e, Math.sin(lat));
					x = this.x0 + this.a * this.k0 * dlon;
					y = this.y0 + (this.a * qs * 0.5) / this.k0;
				}
				p.x = x;
				p.y = y;
				return p;
			}
			function inverse$i(p) {
				p.x -= this.x0;
				p.y -= this.y0;
				var lon, lat;
				if (this.sphere) {
					lon = adjust_lon(
						this.long0 + p.x / this.a / Math.cos(this.lat_ts),
						this.over,
					);
					lat = Math.asin((p.y / this.a) * Math.cos(this.lat_ts));
				} else {
					lat = iqsfnz(this.e, (2 * p.y * this.k0) / this.a);
					lon = adjust_lon(
						this.long0 + p.x / (this.a * this.k0),
						this.over,
					);
				}
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$j = ["cea"];
			var cea = {
				init: init$j,
				forward: forward$i,
				inverse: inverse$i,
				names: names$j,
			};
			function init$i() {
				this.x0 = this.x0 || 0;
				this.y0 = this.y0 || 0;
				this.lat0 = this.lat0 || 0;
				this.long0 = this.long0 || 0;
				this.lat_ts = this.lat_ts || 0;
				this.title =
					this.title || "Equidistant Cylindrical (Plate Carre)";
				this.rc = Math.cos(this.lat_ts);
			}
			function forward$h(p) {
				var lon = p.x;
				var lat = p.y;
				var dlon = adjust_lon(lon - this.long0, this.over);
				var dlat = adjust_lat(lat - this.lat0);
				p.x = this.x0 + this.a * dlon * this.rc;
				p.y = this.y0 + this.a * dlat;
				return p;
			}
			function inverse$h(p) {
				var x = p.x;
				var y = p.y;
				p.x = adjust_lon(
					this.long0 + (x - this.x0) / (this.a * this.rc),
					this.over,
				);
				p.y = adjust_lat(this.lat0 + (y - this.y0) / this.a);
				return p;
			}
			var names$i = [
				"Equirectangular",
				"Equidistant_Cylindrical",
				"Equidistant_Cylindrical_Spherical",
				"eqc",
			];
			var eqc = {
				init: init$i,
				forward: forward$h,
				inverse: inverse$h,
				names: names$i,
			};
			var MAX_ITER$1 = 20;
			function init$h() {
				this.temp = this.b / this.a;
				this.es = 1 - Math.pow(this.temp, 2);
				this.e = Math.sqrt(this.es);
				this.e0 = e0fn(this.es);
				this.e1 = e1fn(this.es);
				this.e2 = e2fn(this.es);
				this.e3 = e3fn(this.es);
				this.ml0 =
					this.a *
					mlfn(this.e0, this.e1, this.e2, this.e3, this.lat0);
			}
			function forward$g(p) {
				var lon = p.x;
				var lat = p.y;
				var x, y, el;
				var dlon = adjust_lon(lon - this.long0, this.over);
				el = dlon * Math.sin(lat);
				if (this.sphere) {
					if (Math.abs(lat) <= EPSLN) {
						x = this.a * dlon;
						y = -1 * this.a * this.lat0;
					} else {
						x = (this.a * Math.sin(el)) / Math.tan(lat);
						y =
							this.a *
							(adjust_lat(lat - this.lat0) +
								(1 - Math.cos(el)) / Math.tan(lat));
					}
				} else {
					if (Math.abs(lat) <= EPSLN) {
						x = this.a * dlon;
						y = -1 * this.ml0;
					} else {
						var nl =
							gN(this.a, this.e, Math.sin(lat)) / Math.tan(lat);
						x = nl * Math.sin(el);
						y =
							this.a *
								mlfn(this.e0, this.e1, this.e2, this.e3, lat) -
							this.ml0 +
							nl * (1 - Math.cos(el));
					}
				}
				p.x = x + this.x0;
				p.y = y + this.y0;
				return p;
			}
			function inverse$g(p) {
				var lon, lat, x, y, i;
				var al, bl;
				var phi, dphi;
				x = p.x - this.x0;
				y = p.y - this.y0;
				if (this.sphere) {
					if (Math.abs(y + this.a * this.lat0) <= EPSLN) {
						lon = adjust_lon(x / this.a + this.long0, this.over);
						lat = 0;
					} else {
						al = this.lat0 + y / this.a;
						bl = (x * x) / this.a / this.a + al * al;
						phi = al;
						var tanphi;
						for (i = MAX_ITER$1; i; --i) {
							tanphi = Math.tan(phi);
							dphi =
								(-1 *
									(al * (phi * tanphi + 1) -
										phi -
										0.5 * (phi * phi + bl) * tanphi)) /
								((phi - al) / tanphi - 1);
							phi += dphi;
							if (Math.abs(dphi) <= EPSLN) {
								lat = phi;
								break;
							}
						}
						lon = adjust_lon(
							this.long0 +
								Math.asin((x * Math.tan(phi)) / this.a) /
									Math.sin(lat),
							this.over,
						);
					}
				} else {
					if (Math.abs(y + this.ml0) <= EPSLN) {
						lat = 0;
						lon = adjust_lon(this.long0 + x / this.a, this.over);
					} else {
						al = (this.ml0 + y) / this.a;
						bl = (x * x) / this.a / this.a + al * al;
						phi = al;
						var cl, mln, mlnp, ma;
						var con;
						for (i = MAX_ITER$1; i; --i) {
							con = this.e * Math.sin(phi);
							cl = Math.sqrt(1 - con * con) * Math.tan(phi);
							mln =
								this.a *
								mlfn(this.e0, this.e1, this.e2, this.e3, phi);
							mlnp =
								this.e0 -
								2 * this.e1 * Math.cos(2 * phi) +
								4 * this.e2 * Math.cos(4 * phi) -
								6 * this.e3 * Math.cos(6 * phi);
							ma = mln / this.a;
							dphi =
								(al * (cl * ma + 1) -
									ma -
									0.5 * cl * (ma * ma + bl)) /
								((this.es *
									Math.sin(2 * phi) *
									(ma * ma + bl - 2 * al * ma)) /
									(4 * cl) +
									(al - ma) *
										(cl * mlnp - 2 / Math.sin(2 * phi)) -
									mlnp);
							phi -= dphi;
							if (Math.abs(dphi) <= EPSLN) {
								lat = phi;
								break;
							}
						}
						cl =
							Math.sqrt(
								1 - this.es * Math.pow(Math.sin(lat), 2),
							) * Math.tan(lat);
						lon = adjust_lon(
							this.long0 +
								Math.asin((x * cl) / this.a) / Math.sin(lat),
							this.over,
						);
					}
				}
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$h = ["Polyconic", "American_Polyconic", "poly"];
			var poly = {
				init: init$h,
				forward: forward$g,
				inverse: inverse$g,
				names: names$h,
			};
			var iterations = 1;
			function init$g() {
				this.A = [];
				this.A[1] = 0.6399175073;
				this.A[2] = -0.1358797613;
				this.A[3] = 0.063294409;
				this.A[4] = -0.02526853;
				this.A[5] = 0.0117879;
				this.A[6] = -55161e-7;
				this.A[7] = 26906e-7;
				this.A[8] = -1333e-6;
				this.A[9] = 67e-5;
				this.A[10] = -34e-5;
				this.B_re = [];
				this.B_im = [];
				this.B_re[1] = 0.7557853228;
				this.B_im[1] = 0;
				this.B_re[2] = 0.249204646;
				this.B_im[2] = 3371507e-9;
				this.B_re[3] = -1541739e-9;
				this.B_im[3] = 0.04105856;
				this.B_re[4] = -0.10162907;
				this.B_im[4] = 0.01727609;
				this.B_re[5] = -0.26623489;
				this.B_im[5] = -0.36249218;
				this.B_re[6] = -0.6870983;
				this.B_im[6] = -1.1651967;
				this.C_re = [];
				this.C_im = [];
				this.C_re[1] = 1.3231270439;
				this.C_im[1] = 0;
				this.C_re[2] = -0.577245789;
				this.C_im[2] = -7809598e-9;
				this.C_re[3] = 0.508307513;
				this.C_im[3] = -0.112208952;
				this.C_re[4] = -0.15094762;
				this.C_im[4] = 0.18200602;
				this.C_re[5] = 1.01418179;
				this.C_im[5] = 1.64497696;
				this.C_re[6] = 1.9660549;
				this.C_im[6] = 2.5127645;
				this.D = [];
				this.D[1] = 1.5627014243;
				this.D[2] = 0.5185406398;
				this.D[3] = -0.03333098;
				this.D[4] = -0.1052906;
				this.D[5] = -0.0368594;
				this.D[6] = 7317e-6;
				this.D[7] = 0.0122;
				this.D[8] = 394e-5;
				this.D[9] = -13e-4;
			}
			function forward$f(p) {
				var n;
				var lon = p.x;
				var lat = p.y;
				var delta_lat = lat - this.lat0;
				var delta_lon = lon - this.long0;
				var d_phi = (delta_lat / SEC_TO_RAD) * 1e-5;
				var d_lambda = delta_lon;
				var d_phi_n = 1;
				var d_psi = 0;
				for (n = 1; n <= 10; n++) {
					d_phi_n = d_phi_n * d_phi;
					d_psi = d_psi + this.A[n] * d_phi_n;
				}
				var th_re = d_psi;
				var th_im = d_lambda;
				var th_n_re = 1;
				var th_n_im = 0;
				var th_n_re1;
				var th_n_im1;
				var z_re = 0;
				var z_im = 0;
				for (n = 1; n <= 6; n++) {
					th_n_re1 = th_n_re * th_re - th_n_im * th_im;
					th_n_im1 = th_n_im * th_re + th_n_re * th_im;
					th_n_re = th_n_re1;
					th_n_im = th_n_im1;
					z_re =
						z_re + this.B_re[n] * th_n_re - this.B_im[n] * th_n_im;
					z_im =
						z_im + this.B_im[n] * th_n_re + this.B_re[n] * th_n_im;
				}
				p.x = z_im * this.a + this.x0;
				p.y = z_re * this.a + this.y0;
				return p;
			}
			function inverse$f(p) {
				var n;
				var x = p.x;
				var y = p.y;
				var delta_x = x - this.x0;
				var delta_y = y - this.y0;
				var z_re = delta_y / this.a;
				var z_im = delta_x / this.a;
				var z_n_re = 1;
				var z_n_im = 0;
				var z_n_re1;
				var z_n_im1;
				var th_re = 0;
				var th_im = 0;
				for (n = 1; n <= 6; n++) {
					z_n_re1 = z_n_re * z_re - z_n_im * z_im;
					z_n_im1 = z_n_im * z_re + z_n_re * z_im;
					z_n_re = z_n_re1;
					z_n_im = z_n_im1;
					th_re =
						th_re + this.C_re[n] * z_n_re - this.C_im[n] * z_n_im;
					th_im =
						th_im + this.C_im[n] * z_n_re + this.C_re[n] * z_n_im;
				}
				for (var i = 0; i < this.iterations; i++) {
					var th_n_re = th_re;
					var th_n_im = th_im;
					var th_n_re1;
					var th_n_im1;
					var num_re = z_re;
					var num_im = z_im;
					for (n = 2; n <= 6; n++) {
						th_n_re1 = th_n_re * th_re - th_n_im * th_im;
						th_n_im1 = th_n_im * th_re + th_n_re * th_im;
						th_n_re = th_n_re1;
						th_n_im = th_n_im1;
						num_re =
							num_re +
							(n - 1) *
								(this.B_re[n] * th_n_re -
									this.B_im[n] * th_n_im);
						num_im =
							num_im +
							(n - 1) *
								(this.B_im[n] * th_n_re +
									this.B_re[n] * th_n_im);
					}
					th_n_re = 1;
					th_n_im = 0;
					var den_re = this.B_re[1];
					var den_im = this.B_im[1];
					for (n = 2; n <= 6; n++) {
						th_n_re1 = th_n_re * th_re - th_n_im * th_im;
						th_n_im1 = th_n_im * th_re + th_n_re * th_im;
						th_n_re = th_n_re1;
						th_n_im = th_n_im1;
						den_re =
							den_re +
							n *
								(this.B_re[n] * th_n_re -
									this.B_im[n] * th_n_im);
						den_im =
							den_im +
							n *
								(this.B_im[n] * th_n_re +
									this.B_re[n] * th_n_im);
					}
					var den2 = den_re * den_re + den_im * den_im;
					th_re = (num_re * den_re + num_im * den_im) / den2;
					th_im = (num_im * den_re - num_re * den_im) / den2;
				}
				var d_psi = th_re;
				var d_lambda = th_im;
				var d_psi_n = 1;
				var d_phi = 0;
				for (n = 1; n <= 9; n++) {
					d_psi_n = d_psi_n * d_psi;
					d_phi = d_phi + this.D[n] * d_psi_n;
				}
				var lat = this.lat0 + d_phi * SEC_TO_RAD * 1e5;
				var lon = this.long0 + d_lambda;
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$g = ["New_Zealand_Map_Grid", "nzmg"];
			var nzmg = {
				init: init$g,
				forward: forward$f,
				inverse: inverse$f,
				names: names$g,
				iterations,
			};
			function init$f() {}
			function forward$e(p) {
				var lon = p.x;
				var lat = p.y;
				var dlon = adjust_lon(lon - this.long0, this.over);
				var x = this.x0 + this.a * dlon;
				var y =
					this.y0 +
					this.a * Math.log(Math.tan(Math.PI / 4 + lat / 2.5)) * 1.25;
				p.x = x;
				p.y = y;
				return p;
			}
			function inverse$e(p) {
				p.x -= this.x0;
				p.y -= this.y0;
				var lon = adjust_lon(this.long0 + p.x / this.a, this.over);
				var lat =
					2.5 *
					(Math.atan(Math.exp((0.8 * p.y) / this.a)) - Math.PI / 4);
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$f = ["Miller_Cylindrical", "mill"];
			var mill = {
				init: init$f,
				forward: forward$e,
				inverse: inverse$e,
				names: names$f,
			};
			var MAX_ITER = 20;
			function init$e() {
				this.long0 = this.long0 || 0;
				if (!this.sphere) {
					this.en = pj_enfn(this.es);
				} else {
					this.n = 1;
					this.m = 0;
					this.es = 0;
					this.C_y = Math.sqrt((this.m + 1) / this.n);
					this.C_x = this.C_y / (this.m + 1);
				}
			}
			function forward$d(p) {
				var x, y;
				var lon = p.x;
				var lat = p.y;
				lon = adjust_lon(lon - this.long0, this.over);
				if (this.sphere) {
					if (!this.m) {
						lat =
							this.n !== 1
								? Math.asin(this.n * Math.sin(lat))
								: lat;
					} else {
						var k = this.n * Math.sin(lat);
						for (var i = MAX_ITER; i; --i) {
							var V2 =
								(this.m * lat + Math.sin(lat) - k) /
								(this.m + Math.cos(lat));
							lat -= V2;
							if (Math.abs(V2) < EPSLN) {
								break;
							}
						}
					}
					x = this.a * this.C_x * lon * (this.m + Math.cos(lat));
					y = this.a * this.C_y * lat;
				} else {
					var s = Math.sin(lat);
					var c = Math.cos(lat);
					y = this.a * pj_mlfn(lat, s, c, this.en);
					x = (this.a * lon * c) / Math.sqrt(1 - this.es * s * s);
				}
				p.x = x;
				p.y = y;
				return p;
			}
			function inverse$d(p) {
				var lat, temp, lon, s;
				p.x -= this.x0;
				lon = p.x / this.a;
				p.y -= this.y0;
				lat = p.y / this.a;
				if (this.sphere) {
					lat /= this.C_y;
					lon = lon / (this.C_x * (this.m + Math.cos(lat)));
					if (this.m) {
						lat = asinz((this.m * lat + Math.sin(lat)) / this.n);
					} else if (this.n !== 1) {
						lat = asinz(Math.sin(lat) / this.n);
					}
					lon = adjust_lon(lon + this.long0, this.over);
					lat = adjust_lat(lat);
				} else {
					lat = pj_inv_mlfn(p.y / this.a, this.es, this.en);
					s = Math.abs(lat);
					if (s < HALF_PI) {
						s = Math.sin(lat);
						temp =
							this.long0 +
							(p.x * Math.sqrt(1 - this.es * s * s)) /
								(this.a * Math.cos(lat));
						lon = adjust_lon(temp, this.over);
					} else if (s - EPSLN < HALF_PI) {
						lon = this.long0;
					}
				}
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$e = ["Sinusoidal", "sinu"];
			var sinu = {
				init: init$e,
				forward: forward$d,
				inverse: inverse$d,
				names: names$e,
			};
			function init$d() {
				this.sphere = true;
				this.b = this.a;
				this.m = 1;
				this.n = 2.5707963267948966;
				this.es = 0;
				this.C_y = Math.sqrt((this.m + 1) / this.n);
				this.C_x = this.C_y / (this.m + 1);
			}
			var forward$c = forward$d;
			var inverse$c = inverse$d;
			var names$d = ["Eckert_VI", "eck6"];
			var eck6 = {
				init: init$d,
				forward: forward$c,
				inverse: inverse$c,
				names: names$d,
			};
			function init$c() {
				this.x0 = this.x0 !== void 0 ? this.x0 : 0;
				this.y0 = this.y0 !== void 0 ? this.y0 : 0;
				this.long0 = this.long0 !== void 0 ? this.long0 : 0;
			}
			function forward$b(p) {
				var lon = p.x;
				var lat = p.y;
				var delta_lon = adjust_lon(lon - this.long0, this.over);
				var theta = lat;
				var con = Math.PI * Math.sin(lat);
				while (true) {
					var delta_theta =
						-(theta + Math.sin(theta) - con) /
						(1 + Math.cos(theta));
					theta += delta_theta;
					if (Math.abs(delta_theta) < EPSLN) {
						break;
					}
				}
				theta /= 2;
				if (Math.PI / 2 - Math.abs(lat) < EPSLN) {
					delta_lon = 0;
				}
				var x =
					0.900316316158 * this.a * delta_lon * Math.cos(theta) +
					this.x0;
				var y = 1.4142135623731 * this.a * Math.sin(theta) + this.y0;
				p.x = x;
				p.y = y;
				return p;
			}
			function inverse$b(p) {
				var theta;
				var arg;
				p.x -= this.x0;
				p.y -= this.y0;
				arg = p.y / (1.4142135623731 * this.a);
				if (Math.abs(arg) > 0.999999999999) {
					arg = 0.999999999999;
				}
				theta = Math.asin(arg);
				var lon = adjust_lon(
					this.long0 +
						p.x / (0.900316316158 * this.a * Math.cos(theta)),
					this.over,
				);
				if (lon < -Math.PI) {
					lon = -Math.PI;
				}
				if (lon > Math.PI) {
					lon = Math.PI;
				}
				arg = (2 * theta + Math.sin(2 * theta)) / Math.PI;
				if (Math.abs(arg) > 1) {
					arg = 1;
				}
				var lat = Math.asin(arg);
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$c = ["Mollweide", "moll"];
			var moll = {
				init: init$c,
				forward: forward$b,
				inverse: inverse$b,
				names: names$c,
			};
			function init$b() {
				if (Math.abs(this.lat1 + this.lat2) < EPSLN) {
					return;
				}
				this.lat2 = this.lat2 || this.lat1;
				this.temp = this.b / this.a;
				this.es = 1 - Math.pow(this.temp, 2);
				this.e = Math.sqrt(this.es);
				this.e0 = e0fn(this.es);
				this.e1 = e1fn(this.es);
				this.e2 = e2fn(this.es);
				this.e3 = e3fn(this.es);
				this.sin_phi = Math.sin(this.lat1);
				this.cos_phi = Math.cos(this.lat1);
				this.ms1 = msfnz(this.e, this.sin_phi, this.cos_phi);
				this.ml1 = mlfn(this.e0, this.e1, this.e2, this.e3, this.lat1);
				if (Math.abs(this.lat1 - this.lat2) < EPSLN) {
					this.ns = this.sin_phi;
				} else {
					this.sin_phi = Math.sin(this.lat2);
					this.cos_phi = Math.cos(this.lat2);
					this.ms2 = msfnz(this.e, this.sin_phi, this.cos_phi);
					this.ml2 = mlfn(
						this.e0,
						this.e1,
						this.e2,
						this.e3,
						this.lat2,
					);
					this.ns = (this.ms1 - this.ms2) / (this.ml2 - this.ml1);
				}
				this.g = this.ml1 + this.ms1 / this.ns;
				this.ml0 = mlfn(this.e0, this.e1, this.e2, this.e3, this.lat0);
				this.rh = this.a * (this.g - this.ml0);
			}
			function forward$a(p) {
				var lon = p.x;
				var lat = p.y;
				var rh1;
				if (this.sphere) {
					rh1 = this.a * (this.g - lat);
				} else {
					var ml = mlfn(this.e0, this.e1, this.e2, this.e3, lat);
					rh1 = this.a * (this.g - ml);
				}
				var theta = this.ns * adjust_lon(lon - this.long0, this.over);
				var x = this.x0 + rh1 * Math.sin(theta);
				var y = this.y0 + this.rh - rh1 * Math.cos(theta);
				p.x = x;
				p.y = y;
				return p;
			}
			function inverse$a(p) {
				p.x -= this.x0;
				p.y = this.rh - p.y + this.y0;
				var con, rh1, lat, lon;
				if (this.ns >= 0) {
					rh1 = Math.sqrt(p.x * p.x + p.y * p.y);
					con = 1;
				} else {
					rh1 = -Math.sqrt(p.x * p.x + p.y * p.y);
					con = -1;
				}
				var theta = 0;
				if (rh1 !== 0) {
					theta = Math.atan2(con * p.x, con * p.y);
				}
				if (this.sphere) {
					lon = adjust_lon(this.long0 + theta / this.ns, this.over);
					lat = adjust_lat(this.g - rh1 / this.a);
					p.x = lon;
					p.y = lat;
					return p;
				} else {
					var ml = this.g - rh1 / this.a;
					lat = imlfn(ml, this.e0, this.e1, this.e2, this.e3);
					lon = adjust_lon(this.long0 + theta / this.ns, this.over);
					p.x = lon;
					p.y = lat;
					return p;
				}
			}
			var names$b = ["Equidistant_Conic", "eqdc"];
			var eqdc = {
				init: init$b,
				forward: forward$a,
				inverse: inverse$a,
				names: names$b,
			};
			function init$a() {
				this.R = this.a;
			}
			function forward$9(p) {
				var lon = p.x;
				var lat = p.y;
				var dlon = adjust_lon(lon - this.long0, this.over);
				var x, y;
				if (Math.abs(lat) <= EPSLN) {
					x = this.x0 + this.R * dlon;
					y = this.y0;
					p.x = x;
					p.y = y;
					return p;
				}
				var theta = asinz(2 * Math.abs(lat / Math.PI));
				if (
					Math.abs(dlon) <= EPSLN ||
					Math.abs(Math.abs(lat) - HALF_PI) <= EPSLN
				) {
					x = this.x0;
					if (lat >= 0) {
						y = this.y0 + Math.PI * this.R * Math.tan(0.5 * theta);
					} else {
						y = this.y0 + Math.PI * this.R * -Math.tan(0.5 * theta);
					}
					p.x = x;
					p.y = y;
					return p;
				}
				var al = 0.5 * Math.abs(Math.PI / dlon - dlon / Math.PI);
				var asq = al * al;
				var sinth = Math.sin(theta);
				var costh = Math.cos(theta);
				var g = costh / (sinth + costh - 1);
				var gsq = g * g;
				var m = g * (2 / sinth - 1);
				var msq = m * m;
				var con =
					(Math.PI *
						this.R *
						(al * (g - msq) +
							Math.sqrt(
								asq * (g - msq) * (g - msq) -
									(msq + asq) * (gsq - msq),
							))) /
					(msq + asq);
				if (dlon < 0) {
					con = -con;
				}
				x = this.x0 + con;
				var q = asq + g;
				con =
					(Math.PI *
						this.R *
						(m * q -
							al * Math.sqrt((msq + asq) * (asq + 1) - q * q))) /
					(msq + asq);
				if (lat >= 0) {
					y = this.y0 + con;
				} else {
					y = this.y0 - con;
				}
				p.x = x;
				p.y = y;
				return p;
			}
			function inverse$9(p) {
				var lon, lat;
				var xx, yy, xys, c1, c2, c3;
				var a1;
				var m1;
				var con;
				var th1;
				var d;
				p.x -= this.x0;
				p.y -= this.y0;
				con = Math.PI * this.R;
				xx = p.x / con;
				yy = p.y / con;
				xys = xx * xx + yy * yy;
				c1 = -Math.abs(yy) * (1 + xys);
				c2 = c1 - 2 * yy * yy + xx * xx;
				c3 = -2 * c1 + 1 + 2 * yy * yy + xys * xys;
				d =
					(yy * yy) / c3 +
					((2 * c2 * c2 * c2) / c3 / c3 / c3 -
						(9 * c1 * c2) / c3 / c3) /
						27;
				a1 = (c1 - (c2 * c2) / 3 / c3) / c3;
				m1 = 2 * Math.sqrt(-a1 / 3);
				con = (3 * d) / a1 / m1;
				if (Math.abs(con) > 1) {
					if (con >= 0) {
						con = 1;
					} else {
						con = -1;
					}
				}
				th1 = Math.acos(con) / 3;
				if (p.y >= 0) {
					lat =
						(-m1 * Math.cos(th1 + Math.PI / 3) - c2 / 3 / c3) *
						Math.PI;
				} else {
					lat =
						-(-m1 * Math.cos(th1 + Math.PI / 3) - c2 / 3 / c3) *
						Math.PI;
				}
				if (Math.abs(xx) < EPSLN) {
					lon = this.long0;
				} else {
					lon = adjust_lon(
						this.long0 +
							(Math.PI *
								(xys -
									1 +
									Math.sqrt(
										1 + 2 * (xx * xx - yy * yy) + xys * xys,
									))) /
								2 /
								xx,
						this.over,
					);
				}
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$a = [
				"Van_der_Grinten_I",
				"VanDerGrinten",
				"Van_der_Grinten",
				"vandg",
			];
			var vandg = {
				init: init$a,
				forward: forward$9,
				inverse: inverse$9,
				names: names$a,
			};
			function vincentyInverse(lat1, lon1, lat2, lon2, a, f) {
				const L = lon2 - lon1;
				const U1 = Math.atan((1 - f) * Math.tan(lat1));
				const U2 = Math.atan((1 - f) * Math.tan(lat2));
				const sinU1 = Math.sin(U1),
					cosU1 = Math.cos(U1);
				const sinU2 = Math.sin(U2),
					cosU2 = Math.cos(U2);
				let lambda = L,
					lambdaP,
					iterLimit = 100;
				let sinLambda,
					cosLambda,
					sinSigma,
					cosSigma,
					sigma,
					sinAlpha,
					cos2Alpha,
					cos2SigmaM,
					C;
				let uSq, A5, B, deltaSigma, s;
				do {
					sinLambda = Math.sin(lambda);
					cosLambda = Math.cos(lambda);
					sinSigma = Math.sqrt(
						cosU2 * sinLambda * (cosU2 * sinLambda) +
							(cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) *
								(cosU1 * sinU2 - sinU1 * cosU2 * cosLambda),
					);
					if (sinSigma === 0) {
						return { azi1: 0, s12: 0 };
					}
					cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
					sigma = Math.atan2(sinSigma, cosSigma);
					sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
					cos2Alpha = 1 - sinAlpha * sinAlpha;
					cos2SigmaM =
						cos2Alpha !== 0
							? cosSigma - (2 * sinU1 * sinU2) / cos2Alpha
							: 0;
					C = (f / 16) * cos2Alpha * (4 + f * (4 - 3 * cos2Alpha));
					lambdaP = lambda;
					lambda =
						L +
						(1 - C) *
							f *
							sinAlpha *
							(sigma +
								C *
									sinSigma *
									(cos2SigmaM +
										C *
											cosSigma *
											(-1 +
												2 * cos2SigmaM * cos2SigmaM)));
				} while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0);
				if (iterLimit === 0) {
					return { azi1: NaN, s12: NaN };
				}
				uSq =
					(cos2Alpha * (a * a - a * (1 - f) * (a * (1 - f)))) /
					(a * (1 - f) * (a * (1 - f)));
				A5 =
					1 +
					(uSq / 16384) *
						(4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
				B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
				deltaSigma =
					B *
					sinSigma *
					(cos2SigmaM +
						(B / 4) *
							(cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
								(B / 6) *
									cos2SigmaM *
									(-3 + 4 * sinSigma * sinSigma) *
									(-3 + 4 * cos2SigmaM * cos2SigmaM)));
				s = a * (1 - f) * A5 * (sigma - deltaSigma);
				const azi1 = Math.atan2(
					cosU2 * sinLambda,
					cosU1 * sinU2 - sinU1 * cosU2 * cosLambda,
				);
				return { azi1, s12: s };
			}
			function vincentyDirect(lat1, lon1, azi1, s12, a, f) {
				const U1 = Math.atan((1 - f) * Math.tan(lat1));
				const sinU1 = Math.sin(U1),
					cosU1 = Math.cos(U1);
				const sinAlpha1 = Math.sin(azi1),
					cosAlpha1 = Math.cos(azi1);
				const sigma1 = Math.atan2(sinU1, cosU1 * cosAlpha1);
				const sinAlpha = cosU1 * sinAlpha1;
				const cos2Alpha = 1 - sinAlpha * sinAlpha;
				const uSq =
					(cos2Alpha * (a * a - a * (1 - f) * (a * (1 - f)))) /
					(a * (1 - f) * (a * (1 - f)));
				const A5 =
					1 +
					(uSq / 16384) *
						(4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
				const B =
					(uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
				let sigma = s12 / (a * (1 - f) * A5),
					sigmaP,
					iterLimit = 100;
				let cos2SigmaM, sinSigma, cosSigma, deltaSigma;
				do {
					cos2SigmaM = Math.cos(2 * sigma1 + sigma);
					sinSigma = Math.sin(sigma);
					cosSigma = Math.cos(sigma);
					deltaSigma =
						B *
						sinSigma *
						(cos2SigmaM +
							(B / 4) *
								(cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
									(B / 6) *
										cos2SigmaM *
										(-3 + 4 * sinSigma * sinSigma) *
										(-3 + 4 * cos2SigmaM * cos2SigmaM)));
					sigmaP = sigma;
					sigma = s12 / (a * (1 - f) * A5) + deltaSigma;
				} while (Math.abs(sigma - sigmaP) > 1e-12 && --iterLimit > 0);
				if (iterLimit === 0) {
					return { lat2: NaN, lon2: NaN };
				}
				const tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
				const lat2 = Math.atan2(
					sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
					(1 - f) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp),
				);
				const lambda = Math.atan2(
					sinSigma * sinAlpha1,
					cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1,
				);
				const C = (f / 16) * cos2Alpha * (4 + f * (4 - 3 * cos2Alpha));
				const L =
					lambda -
					(1 - C) *
						f *
						sinAlpha *
						(sigma +
							C *
								sinSigma *
								(cos2SigmaM +
									C *
										cosSigma *
										(-1 + 2 * cos2SigmaM * cos2SigmaM)));
				const lon2 = lon1 + L;
				return { lat2, lon2 };
			}
			function init$9() {
				this.sin_p12 = Math.sin(this.lat0);
				this.cos_p12 = Math.cos(this.lat0);
				this.x0 = this.x0 || 0;
				this.y0 = this.y0 || 0;
				this.long0 = this.long0 || 0;
				this.f = this.es / (1 + Math.sqrt(1 - this.es));
			}
			function forward$8(p) {
				var lon = p.x;
				var lat = p.y;
				var sinphi = Math.sin(p.y);
				var cosphi = Math.cos(p.y);
				var dlon = adjust_lon(lon - this.long0, this.over);
				var e0, e1, e2, e3, Mlp, Ml, c, kp, cos_c, vars, azi1;
				if (this.sphere) {
					if (Math.abs(this.sin_p12 - 1) <= EPSLN) {
						p.x =
							this.x0 + this.a * (HALF_PI - lat) * Math.sin(dlon);
						p.y =
							this.y0 - this.a * (HALF_PI - lat) * Math.cos(dlon);
						return p;
					} else if (Math.abs(this.sin_p12 + 1) <= EPSLN) {
						p.x =
							this.x0 + this.a * (HALF_PI + lat) * Math.sin(dlon);
						p.y =
							this.y0 + this.a * (HALF_PI + lat) * Math.cos(dlon);
						return p;
					} else {
						cos_c =
							this.sin_p12 * sinphi +
							this.cos_p12 * cosphi * Math.cos(dlon);
						c = Math.acos(cos_c);
						kp = c ? c / Math.sin(c) : 1;
						p.x = this.x0 + this.a * kp * cosphi * Math.sin(dlon);
						p.y =
							this.y0 +
							this.a *
								kp *
								(this.cos_p12 * sinphi -
									this.sin_p12 * cosphi * Math.cos(dlon));
						return p;
					}
				} else {
					e0 = e0fn(this.es);
					e1 = e1fn(this.es);
					e2 = e2fn(this.es);
					e3 = e3fn(this.es);
					if (Math.abs(this.sin_p12 - 1) <= EPSLN) {
						Mlp = this.a * mlfn(e0, e1, e2, e3, HALF_PI);
						Ml = this.a * mlfn(e0, e1, e2, e3, lat);
						p.x = this.x0 + (Mlp - Ml) * Math.sin(dlon);
						p.y = this.y0 - (Mlp - Ml) * Math.cos(dlon);
						return p;
					} else if (Math.abs(this.sin_p12 + 1) <= EPSLN) {
						Mlp = this.a * mlfn(e0, e1, e2, e3, HALF_PI);
						Ml = this.a * mlfn(e0, e1, e2, e3, lat);
						p.x = this.x0 + (Mlp + Ml) * Math.sin(dlon);
						p.y = this.y0 + (Mlp + Ml) * Math.cos(dlon);
						return p;
					} else {
						if (
							Math.abs(lon) < EPSLN &&
							Math.abs(lat - this.lat0) < EPSLN
						) {
							p.x = this.x0;
							p.y = this.y0;
							return p;
						}
						vars = vincentyInverse(
							this.lat0,
							this.long0,
							lat,
							lon,
							this.a,
							this.f,
						);
						azi1 = vars.azi1;
						p.x = this.x0 + vars.s12 * Math.sin(azi1);
						p.y = this.y0 + vars.s12 * Math.cos(azi1);
						return p;
					}
				}
			}
			function inverse$8(p) {
				p.x -= this.x0;
				p.y -= this.y0;
				var rh,
					z,
					sinz,
					cosz,
					lon,
					lat,
					con,
					e0,
					e1,
					e2,
					e3,
					Mlp,
					M2,
					azi1,
					s12,
					vars;
				if (this.sphere) {
					rh = Math.sqrt(p.x * p.x + p.y * p.y);
					if (rh > 2 * HALF_PI * this.a) {
						return;
					}
					z = rh / this.a;
					sinz = Math.sin(z);
					cosz = Math.cos(z);
					lon = this.long0;
					if (Math.abs(rh) <= EPSLN) {
						lat = this.lat0;
					} else {
						lat = asinz(
							cosz * this.sin_p12 +
								(p.y * sinz * this.cos_p12) / rh,
						);
						con = Math.abs(this.lat0) - HALF_PI;
						if (Math.abs(con) <= EPSLN) {
							if (this.lat0 >= 0) {
								lon = adjust_lon(
									this.long0 + Math.atan2(p.x, -p.y),
									this.over,
								);
							} else {
								lon = adjust_lon(
									this.long0 - Math.atan2(-p.x, p.y),
									this.over,
								);
							}
						} else {
							lon = adjust_lon(
								this.long0 +
									Math.atan2(
										p.x * sinz,
										rh * this.cos_p12 * cosz -
											p.y * this.sin_p12 * sinz,
									),
								this.over,
							);
						}
					}
					p.x = lon;
					p.y = lat;
					return p;
				} else {
					e0 = e0fn(this.es);
					e1 = e1fn(this.es);
					e2 = e2fn(this.es);
					e3 = e3fn(this.es);
					if (Math.abs(this.sin_p12 - 1) <= EPSLN) {
						Mlp = this.a * mlfn(e0, e1, e2, e3, HALF_PI);
						rh = Math.sqrt(p.x * p.x + p.y * p.y);
						M2 = Mlp - rh;
						lat = imlfn(M2 / this.a, e0, e1, e2, e3);
						lon = adjust_lon(
							this.long0 + Math.atan2(p.x, -1 * p.y),
							this.over,
						);
						p.x = lon;
						p.y = lat;
						return p;
					} else if (Math.abs(this.sin_p12 + 1) <= EPSLN) {
						Mlp = this.a * mlfn(e0, e1, e2, e3, HALF_PI);
						rh = Math.sqrt(p.x * p.x + p.y * p.y);
						M2 = rh - Mlp;
						lat = imlfn(M2 / this.a, e0, e1, e2, e3);
						lon = adjust_lon(
							this.long0 + Math.atan2(p.x, p.y),
							this.over,
						);
						p.x = lon;
						p.y = lat;
						return p;
					} else {
						azi1 = Math.atan2(p.x, p.y);
						s12 = Math.sqrt(p.x * p.x + p.y * p.y);
						vars = vincentyDirect(
							this.lat0,
							this.long0,
							azi1,
							s12,
							this.a,
							this.f,
						);
						p.x = vars.lon2;
						p.y = vars.lat2;
						return p;
					}
				}
			}
			var names$9 = ["Azimuthal_Equidistant", "aeqd"];
			var aeqd = {
				init: init$9,
				forward: forward$8,
				inverse: inverse$8,
				names: names$9,
			};
			function init$8() {
				this.sin_p14 = Math.sin(this.lat0 || 0);
				this.cos_p14 = Math.cos(this.lat0 || 0);
			}
			function forward$7(p) {
				var sinphi, cosphi;
				var dlon;
				var coslon;
				var ksp;
				var g, x, y;
				var lon = p.x;
				var lat = p.y;
				dlon = adjust_lon(lon - (this.long0 || 0), this.over);
				sinphi = Math.sin(lat);
				cosphi = Math.cos(lat);
				coslon = Math.cos(dlon);
				g = this.sin_p14 * sinphi + this.cos_p14 * cosphi * coslon;
				ksp = 1;
				if (g > 0 || Math.abs(g) <= EPSLN) {
					x = (this.x0 || 0) + this.a * ksp * cosphi * Math.sin(dlon);
					y =
						(this.y0 || 0) +
						this.a *
							ksp *
							(this.cos_p14 * sinphi -
								this.sin_p14 * cosphi * coslon);
				}
				p.x = x;
				p.y = y;
				return p;
			}
			function inverse$7(p) {
				var rh;
				var z;
				var sinz, cosz;
				var con;
				var lon, lat;
				var long0, lat0;
				p.x -= this.x0 || 0;
				p.y -= this.y0 || 0;
				rh = Math.sqrt(p.x * p.x + p.y * p.y);
				z = asinz(rh / this.a);
				sinz = Math.sin(z);
				cosz = Math.cos(z);
				long0 = this.long0 || 0;
				lat0 = this.lat0 || 0;
				lon = long0;
				if (Math.abs(rh) <= EPSLN) {
					lat = lat0;
					p.x = lon;
					p.y = lat;
					return p;
				}
				lat = asinz(
					cosz * this.sin_p14 + (p.y * sinz * this.cos_p14) / rh,
				);
				con = Math.abs(lat0) - HALF_PI;
				if (Math.abs(con) <= EPSLN) {
					if (lat0 >= 0) {
						lon = adjust_lon(
							long0 + Math.atan2(p.x, -p.y),
							this.over,
						);
					} else {
						lon = adjust_lon(
							long0 - Math.atan2(-p.x, p.y),
							this.over,
						);
					}
					p.x = lon;
					p.y = lat;
					return p;
				}
				lon = adjust_lon(
					long0 +
						Math.atan2(
							p.x * sinz,
							rh * this.cos_p14 * cosz -
								p.y * this.sin_p14 * sinz,
						),
					this.over,
				);
				p.x = lon;
				p.y = lat;
				return p;
			}
			var names$8 = ["ortho"];
			var ortho = {
				init: init$8,
				forward: forward$7,
				inverse: inverse$7,
				names: names$8,
			};
			var FACE_ENUM = {
				FRONT: 1,
				RIGHT: 2,
				BACK: 3,
				LEFT: 4,
				TOP: 5,
				BOTTOM: 6,
			};
			var AREA_ENUM = {
				AREA_0: 1,
				AREA_1: 2,
				AREA_2: 3,
				AREA_3: 4,
			};
			function init$7() {
				this.x0 = this.x0 || 0;
				this.y0 = this.y0 || 0;
				this.lat0 = this.lat0 || 0;
				this.long0 = this.long0 || 0;
				this.lat_ts = this.lat_ts || 0;
				this.title = this.title || "Quadrilateralized Spherical Cube";
				if (this.lat0 >= HALF_PI - FORTPI / 2) {
					this.face = FACE_ENUM.TOP;
				} else if (this.lat0 <= -(HALF_PI - FORTPI / 2)) {
					this.face = FACE_ENUM.BOTTOM;
				} else if (Math.abs(this.long0) <= FORTPI) {
					this.face = FACE_ENUM.FRONT;
				} else if (Math.abs(this.long0) <= HALF_PI + FORTPI) {
					this.face =
						this.long0 > 0 ? FACE_ENUM.RIGHT : FACE_ENUM.LEFT;
				} else {
					this.face = FACE_ENUM.BACK;
				}
				if (this.es !== 0) {
					this.one_minus_f = 1 - (this.a - this.b) / this.a;
					this.one_minus_f_squared =
						this.one_minus_f * this.one_minus_f;
				}
			}
			function forward$6(p) {
				var xy = { x: 0, y: 0 };
				var lat, lon;
				var theta, phi;
				var t, mu;
				var area = { value: 0 };
				p.x -= this.long0;
				if (this.es !== 0) {
					lat = Math.atan(this.one_minus_f_squared * Math.tan(p.y));
				} else {
					lat = p.y;
				}
				lon = p.x;
				if (this.face === FACE_ENUM.TOP) {
					phi = HALF_PI - lat;
					if (lon >= FORTPI && lon <= HALF_PI + FORTPI) {
						area.value = AREA_ENUM.AREA_0;
						theta = lon - HALF_PI;
					} else if (
						lon > HALF_PI + FORTPI ||
						lon <= -(HALF_PI + FORTPI)
					) {
						area.value = AREA_ENUM.AREA_1;
						theta = lon > 0 ? lon - SPI : lon + SPI;
					} else if (lon > -(HALF_PI + FORTPI) && lon <= -FORTPI) {
						area.value = AREA_ENUM.AREA_2;
						theta = lon + HALF_PI;
					} else {
						area.value = AREA_ENUM.AREA_3;
						theta = lon;
					}
				} else if (this.face === FACE_ENUM.BOTTOM) {
					phi = HALF_PI + lat;
					if (lon >= FORTPI && lon <= HALF_PI + FORTPI) {
						area.value = AREA_ENUM.AREA_0;
						theta = -lon + HALF_PI;
					} else if (lon < FORTPI && lon >= -FORTPI) {
						area.value = AREA_ENUM.AREA_1;
						theta = -lon;
					} else if (lon < -FORTPI && lon >= -(HALF_PI + FORTPI)) {
						area.value = AREA_ENUM.AREA_2;
						theta = -lon - HALF_PI;
					} else {
						area.value = AREA_ENUM.AREA_3;
						theta = lon > 0 ? -lon + SPI : -lon - SPI;
					}
				} else {
					var q, r, s;
					var sinlat, coslat;
					var sinlon, coslon;
					if (this.face === FACE_ENUM.RIGHT) {
						lon = qsc_shift_lon_origin(lon, +HALF_PI);
					} else if (this.face === FACE_ENUM.BACK) {
						lon = qsc_shift_lon_origin(lon, +SPI);
					} else if (this.face === FACE_ENUM.LEFT) {
						lon = qsc_shift_lon_origin(lon, -HALF_PI);
					}
					sinlat = Math.sin(lat);
					coslat = Math.cos(lat);
					sinlon = Math.sin(lon);
					coslon = Math.cos(lon);
					q = coslat * coslon;
					r = coslat * sinlon;
					s = sinlat;
					if (this.face === FACE_ENUM.FRONT) {
						phi = Math.acos(q);
						theta = qsc_fwd_equat_face_theta(phi, s, r, area);
					} else if (this.face === FACE_ENUM.RIGHT) {
						phi = Math.acos(r);
						theta = qsc_fwd_equat_face_theta(phi, s, -q, area);
					} else if (this.face === FACE_ENUM.BACK) {
						phi = Math.acos(-q);
						theta = qsc_fwd_equat_face_theta(phi, s, -r, area);
					} else if (this.face === FACE_ENUM.LEFT) {
						phi = Math.acos(-r);
						theta = qsc_fwd_equat_face_theta(phi, s, q, area);
					} else {
						phi = theta = 0;
						area.value = AREA_ENUM.AREA_0;
					}
				}
				mu = Math.atan(
					(12 / SPI) *
						(theta +
							Math.acos(Math.sin(theta) * Math.cos(FORTPI)) -
							HALF_PI),
				);
				t = Math.sqrt(
					(1 - Math.cos(phi)) /
						(Math.cos(mu) * Math.cos(mu)) /
						(1 - Math.cos(Math.atan(1 / Math.cos(theta)))),
				);
				if (area.value === AREA_ENUM.AREA_1) {
					mu += HALF_PI;
				} else if (area.value === AREA_ENUM.AREA_2) {
					mu += SPI;
				} else if (area.value === AREA_ENUM.AREA_3) {
					mu += 1.5 * SPI;
				}
				xy.x = t * Math.cos(mu);
				xy.y = t * Math.sin(mu);
				xy.x = xy.x * this.a + this.x0;
				xy.y = xy.y * this.a + this.y0;
				p.x = xy.x;
				p.y = xy.y;
				return p;
			}
			function inverse$6(p) {
				var lp = { lam: 0, phi: 0 };
				var mu, nu, cosmu, tannu;
				var tantheta, theta, cosphi, phi;
				var t;
				var area = { value: 0 };
				p.x = (p.x - this.x0) / this.a;
				p.y = (p.y - this.y0) / this.a;
				nu = Math.atan(Math.sqrt(p.x * p.x + p.y * p.y));
				mu = Math.atan2(p.y, p.x);
				if (p.x >= 0 && p.x >= Math.abs(p.y)) {
					area.value = AREA_ENUM.AREA_0;
				} else if (p.y >= 0 && p.y >= Math.abs(p.x)) {
					area.value = AREA_ENUM.AREA_1;
					mu -= HALF_PI;
				} else if (p.x < 0 && -p.x >= Math.abs(p.y)) {
					area.value = AREA_ENUM.AREA_2;
					mu = mu < 0 ? mu + SPI : mu - SPI;
				} else {
					area.value = AREA_ENUM.AREA_3;
					mu += HALF_PI;
				}
				t = (SPI / 12) * Math.tan(mu);
				tantheta = Math.sin(t) / (Math.cos(t) - 1 / Math.sqrt(2));
				theta = Math.atan(tantheta);
				cosmu = Math.cos(mu);
				tannu = Math.tan(nu);
				cosphi =
					1 -
					cosmu *
						cosmu *
						tannu *
						tannu *
						(1 - Math.cos(Math.atan(1 / Math.cos(theta))));
				if (cosphi < -1) {
					cosphi = -1;
				} else if (cosphi > 1) {
					cosphi = 1;
				}
				if (this.face === FACE_ENUM.TOP) {
					phi = Math.acos(cosphi);
					lp.phi = HALF_PI - phi;
					if (area.value === AREA_ENUM.AREA_0) {
						lp.lam = theta + HALF_PI;
					} else if (area.value === AREA_ENUM.AREA_1) {
						lp.lam = theta < 0 ? theta + SPI : theta - SPI;
					} else if (area.value === AREA_ENUM.AREA_2) {
						lp.lam = theta - HALF_PI;
					} else {
						lp.lam = theta;
					}
				} else if (this.face === FACE_ENUM.BOTTOM) {
					phi = Math.acos(cosphi);
					lp.phi = phi - HALF_PI;
					if (area.value === AREA_ENUM.AREA_0) {
						lp.lam = -theta + HALF_PI;
					} else if (area.value === AREA_ENUM.AREA_1) {
						lp.lam = -theta;
					} else if (area.value === AREA_ENUM.AREA_2) {
						lp.lam = -theta - HALF_PI;
					} else {
						lp.lam = theta < 0 ? -theta - SPI : -theta + SPI;
					}
				} else {
					var q, r, s;
					q = cosphi;
					t = q * q;
					if (t >= 1) {
						s = 0;
					} else {
						s = Math.sqrt(1 - t) * Math.sin(theta);
					}
					t += s * s;
					if (t >= 1) {
						r = 0;
					} else {
						r = Math.sqrt(1 - t);
					}
					if (area.value === AREA_ENUM.AREA_1) {
						t = r;
						r = -s;
						s = t;
					} else if (area.value === AREA_ENUM.AREA_2) {
						r = -r;
						s = -s;
					} else if (area.value === AREA_ENUM.AREA_3) {
						t = r;
						r = s;
						s = -t;
					}
					if (this.face === FACE_ENUM.RIGHT) {
						t = q;
						q = -r;
						r = t;
					} else if (this.face === FACE_ENUM.BACK) {
						q = -q;
						r = -r;
					} else if (this.face === FACE_ENUM.LEFT) {
						t = q;
						q = r;
						r = -t;
					}
					lp.phi = Math.acos(-s) - HALF_PI;
					lp.lam = Math.atan2(r, q);
					if (this.face === FACE_ENUM.RIGHT) {
						lp.lam = qsc_shift_lon_origin(lp.lam, -HALF_PI);
					} else if (this.face === FACE_ENUM.BACK) {
						lp.lam = qsc_shift_lon_origin(lp.lam, -SPI);
					} else if (this.face === FACE_ENUM.LEFT) {
						lp.lam = qsc_shift_lon_origin(lp.lam, +HALF_PI);
					}
				}
				if (this.es !== 0) {
					var invert_sign;
					var tanphi, xa;
					invert_sign = lp.phi < 0 ? 1 : 0;
					tanphi = Math.tan(lp.phi);
					xa =
						this.b /
						Math.sqrt(tanphi * tanphi + this.one_minus_f_squared);
					lp.phi = Math.atan(
						Math.sqrt(this.a * this.a - xa * xa) /
							(this.one_minus_f * xa),
					);
					if (invert_sign) {
						lp.phi = -lp.phi;
					}
				}
				lp.lam += this.long0;
				p.x = lp.lam;
				p.y = lp.phi;
				return p;
			}
			function qsc_fwd_equat_face_theta(phi, y, x, area) {
				var theta;
				if (phi < EPSLN) {
					area.value = AREA_ENUM.AREA_0;
					theta = 0;
				} else {
					theta = Math.atan2(y, x);
					if (Math.abs(theta) <= FORTPI) {
						area.value = AREA_ENUM.AREA_0;
					} else if (theta > FORTPI && theta <= HALF_PI + FORTPI) {
						area.value = AREA_ENUM.AREA_1;
						theta -= HALF_PI;
					} else if (
						theta > HALF_PI + FORTPI ||
						theta <= -(HALF_PI + FORTPI)
					) {
						area.value = AREA_ENUM.AREA_2;
						theta = theta >= 0 ? theta - SPI : theta + SPI;
					} else {
						area.value = AREA_ENUM.AREA_3;
						theta += HALF_PI;
					}
				}
				return theta;
			}
			function qsc_shift_lon_origin(lon, offset) {
				var slon = lon + offset;
				if (slon < -SPI) {
					slon += TWO_PI;
				} else if (slon > +SPI) {
					slon -= TWO_PI;
				}
				return slon;
			}
			var names$7 = [
				"Quadrilateralized Spherical Cube",
				"Quadrilateralized_Spherical_Cube",
				"qsc",
			];
			var qsc = {
				init: init$7,
				forward: forward$6,
				inverse: inverse$6,
				names: names$7,
			};
			var COEFS_X = [
				[1, 22199e-21, -715515e-10, 31103e-10],
				[0.9986, -482243e-9, -24897e-9, -13309e-10],
				[0.9954, -83103e-8, -448605e-10, -986701e-12],
				[0.99, -135364e-8, -59661e-9, 36777e-10],
				[0.9822, -167442e-8, -449547e-11, -572411e-11],
				[0.973, -214868e-8, -903571e-10, 18736e-12],
				[0.96, -305085e-8, -900761e-10, 164917e-11],
				[0.9427, -382792e-8, -653386e-10, -26154e-10],
				[0.9216, -467746e-8, -10457e-8, 481243e-11],
				[0.8962, -536223e-8, -323831e-10, -543432e-11],
				[0.8679, -609363e-8, -113898e-9, 332484e-11],
				[0.835, -698325e-8, -640253e-10, 934959e-12],
				[0.7986, -755338e-8, -500009e-10, 935324e-12],
				[0.7597, -798324e-8, -35971e-9, -227626e-11],
				[0.7186, -851367e-8, -701149e-10, -86303e-10],
				[0.6732, -986209e-8, -199569e-9, 191974e-10],
				[0.6213, -0.010418, 883923e-10, 624051e-11],
				[0.5722, -906601e-8, 182e-6, 624051e-11],
				[0.5322, -677797e-8, 275608e-9, 624051e-11],
			];
			var COEFS_Y = [
				[-520417e-23, 0.0124, 121431e-23, -845284e-16],
				[0.062, 0.0124, -126793e-14, 422642e-15],
				[0.124, 0.0124, 507171e-14, -160604e-14],
				[0.186, 0.0123999, -190189e-13, 600152e-14],
				[0.248, 0.0124002, 710039e-13, -224e-10],
				[0.31, 0.0123992, -264997e-12, 835986e-13],
				[0.372, 0.0124029, 988983e-12, -311994e-12],
				[0.434, 0.0123893, -369093e-11, -435621e-12],
				[0.4958, 0.0123198, -102252e-10, -345523e-12],
				[0.5571, 0.0121916, -154081e-10, -582288e-12],
				[0.6176, 0.0119938, -241424e-10, -525327e-12],
				[0.6769, 0.011713, -320223e-10, -516405e-12],
				[0.7346, 0.0113541, -397684e-10, -609052e-12],
				[0.7903, 0.0109107, -489042e-10, -104739e-11],
				[0.8435, 0.0103431, -64615e-9, -140374e-14],
				[0.8936, 969686e-8, -64636e-9, -8547e-9],
				[0.9394, 840947e-8, -192841e-9, -42106e-10],
				[0.9761, 616527e-8, -256e-6, -42106e-10],
				[1, 328947e-8, -319159e-9, -42106e-10],
			];
			var FXC = 0.8487;
			var FYC = 1.3523;
			var C1 = R2D / 5;
			var RC1 = 1 / C1;
			var NODES = 18;
			var poly3_val = function (coefs, x) {
				return (
					coefs[0] + x * (coefs[1] + x * (coefs[2] + x * coefs[3]))
				);
			};
			var poly3_der = function (coefs, x) {
				return coefs[1] + x * (2 * coefs[2] + x * 3 * coefs[3]);
			};
			function newton_rapshon(f_df, start2, max_err, iters) {
				var x = start2;
				for (; iters; --iters) {
					var upd = f_df(x);
					x -= upd;
					if (Math.abs(upd) < max_err) {
						break;
					}
				}
				return x;
			}
			function init$6() {
				this.x0 = this.x0 || 0;
				this.y0 = this.y0 || 0;
				this.long0 = this.long0 || 0;
				this.es = 0;
				this.title = this.title || "Robinson";
			}
			function forward$5(ll) {
				var lon = adjust_lon(ll.x - this.long0, this.over);
				var dphi = Math.abs(ll.y);
				var i = Math.floor(dphi * C1);
				if (i < 0) {
					i = 0;
				} else if (i >= NODES) {
					i = NODES - 1;
				}
				dphi = R2D * (dphi - RC1 * i);
				var xy = {
					x: poly3_val(COEFS_X[i], dphi) * lon,
					y: poly3_val(COEFS_Y[i], dphi),
				};
				if (ll.y < 0) {
					xy.y = -xy.y;
				}
				xy.x = xy.x * this.a * FXC + this.x0;
				xy.y = xy.y * this.a * FYC + this.y0;
				if (ll.z !== void 0) {
					xy.z = ll.z;
				}
				if (ll.m !== void 0) {
					xy.m = ll.m;
				}
				return xy;
			}
			function inverse$5(xy) {
				var ll = {
					x: (xy.x - this.x0) / (this.a * FXC),
					y: Math.abs(xy.y - this.y0) / (this.a * FYC),
				};
				if (ll.y >= 1) {
					ll.x /= COEFS_X[NODES][0];
					ll.y = xy.y < 0 ? -HALF_PI : HALF_PI;
				} else {
					var i = Math.floor(ll.y * NODES);
					if (i < 0) {
						i = 0;
					} else if (i >= NODES) {
						i = NODES - 1;
					}
					for (;;) {
						if (COEFS_Y[i][0] > ll.y) {
							--i;
						} else if (COEFS_Y[i + 1][0] <= ll.y) {
							++i;
						} else {
							break;
						}
					}
					var coefs = COEFS_Y[i];
					var t =
						(5 * (ll.y - coefs[0])) /
						(COEFS_Y[i + 1][0] - coefs[0]);
					t = newton_rapshon(
						function (x) {
							return (
								(poly3_val(coefs, x) - ll.y) /
								poly3_der(coefs, x)
							);
						},
						t,
						EPSLN,
						100,
					);
					ll.x /= poly3_val(COEFS_X[i], t);
					ll.y = (5 * i + t) * D2R$1;
					if (xy.y < 0) {
						ll.y = -ll.y;
					}
				}
				ll.x = adjust_lon(ll.x + this.long0, this.over);
				if (xy.z !== void 0) {
					ll.z = xy.z;
				}
				if (xy.m !== void 0) {
					ll.m = xy.m;
				}
				return ll;
			}
			var names$6 = ["Robinson", "robin"];
			var robin = {
				init: init$6,
				forward: forward$5,
				inverse: inverse$5,
				names: names$6,
			};
			function init$5() {
				this.name = "geocent";
			}
			function forward$4(p) {
				var point = geodeticToGeocentric(p, this.es, this.a);
				return point;
			}
			function inverse$4(p) {
				var point = geocentricToGeodetic(p, this.es, this.a, this.b);
				return point;
			}
			var names$5 = ["Geocentric", "geocentric", "geocent", "Geocent"];
			var geocent = {
				init: init$5,
				forward: forward$4,
				inverse: inverse$4,
				names: names$5,
			};
			var mode = {
				N_POLE: 0,
				S_POLE: 1,
				EQUIT: 2,
				OBLIQ: 3,
			};
			var params = {
				h: { def: 1e5, num: true },
				// default is Karman line, no default in PROJ.7
				azi: { def: 0, num: true, degrees: true },
				// default is North
				tilt: { def: 0, num: true, degrees: true },
				// default is Nadir
				long0: { def: 0, num: true },
				// default is Greenwich, conversion to rad is automatic
				lat0: { def: 0, num: true },
				// default is Equator, conversion to rad is automatic
			};
			function init$4() {
				Object.keys(params).forEach(
					function (p) {
						if (typeof this[p] === "undefined") {
							this[p] = params[p].def;
						} else if (params[p].num && isNaN(this[p])) {
							throw new Error(
								"Invalid parameter value, must be numeric " +
									p +
									" = " +
									this[p],
							);
						} else if (params[p].num) {
							this[p] = parseFloat(this[p]);
						}
						if (params[p].degrees) {
							this[p] = this[p] * D2R$1;
						}
					}.bind(this),
				);
				if (Math.abs(Math.abs(this.lat0) - HALF_PI) < EPSLN) {
					this.mode = this.lat0 < 0 ? mode.S_POLE : mode.N_POLE;
				} else if (Math.abs(this.lat0) < EPSLN) {
					this.mode = mode.EQUIT;
				} else {
					this.mode = mode.OBLIQ;
					this.sinph0 = Math.sin(this.lat0);
					this.cosph0 = Math.cos(this.lat0);
				}
				this.pn1 = this.h / this.a;
				if (this.pn1 <= 0 || this.pn1 > 1e10) {
					throw new Error("Invalid height");
				}
				this.p = 1 + this.pn1;
				this.rp = 1 / this.p;
				this.h1 = 1 / this.pn1;
				this.pfact = (this.p + 1) * this.h1;
				this.es = 0;
				var omega = this.tilt;
				var gamma = this.azi;
				this.cg = Math.cos(gamma);
				this.sg = Math.sin(gamma);
				this.cw = Math.cos(omega);
				this.sw = Math.sin(omega);
			}
			function forward$3(p) {
				p.x -= this.long0;
				var sinphi = Math.sin(p.y);
				var cosphi = Math.cos(p.y);
				var coslam = Math.cos(p.x);
				var x, y;
				switch (this.mode) {
					case mode.OBLIQ:
						y =
							this.sinph0 * sinphi +
							this.cosph0 * cosphi * coslam;
						break;
					case mode.EQUIT:
						y = cosphi * coslam;
						break;
					case mode.S_POLE:
						y = -sinphi;
						break;
					case mode.N_POLE:
						y = sinphi;
						break;
				}
				y = this.pn1 / (this.p - y);
				x = y * cosphi * Math.sin(p.x);
				switch (this.mode) {
					case mode.OBLIQ:
						y *=
							this.cosph0 * sinphi -
							this.sinph0 * cosphi * coslam;
						break;
					case mode.EQUIT:
						y *= sinphi;
						break;
					case mode.N_POLE:
						y *= -(cosphi * coslam);
						break;
					case mode.S_POLE:
						y *= cosphi * coslam;
						break;
				}
				var yt, ba;
				yt = y * this.cg + x * this.sg;
				ba = 1 / (yt * this.sw * this.h1 + this.cw);
				x = (x * this.cg - y * this.sg) * this.cw * ba;
				y = yt * ba;
				p.x = x * this.a;
				p.y = y * this.a;
				return p;
			}
			function inverse$3(p) {
				p.x /= this.a;
				p.y /= this.a;
				var r = { x: p.x, y: p.y };
				var bm, bq, yt;
				yt = 1 / (this.pn1 - p.y * this.sw);
				bm = this.pn1 * p.x * yt;
				bq = this.pn1 * p.y * this.cw * yt;
				p.x = bm * this.cg + bq * this.sg;
				p.y = bq * this.cg - bm * this.sg;
				var rh = hypot(p.x, p.y);
				if (Math.abs(rh) < EPSLN) {
					r.x = 0;
					r.y = p.y;
				} else {
					var cosz, sinz;
					sinz = 1 - rh * rh * this.pfact;
					sinz =
						(this.p - Math.sqrt(sinz)) /
						(this.pn1 / rh + rh / this.pn1);
					cosz = Math.sqrt(1 - sinz * sinz);
					switch (this.mode) {
						case mode.OBLIQ:
							r.y = Math.asin(
								cosz * this.sinph0 +
									(p.y * sinz * this.cosph0) / rh,
							);
							p.y = (cosz - this.sinph0 * Math.sin(r.y)) * rh;
							p.x *= sinz * this.cosph0;
							break;
						case mode.EQUIT:
							r.y = Math.asin((p.y * sinz) / rh);
							p.y = cosz * rh;
							p.x *= sinz;
							break;
						case mode.N_POLE:
							r.y = Math.asin(cosz);
							p.y = -p.y;
							break;
						case mode.S_POLE:
							r.y = -Math.asin(cosz);
							break;
					}
					r.x = Math.atan2(p.x, p.y);
				}
				p.x = r.x + this.long0;
				p.y = r.y;
				return p;
			}
			var names$4 = ["Tilted_Perspective", "tpers"];
			var tpers = {
				init: init$4,
				forward: forward$3,
				inverse: inverse$3,
				names: names$4,
			};
			function init$3() {
				this.flip_axis = this.sweep === "x" ? 1 : 0;
				this.h = Number(this.h);
				this.radius_g_1 = this.h / this.a;
				if (this.radius_g_1 <= 0 || this.radius_g_1 > 1e10) {
					throw new Error();
				}
				this.radius_g = 1 + this.radius_g_1;
				this.C = this.radius_g * this.radius_g - 1;
				if (this.es !== 0) {
					var one_es = 1 - this.es;
					var rone_es = 1 / one_es;
					this.radius_p = Math.sqrt(one_es);
					this.radius_p2 = one_es;
					this.radius_p_inv2 = rone_es;
					this.shape = "ellipse";
				} else {
					this.radius_p = 1;
					this.radius_p2 = 1;
					this.radius_p_inv2 = 1;
					this.shape = "sphere";
				}
				if (!this.title) {
					this.title = "Geostationary Satellite View";
				}
			}
			function forward$2(p) {
				var lon = p.x;
				var lat = p.y;
				var tmp, v_x, v_y, v_z;
				lon = lon - this.long0;
				if (this.shape === "ellipse") {
					lat = Math.atan(this.radius_p2 * Math.tan(lat));
					var r =
						this.radius_p /
						hypot(this.radius_p * Math.cos(lat), Math.sin(lat));
					v_x = r * Math.cos(lon) * Math.cos(lat);
					v_y = r * Math.sin(lon) * Math.cos(lat);
					v_z = r * Math.sin(lat);
					if (
						(this.radius_g - v_x) * v_x -
							v_y * v_y -
							v_z * v_z * this.radius_p_inv2 <
						0
					) {
						p.x = Number.NaN;
						p.y = Number.NaN;
						return p;
					}
					tmp = this.radius_g - v_x;
					if (this.flip_axis) {
						p.x =
							this.radius_g_1 * Math.atan(v_y / hypot(v_z, tmp));
						p.y = this.radius_g_1 * Math.atan(v_z / tmp);
					} else {
						p.x = this.radius_g_1 * Math.atan(v_y / tmp);
						p.y =
							this.radius_g_1 * Math.atan(v_z / hypot(v_y, tmp));
					}
				} else if (this.shape === "sphere") {
					tmp = Math.cos(lat);
					v_x = Math.cos(lon) * tmp;
					v_y = Math.sin(lon) * tmp;
					v_z = Math.sin(lat);
					tmp = this.radius_g - v_x;
					if (this.flip_axis) {
						p.x =
							this.radius_g_1 * Math.atan(v_y / hypot(v_z, tmp));
						p.y = this.radius_g_1 * Math.atan(v_z / tmp);
					} else {
						p.x = this.radius_g_1 * Math.atan(v_y / tmp);
						p.y =
							this.radius_g_1 * Math.atan(v_z / hypot(v_y, tmp));
					}
				}
				p.x = p.x * this.a;
				p.y = p.y * this.a;
				return p;
			}
			function inverse$2(p) {
				var v_x = -1;
				var v_y = 0;
				var v_z = 0;
				var a, b, det, k;
				p.x = p.x / this.a;
				p.y = p.y / this.a;
				if (this.shape === "ellipse") {
					if (this.flip_axis) {
						v_z = Math.tan(p.y / this.radius_g_1);
						v_y = Math.tan(p.x / this.radius_g_1) * hypot(1, v_z);
					} else {
						v_y = Math.tan(p.x / this.radius_g_1);
						v_z = Math.tan(p.y / this.radius_g_1) * hypot(1, v_y);
					}
					var v_zp = v_z / this.radius_p;
					a = v_y * v_y + v_zp * v_zp + v_x * v_x;
					b = 2 * this.radius_g * v_x;
					det = b * b - 4 * a * this.C;
					if (det < 0) {
						p.x = Number.NaN;
						p.y = Number.NaN;
						return p;
					}
					k = (-b - Math.sqrt(det)) / (2 * a);
					v_x = this.radius_g + k * v_x;
					v_y *= k;
					v_z *= k;
					p.x = Math.atan2(v_y, v_x);
					p.y = Math.atan((v_z * Math.cos(p.x)) / v_x);
					p.y = Math.atan(this.radius_p_inv2 * Math.tan(p.y));
				} else if (this.shape === "sphere") {
					if (this.flip_axis) {
						v_z = Math.tan(p.y / this.radius_g_1);
						v_y =
							Math.tan(p.x / this.radius_g_1) *
							Math.sqrt(1 + v_z * v_z);
					} else {
						v_y = Math.tan(p.x / this.radius_g_1);
						v_z =
							Math.tan(p.y / this.radius_g_1) *
							Math.sqrt(1 + v_y * v_y);
					}
					a = v_y * v_y + v_z * v_z + v_x * v_x;
					b = 2 * this.radius_g * v_x;
					det = b * b - 4 * a * this.C;
					if (det < 0) {
						p.x = Number.NaN;
						p.y = Number.NaN;
						return p;
					}
					k = (-b - Math.sqrt(det)) / (2 * a);
					v_x = this.radius_g + k * v_x;
					v_y *= k;
					v_z *= k;
					p.x = Math.atan2(v_y, v_x);
					p.y = Math.atan((v_z * Math.cos(p.x)) / v_x);
				}
				p.x = p.x + this.long0;
				return p;
			}
			var names$3 = [
				"Geostationary Satellite View",
				"Geostationary_Satellite",
				"geos",
			];
			var geos = {
				init: init$3,
				forward: forward$2,
				inverse: inverse$2,
				names: names$3,
			};
			var A1 = 1.340264,
				A22 = -0.081106,
				A32 = 893e-6,
				A4 = 3796e-6,
				M = Math.sqrt(3) / 2;
			function init$2() {
				this.long0 = this.long0 !== void 0 ? this.long0 : 0;
				this.x0 = this.x0 !== void 0 ? this.x0 : 0;
				this.y0 = this.y0 !== void 0 ? this.y0 : 0;
				if (this.es !== 0) {
					this.apa = authset(this.es);
					this.qp = qsfnz(this.e, 1);
					this.rqda = Math.sqrt(0.5 * this.qp);
				}
			}
			function forward$1(p) {
				var lam = adjust_lon(p.x - this.long0, this.over);
				var phi = p.y;
				var sinphi = Math.sin(phi);
				if (this.es !== 0) {
					sinphi = qsfnz(this.e, sinphi) / this.qp;
				}
				var paramLat = Math.asin(M * sinphi),
					paramLatSq = paramLat * paramLat,
					paramLatPow6 = paramLatSq * paramLatSq * paramLatSq;
				p.x =
					(lam * Math.cos(paramLat)) /
					(M *
						(A1 +
							3 * A22 * paramLatSq +
							paramLatPow6 * (7 * A32 + 9 * A4 * paramLatSq)));
				p.y =
					paramLat *
					(A1 +
						A22 * paramLatSq +
						paramLatPow6 * (A32 + A4 * paramLatSq));
				if (this.es !== 0) {
					p.x *= this.rqda;
					p.y *= this.rqda;
				}
				p.x = this.a * p.x + this.x0;
				p.y = this.a * p.y + this.y0;
				return p;
			}
			function inverse$1(p) {
				p.x = (p.x - this.x0) / this.a;
				p.y = (p.y - this.y0) / this.a;
				if (this.es !== 0) {
					p.x /= this.rqda;
					p.y /= this.rqda;
				}
				var EPS = 1e-9,
					NITER = 12,
					paramLat = p.y,
					paramLatSq,
					paramLatPow6,
					fy,
					fpy,
					dlat,
					i;
				for (i = 0; i < NITER; ++i) {
					paramLatSq = paramLat * paramLat;
					paramLatPow6 = paramLatSq * paramLatSq * paramLatSq;
					fy =
						paramLat *
							(A1 +
								A22 * paramLatSq +
								paramLatPow6 * (A32 + A4 * paramLatSq)) -
						p.y;
					fpy =
						A1 +
						3 * A22 * paramLatSq +
						paramLatPow6 * (7 * A32 + 9 * A4 * paramLatSq);
					paramLat -= dlat = fy / fpy;
					if (Math.abs(dlat) < EPS) {
						break;
					}
				}
				paramLatSq = paramLat * paramLat;
				paramLatPow6 = paramLatSq * paramLatSq * paramLatSq;
				p.x =
					(M *
						p.x *
						(A1 +
							3 * A22 * paramLatSq +
							paramLatPow6 * (7 * A32 + 9 * A4 * paramLatSq))) /
					Math.cos(paramLat);
				p.y = Math.asin(Math.sin(paramLat) / M);
				if (this.es !== 0) {
					p.y = authlat(p.y, this.apa);
				}
				p.x = adjust_lon(p.x + this.long0, this.over);
				return p;
			}
			var names$2 = ["eqearth", "Equal Earth", "Equal_Earth"];
			var eqearth = {
				init: init$2,
				forward: forward$1,
				inverse: inverse$1,
				names: names$2,
			};
			var EPS10 = 1e-10;
			function init$1() {
				var c;
				this.phi1 = this.lat1;
				if (Math.abs(this.phi1) < EPS10) {
					throw new Error();
				}
				if (this.es) {
					this.en = pj_enfn(this.es);
					this.m1 = pj_mlfn(
						this.phi1,
						(this.am1 = Math.sin(this.phi1)),
						(c = Math.cos(this.phi1)),
						this.en,
					);
					this.am1 =
						c /
						(Math.sqrt(1 - this.es * this.am1 * this.am1) *
							this.am1);
					this.inverse = e_inv;
					this.forward = e_fwd;
				} else {
					if (Math.abs(this.phi1) + EPS10 >= HALF_PI) {
						this.cphi1 = 0;
					} else {
						this.cphi1 = 1 / Math.tan(this.phi1);
					}
					this.inverse = s_inv;
					this.forward = s_fwd;
				}
			}
			function e_fwd(p) {
				var lam = adjust_lon(p.x - (this.long0 || 0), this.over);
				var phi = p.y;
				var rh, E3, c;
				rh =
					this.am1 +
					this.m1 -
					pj_mlfn(
						phi,
						(E3 = Math.sin(phi)),
						(c = Math.cos(phi)),
						this.en,
					);
				E3 = (c * lam) / (rh * Math.sqrt(1 - this.es * E3 * E3));
				p.x = rh * Math.sin(E3);
				p.y = this.am1 - rh * Math.cos(E3);
				p.x = this.a * p.x + (this.x0 || 0);
				p.y = this.a * p.y + (this.y0 || 0);
				return p;
			}
			function e_inv(p) {
				p.x = (p.x - (this.x0 || 0)) / this.a;
				p.y = (p.y - (this.y0 || 0)) / this.a;
				var s, rh, lam, phi;
				rh = hypot(p.x, (p.y = this.am1 - p.y));
				phi = pj_inv_mlfn(this.am1 + this.m1 - rh, this.es, this.en);
				if ((s = Math.abs(phi)) < HALF_PI) {
					s = Math.sin(phi);
					lam =
						(rh *
							Math.atan2(p.x, p.y) *
							Math.sqrt(1 - this.es * s * s)) /
						Math.cos(phi);
				} else if (Math.abs(s - HALF_PI) <= EPS10) {
					lam = 0;
				} else {
					throw new Error();
				}
				p.x = adjust_lon(lam + (this.long0 || 0), this.over);
				p.y = adjust_lat(phi);
				return p;
			}
			function s_fwd(p) {
				var lam = adjust_lon(p.x - (this.long0 || 0), this.over);
				var phi = p.y;
				var E3, rh;
				rh = this.cphi1 + this.phi1 - phi;
				if (Math.abs(rh) > EPS10) {
					p.x = rh * Math.sin((E3 = (lam * Math.cos(phi)) / rh));
					p.y = this.cphi1 - rh * Math.cos(E3);
				} else {
					p.x = p.y = 0;
				}
				p.x = this.a * p.x + (this.x0 || 0);
				p.y = this.a * p.y + (this.y0 || 0);
				return p;
			}
			function s_inv(p) {
				p.x = (p.x - (this.x0 || 0)) / this.a;
				p.y = (p.y - (this.y0 || 0)) / this.a;
				var lam, phi;
				var rh = hypot(p.x, (p.y = this.cphi1 - p.y));
				phi = this.cphi1 + this.phi1 - rh;
				if (Math.abs(phi) > HALF_PI) {
					throw new Error();
				}
				if (Math.abs(Math.abs(phi) - HALF_PI) <= EPS10) {
					lam = 0;
				} else {
					lam = (rh * Math.atan2(p.x, p.y)) / Math.cos(phi);
				}
				p.x = adjust_lon(lam + (this.long0 || 0), this.over);
				p.y = adjust_lat(phi);
				return p;
			}
			var names$1 = ["bonne", "Bonne (Werner lat_1=90)"];
			var bonne = {
				init: init$1,
				names: names$1,
			};
			const projectionType = {
				OBLIQUE: {
					forward: forwardOblique,
					inverse: inverseOblique,
				},
				TRANSVERSE: {
					forward: forwardTransverse,
					inverse: inverseTransverse,
				},
			};
			const paramSets = {
				ROTATE: {
					o_alpha: "oAlpha",
					o_lon_c: "oLongC",
					o_lat_c: "oLatC",
				},
				NEW_POLE: {
					o_lat_p: "oLatP",
					o_lon_p: "oLongP",
				},
				NEW_EQUATOR: {
					o_lon_1: "oLong1",
					o_lat_1: "oLat1",
					o_lon_2: "oLong2",
					o_lat_2: "oLat2",
				},
			};
			function init() {
				this.x0 = this.x0 || 0;
				this.y0 = this.y0 || 0;
				this.long0 = this.long0 || 0;
				this.title = this.title || "General Oblique Transformation";
				this.isIdentity = names$y.includes(this.o_proj);
				if (!this.o_proj) {
					throw new Error("Missing parameter: o_proj");
				}
				if (this.o_proj === `ob_tran`) {
					throw new Error("Invalid value for o_proj: " + this.o_proj);
				}
				const newProjStr = this.projStr
					.replace("+proj=ob_tran", "")
					.replace("+o_proj=", "+proj=")
					.trim();
				const oProj = Projection(newProjStr);
				if (!oProj) {
					throw new Error(
						"Invalid parameter: o_proj. Unknown projection " +
							this.o_proj,
					);
				}
				oProj.long0 = 0;
				this.obliqueProjection = oProj;
				let matchedSet;
				const paramSetsKeys = Object.keys(paramSets);
				const parseParam = (name) => {
					if (typeof this[name] === `undefined`) {
						return void 0;
					}
					const val = parseFloat(this[name]) * D2R$1;
					if (isNaN(val)) {
						throw new Error(
							"Invalid value for " + name + ": " + this[name],
						);
					}
					return val;
				};
				for (let i = 0; i < paramSetsKeys.length; i++) {
					const setKey = paramSetsKeys[i];
					const set = paramSets[setKey];
					const params2 = Object.entries(set);
					const setHasParams = params2.some(
						([p]) => typeof this[p] !== "undefined",
					);
					if (!setHasParams) {
						continue;
					}
					matchedSet = set;
					for (let ii = 0; ii < params2.length; ii++) {
						const [inputParam, param] = params2[ii];
						const val = parseParam(inputParam);
						if (typeof val === "undefined") {
							throw new Error(
								"Missing parameter: " + inputParam + ".",
							);
						}
						this[param] = val;
					}
					break;
				}
				if (!matchedSet) {
					throw new Error(
						"No valid parameters provided for ob_tran projection.",
					);
				}
				const { lamp, phip } = createRotation(this, matchedSet);
				this.lamp = lamp;
				if (Math.abs(phip) > EPSLN) {
					this.cphip = Math.cos(phip);
					this.sphip = Math.sin(phip);
					this.projectionType = projectionType.OBLIQUE;
				} else {
					this.projectionType = projectionType.TRANSVERSE;
				}
			}
			function forward(p) {
				return this.projectionType.forward(this, p);
			}
			function inverse(p) {
				return this.projectionType.inverse(this, p);
			}
			function createRotation(params2, how) {
				let phip, lamp;
				if (how === paramSets.ROTATE) {
					let lamc = params2.oLongC;
					let phic = params2.oLatC;
					let alpha = params2.oAlpha;
					if (Math.abs(Math.abs(phic) - HALF_PI) <= EPSLN) {
						throw new Error(
							"Invalid value for o_lat_c: " +
								params2.o_lat_c +
								" should be < 90\xB0",
						);
					}
					lamp =
						lamc +
						Math.atan2(
							-1 * Math.cos(alpha),
							-1 * Math.sin(alpha) * Math.sin(phic),
						);
					phip = Math.asin(Math.cos(phic) * Math.sin(alpha));
				} else if (how === paramSets.NEW_POLE) {
					lamp = params2.oLongP;
					phip = params2.oLatP;
				} else {
					let lam1 = params2.oLong1;
					let phi1 = params2.oLat1;
					let lam2 = params2.oLong2;
					let phi2 = params2.oLat2;
					let con = Math.abs(phi1);
					if (Math.abs(phi1) > HALF_PI - EPSLN) {
						throw new Error(
							"Invalid value for o_lat_1: " +
								params2.o_lat_1 +
								" should be < 90\xB0",
						);
					}
					if (Math.abs(phi2) > HALF_PI - EPSLN) {
						throw new Error(
							"Invalid value for o_lat_2: " +
								params2.o_lat_2 +
								" should be < 90\xB0",
						);
					}
					if (Math.abs(phi1 - phi2) < EPSLN) {
						throw new Error(
							"Invalid value for o_lat_1 and o_lat_2: o_lat_1 should be different from o_lat_2",
						);
					}
					if (con < EPSLN) {
						throw new Error(
							"Invalid value for o_lat_1: o_lat_1 should be different from zero",
						);
					}
					lamp = Math.atan2(
						Math.cos(phi1) * Math.sin(phi2) * Math.cos(lam1) -
							Math.sin(phi1) * Math.cos(phi2) * Math.cos(lam2),
						Math.sin(phi1) * Math.cos(phi2) * Math.sin(lam2) -
							Math.cos(phi1) * Math.sin(phi2) * Math.sin(lam1),
					);
					phip = Math.atan(
						(-1 * Math.cos(lamp - lam1)) / Math.tan(phi1),
					);
				}
				return { lamp, phip };
			}
			function forwardOblique(self2, lp) {
				let { x: lam, y: phi } = lp;
				lam = adjust_lon(lam - self2.long0, self2.over);
				const coslam = Math.cos(lam);
				const sinphi = Math.sin(phi);
				const cosphi = Math.cos(phi);
				lp.x = adjust_lon(
					Math.atan2(
						cosphi * Math.sin(lam),
						self2.sphip * cosphi * coslam + self2.cphip * sinphi,
					) + self2.lamp,
				);
				lp.y = Math.asin(
					self2.sphip * sinphi - self2.cphip * cosphi * coslam,
				);
				const result = self2.obliqueProjection.forward(lp);
				if (self2.isIdentity) {
					result.x *= R2D;
					result.y *= R2D;
				}
				return result;
			}
			function forwardTransverse(self2, lp) {
				let { x: lam, y: phi } = lp;
				lam = adjust_lon(lam - self2.long0, self2.over);
				const cosphi = Math.cos(phi);
				const coslam = Math.cos(lam);
				lp.x = adjust_lon(
					Math.atan2(cosphi * Math.sin(lam), Math.sin(phi)) +
						self2.lamp,
				);
				lp.y = Math.asin(-1 * cosphi * coslam);
				const result = self2.obliqueProjection.forward(lp);
				if (self2.isIdentity) {
					result.x *= R2D;
					result.y *= R2D;
				}
				return result;
			}
			function inverseOblique(self2, lp) {
				if (self2.isIdentity) {
					lp.x *= D2R$1;
					lp.y *= D2R$1;
				}
				const innerLp = self2.obliqueProjection.inverse(lp);
				let { x: lam, y: phi } = innerLp;
				if (lam < Number.MAX_VALUE) {
					lam -= self2.lamp;
					const coslam = Math.cos(lam);
					const sinphi = Math.sin(phi);
					const cosphi = Math.cos(phi);
					lp.x = Math.atan2(
						cosphi * Math.sin(lam),
						self2.sphip * cosphi * coslam - self2.cphip * sinphi,
					);
					lp.y = Math.asin(
						self2.sphip * sinphi + self2.cphip * cosphi * coslam,
					);
				}
				lp.x = adjust_lon(lp.x + self2.long0);
				return lp;
			}
			function inverseTransverse(self2, lp) {
				if (self2.isIdentity) {
					lp.x *= D2R$1;
					lp.y *= D2R$1;
				}
				const innerLp = self2.obliqueProjection.inverse(lp);
				let { x: lam, y: phi } = innerLp;
				if (lam < Number.MAX_VALUE) {
					const cosphi = Math.cos(phi);
					lam -= self2.lamp;
					lp.x = Math.atan2(
						cosphi * Math.sin(lam),
						-1 * Math.sin(phi),
					);
					lp.y = Math.asin(cosphi * Math.cos(lam));
				}
				lp.x = adjust_lon(lp.x + self2.long0);
				return lp;
			}
			var names = [
				"General Oblique Transformation",
				"General_Oblique_Transformation",
				"ob_tran",
			];
			var ob_tran = {
				init,
				forward,
				inverse,
				names,
			};
			function includedProjections(proj43) {
				proj43.Proj.projections.add(tmerc);
				proj43.Proj.projections.add(etmerc);
				proj43.Proj.projections.add(utm);
				proj43.Proj.projections.add(sterea);
				proj43.Proj.projections.add(stere);
				proj43.Proj.projections.add(somerc);
				proj43.Proj.projections.add(omerc);
				proj43.Proj.projections.add(lcc);
				proj43.Proj.projections.add(krovak);
				proj43.Proj.projections.add(cass);
				proj43.Proj.projections.add(laea);
				proj43.Proj.projections.add(aea);
				proj43.Proj.projections.add(gnom);
				proj43.Proj.projections.add(cea);
				proj43.Proj.projections.add(eqc);
				proj43.Proj.projections.add(poly);
				proj43.Proj.projections.add(nzmg);
				proj43.Proj.projections.add(mill);
				proj43.Proj.projections.add(sinu);
				proj43.Proj.projections.add(eck6);
				proj43.Proj.projections.add(moll);
				proj43.Proj.projections.add(eqdc);
				proj43.Proj.projections.add(vandg);
				proj43.Proj.projections.add(aeqd);
				proj43.Proj.projections.add(ortho);
				proj43.Proj.projections.add(qsc);
				proj43.Proj.projections.add(robin);
				proj43.Proj.projections.add(geocent);
				proj43.Proj.projections.add(tpers);
				proj43.Proj.projections.add(geos);
				proj43.Proj.projections.add(eqearth);
				proj43.Proj.projections.add(bonne);
				proj43.Proj.projections.add(ob_tran);
			}
			const proj42 = Object.assign(proj4$1, {
				defaultDatum: "WGS84",
				Proj: Projection,
				WGS84: new Projection("WGS84"),
				Point,
				toPoint: common,
				defs,
				nadgrid,
				transform,
				mgrs,
				version: "2.22.0",
			});
			includedProjections(proj42);
			return proj42;
		});
	},
});

// scripts/profile-startup.ts
import { performance as performance2 } from "node:perf_hooks";
import { resolve as resolve3 } from "node:path";
import { tmpdir } from "node:os";
import { join as join10 } from "node:path";
import { writeHeapSnapshot } from "node:v8";

// src/lazyValue.ts
var lazyValue = (read) => {
	let cached;
	return () => (cached ??= { value: read() }).value;
};

// src/catalogueLoader.ts
import {
	existsSync as existsSync7,
	readFileSync as readFileSync15,
	statSync,
} from "node:fs";
import { resolve as resolve2 } from "node:path";

// src/observationLoader.ts
import { join as join2 } from "node:path";

// src/dataCatalog.ts
var observationArtifactName = (measureId, source) =>
	source.observationArtifact ?? `${measureId}-observations`;

// src/observationTables.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
var isMeasureTable = (artifact) =>
	typeof artifact === "object" &&
	artifact !== null &&
	artifact.kind === "measure-table";
var tableOfView = /* @__PURE__ */ new WeakMap();
var loaderOfView = /* @__PURE__ */ new WeakMap();
var lookupOfPeriod = /* @__PURE__ */ new WeakMap();
var rowsByCode = /* @__PURE__ */ new WeakMap();
var rowsOf = (table) => {
	let rows = rowsByCode.get(table);
	if (!rows) {
		rows = /* @__PURE__ */ new Map();
		for (const row of table.records)
			if (!rows.has(row[0])) rows.set(row[0], row);
		rowsByCode.set(table, rows);
	}
	return rows;
};
var tableMeasureObservations = (table, measureId) => {
	const column = table.measures.indexOf(measureId);
	if (column === -1)
		throw new Error(`${table.id} does not serve ${measureId}`);
	let records;
	const period = {
		period: table.period,
		get records() {
			records ??= table.records.flatMap(([areaCode, ...values]) => {
				const value = values[column];
				return typeof value === "number"
					? [{ areaCode, value, status: "observed" }]
					: [];
			});
			return records;
		},
	};
	lookupOfPeriod.set(period, (areaCode) => {
		const value = rowsOf(table).get(areaCode)?.[column + 1];
		return typeof value === "number"
			? { areaCode, value, status: "observed" }
			: void 0;
	});
	const view = {
		schemaVersion: 1,
		contentHash: table.contentHash,
		measureId,
		sourceGeography: table.sourceGeography,
		periods: [period],
	};
	tableOfView.set(view, table);
	return view;
};
var readSourceObservations = (
	publicDirectory,
	artifactName,
	measureId,
	tables = /* @__PURE__ */ new Map(),
) => {
	const cached = tables.get(artifactName);
	if (cached) return tableMeasureObservations(cached, measureId);
	const parsed = JSON.parse(
		readFileSync(join(publicDirectory, `${artifactName}.json`), "utf8"),
	);
	if (isMeasureTable(parsed)) {
		tables.set(artifactName, parsed);
		return tableMeasureObservations(parsed, measureId);
	}
	return parsed;
};
var lazySourceObservations = (
	publicDirectory,
	artifactName,
	measureId,
	sourceGeography,
	tables = /* @__PURE__ */ new Map(),
) => {
	const path = join(publicDirectory, `${artifactName}.json`);
	if (!existsSync(path))
		throw new Error(`Missing measure observations at ${path}`);
	let loaded;
	const load = () => {
		if (loaded) return loaded;
		const observations = readSourceObservations(
			publicDirectory,
			artifactName,
			measureId,
			tables,
		);
		if (
			observations.schemaVersion !== 1 ||
			observations.measureId !== measureId ||
			observations.sourceGeography.type !== sourceGeography.type ||
			observations.sourceGeography.boundaryYear !==
				sourceGeography.boundaryYear ||
			!Array.isArray(observations.periods)
		)
			throw new Error(`Invalid measure observations at ${path}`);
		loaded = observations;
		return loaded;
	};
	const view = {
		schemaVersion: 1,
		get contentHash() {
			return load().contentHash;
		},
		measureId,
		get sourceGeography() {
			return loaded?.sourceGeography ?? sourceGeography;
		},
		get periods() {
			return load().periods;
		},
	};
	loaderOfView.set(view, load);
	return view;
};

// src/observationLoader.ts
var readMeasureObservations = (apiRoot2, dataCatalog) => {
	const tables = /* @__PURE__ */ new Map();
	return dataCatalog.measures.flatMap((measure) =>
		measure.sources.map((source) =>
			lazySourceObservations(
				join2(apiRoot2, "public"),
				observationArtifactName(measure.id, source),
				measure.id,
				source.sourceGeography,
				tables,
			),
		),
	);
};

// src/memberReconciliation.ts
var EXPLAINED = ["superseded", "not-yet-current"];
var LEGACY = "unknown";
var COVERAGE_NOTE =
	"Coverage compares member codes against compiled area releases only. An unresolved code is not a claim that the place is missing, and a resolved one is not a claim of equal geometry. `complete` means every listed code resolved, which a location spanning several vintages never does; `coversLocation` is the one to read, and means every code that did not resolve was either the wrong vintage for this release or a legacy alias naming no compiled area, rather than an unexplained absence. Codes of the second kind are listed separately in `legacy`.";
var releaseOrder = (boundaryRelease) => {
	const match = /^(\d{4})-(\d{2})/.exec(boundaryRelease);
	return match ? Number(match[1]) * 12 + Number(match[2]) : void 0;
};
var appearances = (areaLookup, geography, code) => {
	const prefix = `${geography}/`;
	const found = [];
	for (const [key, areas] of areaLookup) {
		if (!key.startsWith(prefix)) continue;
		const area = areas.get(code);
		if (area) {
			found.push({
				boundaryRelease: key.slice(prefix.length),
				name: area.name,
			});
		}
	}
	return found.sort((left, right) =>
		left.boundaryRelease.localeCompare(right.boundaryRelease),
	);
};
var statusFor = (found, target) => {
	if (found.length === 0) return "unknown";
	if (target === void 0) return "absent-from-release";
	const orders = found.map((appearance) =>
		releaseOrder(appearance.boundaryRelease),
	);
	if (orders.some((order) => order === void 0)) return "absent-from-release";
	const known = orders;
	if (known.every((order) => order < target)) return "superseded";
	if (known.every((order) => order > target)) return "not-yet-current";
	return "absent-from-release";
};
var coverageFor = (
	areaLookup,
	geography,
	target,
	memberCodes,
	resolvedCodes,
) => {
	const unresolved = memberCodes
		.filter((code) => !resolvedCodes.has(code))
		.map((code) => {
			const found = appearances(areaLookup, geography, code);
			return {
				code,
				status: statusFor(found, target),
				...(found[0] ? { name: found[0].name } : {}),
				presentIn: found.map(
					(appearance) => appearance.boundaryRelease,
				),
			};
		});
	const legacy = unresolved.filter((member) => member.status === LEGACY);
	const unexplained = unresolved.filter(
		(member) =>
			!EXPLAINED.includes(member.status) && member.status !== LEGACY,
	);
	return {
		memberCodeCount: memberCodes.length,
		resolvedCount: memberCodes.length - unresolved.length,
		unresolvedCount: unresolved.length,
		complete: unresolved.length === 0,
		// Nothing resolving is not coverage, however well the absences are
		// explained: a district abolished before the release asked for leaves
		// no area behind it, and a location carrying no codes at all names an
		// extent rather than a set of areas.
		coversLocation:
			unexplained.length === 0 &&
			memberCodes.length - unresolved.length > 0,
		legacy,
		unexplained,
		unresolved,
		note: COVERAGE_NOTE,
	};
};
var explainCodeInRelease = (areaLookup, geography, boundaryRelease, code) => {
	const found = appearances(areaLookup, geography, code);
	return {
		status: statusFor(found, releaseOrder(boundaryRelease)),
		presentIn: found,
	};
};
var reconcileMembers = (
	areaLookup,
	geography,
	boundaryRelease,
	memberCodes,
	resolvedCodes,
) =>
	coverageFor(
		areaLookup,
		geography,
		releaseOrder(boundaryRelease),
		memberCodes,
		resolvedCodes,
	);
var reconcileMembersForYear = (
	areaLookup,
	geography,
	boundaryYear,
	memberCodes,
	resolvedCodes,
) =>
	coverageFor(
		areaLookup,
		geography,
		boundaryYear * 12 + 6,
		memberCodes,
		resolvedCodes,
	);

// src/nameNormalisation.ts
import { createHash } from "node:crypto";
var normalisePlaceName = (value) =>
	value
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
var withoutTitle = (normalised) => {
	const stripped = normalised
		.replace(/\b(city|county|borough|royal borough) of\b/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return stripped && stripped !== normalised ? stripped : void 0;
};
var exactNameMatch = (label, query) => {
	const normalised = normalisePlaceName(label);
	const requested = normalisePlaceName(query);
	if (normalised === requested) return "exact";
	return withoutTitle(normalised) === requested
		? "exact-without-title"
		: void 0;
};
var PROBES = [
	"Brighton & Hove",
	"Ynys M\xF4n",
	"King's Lynn",
	"King\u2019s Lynn",
	"  Newcastle-upon-Tyne  ",
	"Bristol, City of",
	"Kingston upon Hull, City of",
	"County of Herefordshire",
	"Royal Borough of Greenwich",
	"Borough of Poole",
	"St. Helens",
	"Na h-Eileanan Siar",
	"Ards and North Down",
	"E08000003",
	"Ceredigion (Sir Ceredigion)",
];
var NAME_NORMALISATION = `sha256:${createHash("sha256")
	.update(
		JSON.stringify(
			PROBES.map((probe) => {
				const normalised = normalisePlaceName(probe);
				return [normalised, withoutTitle(normalised) ?? null];
			}),
		),
	)
	.digest("hex")}`;

// src/geographyKeys.ts
var releaseKey = (geography, boundaryRelease) =>
	`${geography}/${boundaryRelease}`;
var areaKey = (geography, boundaryRelease, code) =>
	`${releaseKey(geography, boundaryRelease)}/${code}`;

// src/batchValidation.ts
var MATCH_RANK = { exact: 0, alias: 1, "exact-without-title": 2 };
var nameIndexes = /* @__PURE__ */ new WeakMap();
var nameIndexFor = (areas) => {
	const cached = nameIndexes.get(areas);
	if (cached) return cached;
	const index = /* @__PURE__ */ new Map();
	const add = (key, entry) => {
		const list = index.get(key) ?? [];
		const existing = list.find(
			(candidate) => candidate.area.code === entry.area.code,
		);
		if (!existing) list.push(entry);
		else if (MATCH_RANK[entry.match] < MATCH_RANK[existing.match])
			existing.match = entry.match;
		index.set(key, list);
	};
	for (const area of areas.values()) {
		for (const [label, match] of [
			[area.name, "exact"],
			...(area.aliases ?? []).map((alias) => [alias, "alias"]),
		]) {
			const normalised = normalisePlaceName(label);
			if (!normalised) continue;
			add(normalised, { area, match });
			const stripped = withoutTitle(normalised);
			if (stripped) add(stripped, { area, match: "exact-without-title" });
		}
	}
	nameIndexes.set(areas, index);
	return index;
};
var codeIndexes = /* @__PURE__ */ new WeakMap();
var codeIndexFor = (areaLookup) => {
	const cached = codeIndexes.get(areaLookup);
	if (cached) return cached;
	const index = /* @__PURE__ */ new Map();
	for (const [key, areas] of areaLookup) {
		const [geography, boundaryRelease] = key.split("/");
		for (const code of areas.keys()) {
			const byGeography = index.get(code) ?? /* @__PURE__ */ new Map();
			byGeography.set(geography, [
				...(byGeography.get(geography) ?? []),
				boundaryRelease,
			]);
			index.set(code, byGeography);
		}
	}
	codeIndexes.set(areaLookup, index);
	return index;
};
var CODE = /^[A-Z]\d{8}$/;
var CODE_LIKE = /^[A-Z]\d+$/;
var validateBatch = (areaLookup, geography, boundaryRelease, values) => {
	const areas = areaLookup.get(releaseKey(geography, boundaryRelease));
	if (!areas)
		throw new Error(`${geography}/${boundaryRelease} is not compiled.`);
	const ref = (area) => ({
		id: areaKey(geography, boundaryRelease, area.code),
		code: area.code,
		name: area.name,
	});
	const firstSeen = /* @__PURE__ */ new Map();
	return values.map((value, index) => {
		const trimmed = value.trim();
		const upper = trimmed.toUpperCase();
		const looksLikeCode = CODE_LIKE.test(upper);
		const normalised = [
			...(trimmed !== value ? ["trimmed"] : []),
			...(looksLikeCode && upper !== trimmed ? ["uppercased"] : []),
		];
		const key = looksLikeCode ? upper : normalisePlaceName(trimmed);
		const duplicateOf = firstSeen.get(key);
		if (duplicateOf === void 0) firstSeen.set(key, index);
		const base = {
			index,
			value,
			...(normalised.length > 0 ? { normalised } : {}),
			...(duplicateOf !== void 0 ? { duplicateOf } : {}),
		};
		if (!trimmed) return { ...base, kind: "empty", status: "empty" };
		if (looksLikeCode) {
			if (!CODE.test(upper))
				return {
					...base,
					kind: "code",
					status: "malformed-code",
					detail: `An area code is a letter and eight digits; ${trimmed} has ${upper.length - 1}.`,
				};
			const area = areas.get(upper);
			if (area)
				return {
					...base,
					kind: "code",
					status: "valid",
					area: ref(area),
				};
			const heldBy = codeIndexFor(areaLookup).get(upper);
			if (heldBy?.has(geography)) {
				const { status, presentIn } = explainCodeInRelease(
					areaLookup,
					geography,
					boundaryRelease,
					upper,
				);
				return {
					...base,
					kind: "code",
					status,
					presentIn,
				};
			}
			if (heldBy)
				return {
					...base,
					kind: "code",
					status: "other-geography",
					heldBy: [...heldBy]
						.map(([other, releases]) => ({
							geography: other,
							boundaryReleases: [...releases].sort(),
						}))
						.sort((left, right) =>
							left.geography.localeCompare(right.geography),
						),
				};
			return { ...base, kind: "code", status: "unknown" };
		}
		const name = normalisePlaceName(trimmed);
		const entries = nameIndexFor(areas).get(name) ?? [];
		if (entries.length === 1)
			return {
				...base,
				kind: "name",
				status: "matched",
				match: entries[0].match,
				area: ref(entries[0].area),
			};
		if (entries.length > 1)
			return {
				...base,
				kind: "name",
				status: "ambiguous",
				candidates: entries
					.map((entry) => ({
						...ref(entry.area),
						match: entry.match,
					}))
					.sort(
						(left, right) =>
							MATCH_RANK[left.match] - MATCH_RANK[right.match] ||
							left.code.localeCompare(right.code),
					),
			};
		const prefix = `${geography}/`;
		return {
			...base,
			kind: "name",
			status: "unmatched",
			matchesIn: [...areaLookup]
				.filter(
					([key2, other]) =>
						key2.startsWith(prefix) &&
						other !== areas &&
						nameIndexFor(other).has(name),
				)
				.map(([key2]) => key2.slice(prefix.length))
				.sort(),
		};
	});
};
var summariseBatch = (results) => {
	const byStatus = {};
	for (const result of results)
		byStatus[result.status] = (byStatus[result.status] ?? 0) + 1;
	return {
		valueCount: results.length,
		byStatus,
		duplicateCount: results.filter(
			(result) => result.duplicateOf !== void 0,
		).length,
		normalisedCount: results.filter((result) => result.normalised).length,
		joinable: results.every(
			(result) =>
				result.status === "valid" || result.status === "matched",
		),
	};
};

// src/areaAbsence.ts
var CODE_DETAIL = {
	superseded:
		"is held only by older releases of this geography, so it was no longer in use by this release. Whether the area was abolished, merged or recoded is not recorded here.",
	"not-yet-current":
		"is held only by newer releases of this geography, so it had not come into use by this release.",
	"absent-from-release":
		"is held by other releases of this geography but not this one, and those releases do not place its absence before or after this one.",
	unknown: "is held by no compiled release of this geography.",
};
var explainAreaAbsence = (
	registry,
	areaInventory,
	areaLookup,
	geography,
	boundaryRelease,
	code,
) => {
	const releases = registry.releases.filter(
		(release) => release.geography === geography,
	);
	if (releases.length === 0) {
		return {
			code: "unsupported_geography",
			absence: "unknown-geography",
			detail: `No boundary release is published for the geography ${geography}.`,
			links: { geographies: "/v1/geographies" },
		};
	}
	if (!releases.some((release) => release.id === boundaryRelease)) {
		return {
			code: "unknown_release",
			absence: "unknown-release",
			detail: `No ${geography} boundary release is published as ${boundaryRelease}.`,
			availableReleases: releases.map((release) => ({
				id: release.id,
				href: `/v1/boundary-releases/${geography}/${release.id}`,
			})),
		};
	}
	const releaseAreas = areaLookup?.get(
		releaseKey(geography, boundaryRelease),
	);
	if (!releaseAreas) {
		const inventoried = areaInventory?.releases.find(
			(release) =>
				release.geography === geography &&
				release.id === boundaryRelease,
		);
		return {
			code: "unsupported_geography",
			absence: "release-not-compiled",
			detail:
				inventoried?.status === "not-compiled"
					? `Area identities are not compiled for ${geography}/${boundaryRelease}: ${inventoried.reason}`
					: `Area identities are not compiled for ${geography}/${boundaryRelease}.`,
			links: {
				boundaryRelease: `/v1/boundary-releases/${geography}/${boundaryRelease}`,
			},
		};
	}
	const { status, presentIn } = explainCodeInRelease(
		areaLookup,
		geography,
		boundaryRelease,
		code,
	);
	return {
		code: "area_not_in_release",
		absence: status,
		detail: `${code} ${CODE_DETAIL[status]}`,
		presentIn: presentIn.map((appearance) => ({
			boundaryRelease: appearance.boundaryRelease,
			name: appearance.name,
			href: `/v1/areas/${geography}/${appearance.boundaryRelease}/${code}`,
		})),
	};
};

// src/contentHash.ts
import { createHash as createHash2 } from "node:crypto";
var sha256 = (content) =>
	`sha256:${createHash2("sha256").update(content).digest("hex")}`;

// src/namedLocations.ts
var createNamedLocationLookup = (inventory) =>
	new Map(inventory.locations.map((location) => [location.id, location]));
var memberCodesAt = (memberCodes, memberAssertions, validity, asOf) =>
	(
		memberAssertions ??
		memberCodes.map((code) => ({
			code,
			validity,
		}))
	)
		.filter(
			({ validity: validity2 }) =>
				asOf === void 0 ||
				((validity2.from === null || validity2.from <= asOf) &&
					(validity2.to === null || asOf < validity2.to)),
		)
		.map(({ code }) => code);
var membersAt = (location, asOf) =>
	memberCodesAt(
		location.memberCodes,
		location.memberAssertions,
		location.validity,
		asOf,
	);
var selectNamedLocationAt = (location, asOf) =>
	asOf === void 0
		? location
		: { ...location, memberCodes: membersAt(location, asOf) };

// src/sortedIndex.ts
var lowerBound = (sorted, value, key = (item) => item) => {
	let low = 0;
	let high = sorted.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (key(sorted[middle]) < value) low = middle + 1;
		else high = middle;
	}
	return low;
};
var findSorted = (sorted, value, key = (item) => item) => {
	const position = lowerBound(sorted, value, key);
	return position < sorted.length && key(sorted[position]) === value
		? position
		: -1;
};
var findNumber = (sorted, value) => {
	let low = 0;
	let high = sorted.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (sorted[middle] < value) low = middle + 1;
		else high = middle;
	}
	return sorted[low] === value ? low : -1;
};

// src/releaseForDate.ts
var releaseMonth = (id) => /^(\d{4}-(0[1-9]|1[0-2]))(?:-|$)/.exec(id)?.[1];
var boundaryReleaseMonth = (release) => {
	const coverage = /^(\d{4})(?:-(0[1-9]|1[0-2]))?(?:-|$)/.exec(
		release.temporalCoverage ?? "",
	);
	return (
		releaseMonth(release.id) ??
		(coverage ? `${coverage[1]}-${coverage[2] ?? "01"}` : void 0)
	);
};
var compareBoundaryReleases = (left, right) => {
	const leftMonth = boundaryReleaseMonth(left);
	const rightMonth = boundaryReleaseMonth(right);
	return (
		(leftMonth && rightMonth
			? leftMonth.localeCompare(rightMonth)
			: leftMonth
				? -1
				: rightMonth
					? 1
					: 0) || left.id.localeCompare(right.id)
	);
};
var derivedReleaseSources = (areaInventory) =>
	new Map(
		(areaInventory?.releases ?? []).flatMap((release) =>
			release.status === "available" && release.derivedFrom
				? [
						[
							releaseKey(release.geography, release.id),
							releaseKey(
								release.derivedFrom.source.geography,
								release.derivedFrom.source.boundaryRelease,
							),
						],
					]
				: [],
		),
	);
var reference = (release) => ({
	id: release.id,
	month: releaseMonth(release.id),
	title: release.title,
	countries: release.coverage.countries,
	href: `/v1/boundary-releases/${release.geography}/${release.id}`,
});
var byMonth = (left, right) =>
	left.month.localeCompare(right.month) || left.id.localeCompare(right.id);
var selectReleaseForDate = (
	registry,
	geography,
	month2,
	country,
	derivedFrom,
) => {
	const releases = registry.releases.filter(
		(release) => release.geography === geography,
	);
	const undated = releases
		.filter((release) => releaseMonth(release.id) === void 0)
		.map((release) => release.id)
		.sort();
	if (releases.length === 0) {
		return {
			status: "none",
			absence: "unknown-geography",
			detail: `No boundary release is published for the geography ${geography}.`,
			undated,
		};
	}
	const dated = releases
		.filter((release) => releaseMonth(release.id) !== void 0)
		.map(reference)
		.sort(byMonth);
	if (dated.length === 0) {
		return {
			status: "none",
			absence: "no-dated-release",
			detail: `No ${geography} boundary release is dated to a month, so none can be chosen by date.`,
			undated,
		};
	}
	const covering2 = dated.filter(
		(release) => !country || release.countries.includes(country),
	);
	if (covering2.length === 0) {
		return {
			status: "none",
			absence: "country-not-covered",
			detail: `No ${geography} boundary release covers ${country}.`,
			undated,
		};
	}
	const onOrBefore = covering2.filter((release) => release.month <= month2);
	if (onOrBefore.length === 0) {
		return {
			status: "none",
			absence: "before-first-release",
			detail: `The earliest ${geography} boundary release${country ? ` covering ${country}` : ""} is dated ${covering2[0].month}, after ${month2}.`,
			earliest: covering2[0],
			undated,
		};
	}
	const chosenMonth = onOrBefore.at(-1).month;
	let candidates = onOrBefore.filter(
		(release) => release.month === chosenMonth,
	);
	const setAside = [];
	const setAsideWhere = (test, reason) => {
		const kept = candidates.filter((release) => !test(release));
		if (kept.length === 0) return;
		for (const release of candidates)
			if (test(release))
				setAside.push({ ...release, reason: reason(release) });
		candidates = kept;
	};
	setAsideWhere(
		(release) =>
			candidates.some(
				(source) =>
					derivedFrom.get(releaseKey(geography, release.id)) ===
					releaseKey(geography, source.id),
			),
		(release) =>
			`Derived from ${derivedFrom.get(releaseKey(geography, release.id))}, which is also dated ${chosenMonth}.`,
	);
	const reach = (release) => (country ? 0 : release.countries.length);
	const widest = Math.max(...candidates.map(reach));
	setAsideWhere(
		(release) => reach(release) < widest,
		(release) =>
			`Covers ${release.countries.join(", ")}, fewer countries than another release dated ${chosenMonth}.`,
	);
	if (candidates.length > 1) {
		return { status: "ambiguous", month: chosenMonth, choices: candidates };
	}
	const selected = candidates[0];
	return {
		status: "selected",
		selected,
		sameMonth: chosenMonth === month2,
		previous:
			covering2.filter((release) => release.month < chosenMonth).at(-1) ??
			null,
		next: covering2.find((release) => release.month > chosenMonth) ?? null,
		setAside,
		notCovering: dated.filter(
			(release) =>
				release.month > chosenMonth &&
				release.month <= month2 &&
				!covering2.includes(release),
		),
		undated,
	};
};

// src/placeIndex.ts
var AREA_CODE = /^[A-Z]\d{8}$/;
var placeReference = (kind, geography, code) =>
	kind === "named-location" ? `location/${code}` : `${geography}/${code}`;
var placeIndexMismatch = (artifact, areaInventoryHash, namedLocations) => {
	if (
		artifact.schemaVersion !== 1 ||
		!Array.isArray(artifact.releases) ||
		!Array.isArray(artifact.places) ||
		!Array.isArray(artifact.names) ||
		!Array.isArray(artifact.labels) ||
		!Array.isArray(artifact.codes) ||
		!Array.isArray(artifact.codePlaces) ||
		artifact.names.length !== artifact.labels.length ||
		artifact.codes.length !== artifact.codePlaces.length
	)
		return "is malformed";
	if (artifact.nameNormalisation !== NAME_NORMALISATION)
		return "was normalised under different name rules than this API applies";
	if (artifact.areaInventoryHash !== areaInventoryHash)
		return "was not built from the current area inventory";
	if (
		artifact.namedLocationInventoryHash !==
		(namedLocations?.contentHash ?? null)
	)
		return "was not built from the current named locations";
	return void 0;
};

// src/placeResolver.ts
var GEOGRAPHY_ORDER = [
	"country",
	"region",
	"named-location",
	"combinedAuthority",
	"countyAndUnitaryAuthority",
	"localAuthority",
	"majorTownAndCity",
	"constituency",
	"seneddConstituency",
	"scottishParliamentaryConstituency",
	"seneddElectoralRegion",
	"scottishParliamentaryRegion",
	"policeForceArea",
	"fireAndRescueAuthority",
	"integratedCareBoard",
	"subIntegratedCareBoardLocation",
	"nhsEnglandRegion",
	"localHealthBoard",
	"nationalPark",
	"localPlanningAuthority",
	"communitySafetyPartnership",
	"travelToWorkArea",
	"itl1",
	"itl2",
	"itl3",
	"ward",
	"countyElectoralDivision",
	"parish",
	"msoa",
	"lsoa",
	"outputArea",
	"intermediateZone",
	"dataZone",
	"superOutputArea",
];
var geographyRank = (geography) => {
	const index = GEOGRAPHY_ORDER.indexOf(geography);
	return index === -1 ? GEOGRAPHY_ORDER.length : index;
};
var MATCH_RANK2 = {
	exact: 0,
	"exact-without-title": 0,
	prefix: 1,
};
var comparePlaceCandidates = (left, right) =>
	MATCH_RANK2[left.match] - MATCH_RANK2[right.match] ||
	geographyRank(left.geography) - geographyRank(right.geography) ||
	left.name.localeCompare(right.name) ||
	left.code.localeCompare(right.code);
var parsePlaceReference = (reference2) => {
	const match = /^([A-Za-z0-9]+)\/([A-Za-z0-9-]+)$/.exec(reference2);
	if (!match) return void 0;
	const [, head, code] = match;
	return head === "location"
		? { kind: "named-location", geography: "named-location", code }
		: { kind: "area", geography: head, code };
};
var toCandidate = (index, position, match, matchedLabel, asOf) => {
	const place = index.places[position];
	const memberCodes = place.memberCodes
		? memberCodesAt(
				place.memberCodes,
				place.memberAssertions,
				place.validity ?? { from: null, to: null },
				asOf,
			)
		: void 0;
	return {
		place: place.place,
		kind: place.kind,
		name: place.name,
		geography: place.geography,
		code: place.code,
		match,
		matchedLabel: matchedLabel ?? place.name,
		boundaryReleases: place.boundaryReleases.map(
			(release) => index.releases[release],
		),
		...(memberCodes ? { memberCodes } : {}),
		...(place.memberAssertions
			? { memberAssertions: place.memberAssertions }
			: {}),
		...(place.memberGeography
			? { memberGeography: place.memberGeography }
			: {}),
		...(place.definitionRevision
			? { definitionRevision: place.definitionRevision }
			: {}),
		...(place.validity ? { validity: place.validity } : {}),
	};
};
var resolvePlaces = (index, query, limit = 10, asOf) => {
	const trimmed = query.trim();
	if (!trimmed) return [];
	const reference2 = parsePlaceReference(trimmed);
	if (reference2) {
		const position = findSorted(
			index.places,
			placeReference(
				reference2.kind,
				reference2.geography,
				reference2.code,
			),
			(place) => place.place,
		);
		if (position !== -1)
			return [toCandidate(index, position, "exact", trimmed, asOf)];
	}
	const found = /* @__PURE__ */ new Map();
	const consider = (position, match, matchedLabel) => {
		const existing = found.get(position);
		if (existing && MATCH_RANK2[existing.match] <= MATCH_RANK2[match])
			return;
		found.set(
			position,
			toCandidate(index, position, match, matchedLabel, asOf),
		);
	};
	const considerLabels = (labels, match) => {
		for (const [position, viaTitle, label] of labels) {
			consider(position, match(viaTitle), label);
		}
	};
	const code = trimmed.toUpperCase();
	if (AREA_CODE.test(code)) {
		const at = findSorted(index.codes, code);
		for (const position of at === -1 ? [] : index.codePlaces[at]) {
			consider(position, "exact", code);
		}
	}
	const normalised = normalisePlaceName(trimmed);
	const exact = findSorted(index.names, normalised);
	if (exact !== -1) {
		considerLabels(index.labels[exact], (viaTitle) =>
			viaTitle ? "exact-without-title" : "exact",
		);
	}
	if (found.size < limit && normalised.length >= 3) {
		for (
			let position = lowerBound(index.names, normalised);
			position < index.names.length &&
			index.names[position].startsWith(normalised);
			position += 1
		) {
			if (position === exact) continue;
			considerLabels(index.labels[position], () => "prefix");
		}
	}
	return [...found.values()].sort(comparePlaceCandidates).slice(0, limit);
};

// src/areaSearch.ts
var releasePrefix = (geography, boundaryRelease) =>
	`${geography}/${boundaryRelease}/`;
var areaSearchIndexMismatch = (artifact, areaInventoryHash) => {
	if (
		artifact.schemaVersion !== 1 ||
		!Array.isArray(artifact.releases) ||
		!Array.isArray(artifact.terms) ||
		!Array.isArray(artifact.termAreas) ||
		!Array.isArray(artifact.titleTerms) ||
		!Array.isArray(artifact.titleTermAreas) ||
		artifact.terms.length !== artifact.termAreas.length ||
		artifact.titleTerms.length !== artifact.titleTermAreas.length
	)
		return "is malformed";
	if (artifact.nameNormalisation !== NAME_NORMALISATION)
		return "was normalised under different name rules than this API applies";
	if (artifact.areaInventoryHash !== areaInventoryHash)
		return "was not built from the current area inventory";
	return void 0;
};
var AreaSearch = class {
	constructor(index, areaLookup) {
		this.index = index;
		this.areaLookup = areaLookup;
		this.offsets = [0];
		for (const release of index.releases)
			this.offsets.push(this.offsets.at(-1) + release.codes.length);
		this.prefixes = index.releases.map((release) =>
			releasePrefix(release.geography, release.boundaryRelease),
		);
	}
	index;
	areaLookup;
	/** Where each release's identities begin, and one past the last. */
	offsets;
	prefixes;
	releaseAt(position) {
		let low = 0;
		let high = this.index.releases.length - 1;
		while (low < high) {
			const middle = (low + high + 1) >> 1;
			if (this.offsets[middle] <= position) low = middle;
			else high = middle - 1;
		}
		return low;
	}
	result(position) {
		const at = this.releaseAt(position);
		const { geography, boundaryRelease, codes } = this.index.releases[at];
		const code = codes[position - this.offsets[at]];
		const area = this.areaLookup
			.get(releaseKey(geography, boundaryRelease))
			.get(code);
		return {
			id: `${geography}/${boundaryRelease}/${code}`,
			geography,
			boundaryRelease,
			...area,
		};
	}
	/** The position of the identity with this id, or -1. */
	positionOfId(id) {
		const slash = id.lastIndexOf("/");
		if (slash === -1) return -1;
		const at = findSorted(this.prefixes, id.slice(0, slash + 1));
		if (at === -1) return -1;
		const within = findSorted(
			this.index.releases[at].codes,
			id.slice(slash + 1),
		);
		return within === -1 ? -1 : this.offsets[at] + within;
	}
	/** The positions in `releases` of those the filters admit. */
	admitted({ geography, boundaryRelease }) {
		return this.index.releases.flatMap((release, at) =>
			(geography == null || release.geography === geography) &&
			(boundaryRelease == null ||
				release.boundaryRelease === boundaryRelease)
				? [at]
				: [],
		);
	}
	matches(positions) {
		return {
			length: positions.length,
			positionOf: (id) => {
				const position = this.positionOfId(id);
				return position === -1 ? -1 : findNumber(positions, position);
			},
			slice: (start, end) =>
				positions
					.slice(start, end)
					.map((position) => this.result(position)),
		};
	}
	filtered(positions, filters) {
		const releases = new Set(this.admitted(filters));
		const kept = [];
		for (const position of positions) {
			if (releases.has(this.releaseAt(position))) kept.push(position);
		}
		return kept.sort((left, right) => left - right);
	}
	/**
	 * Every identity the filters admit or, given a query, an exact code match
	 * or else every identity with a code, name or alias beginning with it.
	 */
	search(filters) {
		if (!filters.query) {
			const positions = [];
			for (const at of this.admitted(filters)) {
				for (let p = this.offsets[at]; p < this.offsets[at + 1]; p += 1)
					positions.push(p);
			}
			return this.matches(positions);
		}
		const codeQuery = filters.query.toLocaleLowerCase();
		const nameQuery = normalisePlaceName(filters.query);
		if (!nameQuery) return this.matches([]);
		const term = findSorted(this.index.terms, nameQuery);
		if (term !== -1) {
			const exact = this.filtered(
				this.index.termAreas[term].filter(
					(position) =>
						this.codeAt(position).toLocaleLowerCase() === codeQuery,
				),
				filters,
			);
			if (exact.length > 0) return this.matches(exact);
		}
		const found = /* @__PURE__ */ new Set();
		for (
			let position = lowerBound(this.index.terms, nameQuery);
			position < this.index.terms.length &&
			this.index.terms[position].startsWith(nameQuery);
			position += 1
		) {
			for (const area of this.index.termAreas[position]) found.add(area);
		}
		return this.matches(this.filtered(found, filters));
	}
	/**
	 * Every identity whose code, name or alias could equal the query exactly,
	 * including once an administrative title is set aside. The caller decides
	 * which kind of match each one is.
	 */
	exactCandidates(filters) {
		const nameQuery = normalisePlaceName(filters.query);
		if (!nameQuery) return [];
		const term = findSorted(this.index.terms, nameQuery);
		const titleTerm = findSorted(this.index.titleTerms, nameQuery);
		return this.filtered(
			[
				...(term === -1 ? [] : this.index.termAreas[term]),
				...(titleTerm === -1
					? []
					: this.index.titleTermAreas[titleTerm]),
			],
			filters,
		)
			.filter((position, index, all) => position !== all[index - 1])
			.map((position) => this.result(position));
	}
	codeAt(position) {
		const at = this.releaseAt(position);
		return this.index.releases[at].codes[position - this.offsets[at]];
	}
};

// src/resolver/areas.ts
var areaId = ({ geography, boundaryRelease, code }) =>
	areaKey(geography, boundaryRelease, code);
var AreasResolver = class {
	constructor(inputs) {
		this.inputs = inputs;
		this.derivedSources = derivedReleaseSources(inputs.areaInventory);
		for (const release of inputs.boundaryRegistry?.releases ?? [])
			this.boundaryReleases.set(
				releaseKey(release.geography, release.id),
				release,
			);
		this.areaSearch = lazyValue(() =>
			inputs.areaSearchIndex && inputs.areaLookup
				? new AreaSearch(inputs.areaSearchIndex, inputs.areaLookup)
				: void 0,
		);
		if (inputs.areaLookup) {
			for (const releaseIdentity of inputs.areaLookup.keys()) {
				const [geography, boundaryRelease] = releaseIdentity.split(
					"/",
					2,
				);
				if (!geography || !boundaryRelease) continue;
				const releases = this.geographyReleases.get(geography) ?? [];
				releases.push(boundaryRelease);
				this.geographyReleases.set(geography, releases);
			}
			for (const [geography, releases] of this.geographyReleases)
				releases.sort((left, right) => {
					const leftRelease = this.boundaryReleases.get(
						releaseKey(geography, left),
					);
					const rightRelease = this.boundaryReleases.get(
						releaseKey(geography, right),
					);
					return leftRelease && rightRelease
						? compareBoundaryReleases(leftRelease, rightRelease)
						: left.localeCompare(right);
				});
		}
	}
	inputs;
	areaSearch;
	/** Each geography's releases in the area inventory, oldest first. */
	geographyReleases = /* @__PURE__ */ new Map();
	boundaryReleases = /* @__PURE__ */ new Map();
	derivedSources;
	area(identity) {
		return this.inputs.areaLookup
			?.get(releaseKey(identity.geography, identity.boundaryRelease))
			?.get(identity.code);
	}
	hasAreas() {
		return this.inputs.areaLookup !== void 0;
	}
	/** Every exact geography/release pair with compiled area identities. */
	areaReleases() {
		return [...(this.inputs.areaLookup?.keys() ?? [])]
			.map((identity) => {
				const [geography, boundaryRelease] = identity.split("/", 2);
				return geography && boundaryRelease
					? { geography, boundaryRelease }
					: void 0;
			})
			.filter((endpoint) => endpoint !== void 0)
			.sort(
				(left, right) =>
					left.geography.localeCompare(right.geography) ||
					right.boundaryRelease.localeCompare(left.boundaryRelease),
			);
	}
	releaseAreas(geography, boundaryRelease) {
		return this.inputs.areaLookup?.get(
			releaseKey(geography, boundaryRelease),
		);
	}
	countryIdentity(code) {
		for (const boundaryRelease of [
			...(this.geographyReleases.get("country") ?? []),
		].reverse()) {
			const area = this.area({
				geography: "country",
				boundaryRelease,
				code,
			});
			if (area)
				return {
					id: areaKey("country", boundaryRelease, code),
					boundaryRelease,
					...area,
				};
		}
		return void 0;
	}
	hasPlaceIndex() {
		return this.inputs.placeIndex !== void 0;
	}
	places(query, limit, asOf) {
		if (!this.inputs.placeIndex) return [];
		return resolvePlaces(this.inputs.placeIndex, query, limit, asOf);
	}
	hasAreaRelease(geography, boundaryRelease) {
		return (
			this.inputs.areaLookup?.has(
				releaseKey(geography, boundaryRelease),
			) ?? false
		);
	}
	areaCodes(geography, boundaryRelease) {
		const areas = this.inputs.areaLookup?.get(
			releaseKey(geography, boundaryRelease),
		);
		return areas ? [...areas.keys()] : void 0;
	}
	boundaryRelease(geography, id) {
		return this.boundaryReleases.get(releaseKey(geography, id));
	}
	boundaryReleasesFor(geography) {
		return geography
			? [...this.boundaryReleases.values()].filter(
					(release) => release.geography === geography,
				)
			: [...this.boundaryReleases.values()];
	}
	/** Every compiled release of this geography holding the code, oldest first. */
	codeReleases(identity) {
		const { geography, code } = identity;
		return (this.geographyReleases.get(geography) ?? []).flatMap(
			(boundaryRelease) => {
				const area = this.area({ geography, boundaryRelease, code });
				return area
					? [
							{
								id: areaId({
									geography,
									boundaryRelease,
									code,
								}),
								geography,
								boundaryRelease,
								...area,
							},
						]
					: [];
			},
		);
	}
	/**
	 * The code in every other release of its geography, oldest first. A
	 * geography has a few dozen releases at most, so this is that many
	 * lookups and needs no index of its own.
	 */
	sameCode(identity) {
		return this.codeReleases(identity)
			.filter(
				(candidate) =>
					candidate.boundaryRelease !== identity.boundaryRelease,
			)
			.map((candidate) => ({
				...candidate,
				status: "same-code-continuity",
			}));
	}
	explainAreaAbsence(geography, boundaryRelease, code) {
		return this.inputs.boundaryRegistry
			? explainAreaAbsence(
					this.inputs.boundaryRegistry,
					this.inputs.areaInventory,
					this.inputs.areaLookup,
					geography,
					boundaryRelease,
					code,
				)
			: void 0;
	}
	validateAreas(geography, boundaryRelease, values) {
		if (
			!this.inputs.areaLookup?.has(releaseKey(geography, boundaryRelease))
		)
			return void 0;
		const validated = validateBatch(
			this.inputs.areaLookup,
			geography,
			boundaryRelease,
			values,
		);
		return { values: validated, summary: summariseBatch(validated) };
	}
	selectReleaseForDate(geography, month2, country) {
		return this.inputs.boundaryRegistry
			? selectReleaseForDate(
					this.inputs.boundaryRegistry,
					geography,
					month2,
					country,
					this.derivedSources,
				)
			: void 0;
	}
	hasAreaSearch() {
		return this.inputs.areaSearchIndex !== void 0;
	}
	searchAreas(query) {
		return (
			this.areaSearch()?.search(query) ?? {
				length: 0,
				positionOf: () => -1,
				slice: () => [],
			}
		);
	}
	exactAreaCandidates(query) {
		return this.areaSearch()?.exactCandidates(query) ?? [];
	}
	resolveAreaCandidates(query) {
		return this.exactAreaCandidates(query).flatMap((area) => {
			const matches = [
				...(area.code.toLocaleLowerCase() ===
				query.query.toLocaleLowerCase()
					? ["code-exact"]
					: []),
				...[area.name, ...(area.aliases ?? [])].flatMap((label) => {
					const match = exactNameMatch(label, query.query);
					return match ? [match] : [];
				}),
			];
			return matches.length > 0
				? [
						{
							area,
							matches: [...new Set(matches)],
						},
					]
				: [];
		});
	}
};

// src/resolver/catalogue.ts
var CatalogueResolver = class {
	constructor(inputs) {
		this.inputs = inputs;
		for (const crosswalk of inputs.crosswalkInventory?.crosswalks ?? []) {
			if (!this.crosswalksById.has(crosswalk.id))
				this.crosswalksById.set(crosswalk.id, crosswalk);
			if (!this.crosswalksByArtifact.has(crosswalk.artifact))
				this.crosswalksByArtifact.set(crosswalk.artifact, crosswalk);
		}
		for (const release of inputs.areaInventory?.releases ?? []) {
			const identity = `${release.geography}/${release.id}`;
			if (!this.areaReleasesByIdentity.has(identity))
				this.areaReleasesByIdentity.set(identity, release);
			if (
				release.status === "available" &&
				!this.areaReleasesByArtifact.has(release.artifact)
			)
				this.areaReleasesByArtifact.set(release.artifact, release);
		}
	}
	inputs;
	crosswalksById = /* @__PURE__ */ new Map();
	crosswalksByArtifact = /* @__PURE__ */ new Map();
	areaReleasesByIdentity = /* @__PURE__ */ new Map();
	areaReleasesByArtifact = /* @__PURE__ */ new Map();
	crosswalkSummary(id) {
		return this.crosswalksById.get(id);
	}
	crosswalkSummaryForArtifact(artifact) {
		return this.crosswalksByArtifact.get(artifact);
	}
	crosswalkSummaries() {
		return this.inputs.crosswalkInventory?.crosswalks ?? [];
	}
	areaIdentityRelease(geography, boundaryRelease) {
		return this.areaReleasesByIdentity.get(
			`${geography}/${boundaryRelease}`,
		);
	}
	areaIdentityReleaseForArtifact(artifact) {
		return this.areaReleasesByArtifact.get(artifact);
	}
	namedLocationMembershipInventory() {
		const inventory = this.inputs.namedLocationInventory;
		return inventory
			? {
					contentHash: inventory.contentHash,
					locations: inventory.locations,
				}
			: void 0;
	}
};

// src/resolver/conversionCapability.ts
var operationsForPurpose = (purpose) =>
	purpose === "identity"
		? {
				permitted: ["identity-join", "code-translation"],
				prohibited: ["weighted-allocation", "containment-aggregation"],
				note: "Use this path to identify the declared equivalent area; it does not supply weights or membership.",
			}
		: purpose === "membership"
			? {
					permitted: ["containment-aggregation", "membership-join"],
					prohibited: ["weighted-allocation"],
					note: "Use this path to group members under a parent. It does not allocate a source value across overlapping targets.",
				}
			: {
					permitted: ["weighted-allocation"],
					prohibited: ["identity-join"],
					note: "Use this path only for measures whose semantics permit the published overlap weighting.",
				};
var NOT_BUILT_REASON =
	"A required crosswalk or area identity artifact is not built.";
var DERIVED_STEP_REASON =
	"At least one path step is derived rather than publisher-supplied.";
var assessPathTrust = (path, coverage) => {
	if (coverage === "not-built")
		return { level: "not-built", reasons: [NOT_BUILT_REASON] };
	if (coverage === "partial")
		return {
			level: "partial",
			reasons: ["The declared path does not cover every source area."],
		};
	if (path.origin === "discovered")
		return {
			level: "derived",
			reasons: [
				"The build's path search composed this path under its composition rules; no one has reviewed it.",
				...(path.quality === "derived" ? [DERIVED_STEP_REASON] : []),
			],
		};
	if (path.quality === "derived")
		return { level: "derived", reasons: [DERIVED_STEP_REASON] };
	return {
		level: "verified",
		reasons: [
			"Every path step is publisher-supplied and has complete compiled coverage.",
		],
	};
};
var rankResolvedPaths = (paths) => {
	const coverageOrder = { complete: 0, partial: 1, "not-built": 2 };
	const trustOrder = {
		verified: 0,
		derived: 1,
		partial: 2,
		"not-built": 3,
	};
	const originOrder = { crosswalk: 0, declared: 1, discovered: 2 };
	return [...paths]
		.sort(
			(left, right) =>
				coverageOrder[left.coverage.status] -
					coverageOrder[right.coverage.status] ||
				trustOrder[left.trust.level] - trustOrder[right.trust.level] ||
				originOrder[left.origin] - originOrder[right.origin] ||
				left.steps.length - right.steps.length ||
				left.id.localeCompare(right.id),
		)
		.map((path, index) => ({
			...path,
			rank: {
				position: index + 1,
				reasons: [
					`${path.coverage.status} source coverage`,
					`${path.trust.level} evidence`,
					`${path.origin} path`,
					`${path.steps.length} ${path.steps.length === 1 ? "step" : "steps"}`,
				],
			},
		}));
};
var capabilityStatus = (paths, missingPrerequisites) => {
	if (paths.length === 0)
		return missingPrerequisites.some((item) => item.status === "not-built")
			? "not-built"
			: "unsupported";
	if (paths.some((path) => path.coverage.status === "complete"))
		return "available";
	if (paths.some((path) => path.coverage.status === "partial"))
		return "partial";
	return "not-built";
};
var planConversion = (capability, purpose, operation) => {
	const [selectedPath, ...alternatives] = capability.paths;
	const operationPermitted =
		!operation ||
		!selectedPath ||
		selectedPath.operations.permitted.includes(operation);
	const status = operationPermitted ? capability.status : "unsupported";
	const reason = !operationPermitted
		? `${operation} is not permitted for a ${purpose} conversion; the selected path permits ${selectedPath.operations.permitted.join(" and ")} instead.`
		: status === "available"
			? void 0
			: (capability.missingPrerequisites[0]?.reason ??
				(status === "partial"
					? "The best published path does not cover every source area."
					: "No published conversion path can satisfy this request."));
	return {
		status,
		purpose,
		...(operation ? { operation } : {}),
		...(selectedPath ? { selectedPath } : {}),
		alternatives,
		missingPrerequisites: capability.missingPrerequisites,
		...(reason ? { reason } : {}),
	};
};
var buildConversionReach = (pathGroups) => {
	const reach = /* @__PURE__ */ new Map();
	const entry = (geography, boundaryRelease) => {
		const key = releaseKey(geography, boundaryRelease);
		const existing = reach.get(key);
		if (existing) return existing;
		const created = {
			status: "isolated",
			reaches: [],
			reachedFrom: [],
			vintagePathCount: 0,
		};
		reach.set(key, created);
		return created;
	};
	const add = (into, geography) => {
		if (!into.includes(geography)) into.push(geography);
	};
	for (const paths of pathGroups) {
		for (const path of paths) {
			const source = entry(
				path.from.geography,
				path.from.boundaryRelease,
			);
			const target = entry(path.to.geography, path.to.boundaryRelease);
			if (path.from.geography === path.to.geography) {
				source.vintagePathCount += 1;
				target.vintagePathCount += 1;
				continue;
			}
			add(source.reaches, path.to.geography);
			add(target.reachedFrom, path.from.geography);
		}
	}
	for (const found of reach.values()) {
		found.reaches.sort();
		found.reachedFrom.sort();
		found.status =
			found.reaches.length > 0 || found.reachedFrom.length > 0
				? "connected"
				: found.vintagePathCount > 0
					? "vintage-only"
					: "isolated";
	}
	return reach;
};
var PrerequisiteLog = class {
	items = [];
	add(item) {
		if (!this.items.some((existing) => existing.reason === item.reason))
			this.items.push(item);
		return item.reason;
	}
};
var areasMissingReason = (endpoint) =>
	`No compiled area identity artifact is available for ${endpoint.geography}/${endpoint.boundaryRelease}.`;
var ConversionCapabilities = class {
	constructor(inputs, translator) {
		this.inputs = inputs;
		this.translator = translator;
		for (const release of inputs.areaInventory?.releases ?? []) {
			const key = releaseKey(release.geography, release.id);
			if (!this.areaReleasesByEndpoint.has(key))
				this.areaReleasesByEndpoint.set(key, release);
		}
		for (const paths of inputs.relationshipPathIndex?.values() ?? [])
			for (const path of paths) {
				const key = releaseKey(
					path.from.geography,
					path.from.boundaryRelease,
				);
				const indexed = this.pathsBySource.get(key) ?? [];
				indexed.push(path);
				this.pathsBySource.set(key, indexed);
			}
	}
	inputs;
	translator;
	reachByRelease;
	areaReleasesByEndpoint = /* @__PURE__ */ new Map();
	pathsBySource = /* @__PURE__ */ new Map();
	/** Compiled area count, falling back to the inventory when not loaded. */
	areaCount(endpoint) {
		const lookupCount = this.inputs.areaLookup?.get(
			releaseKey(endpoint.geography, endpoint.boundaryRelease),
		)?.size;
		if (lookupCount !== void 0) return lookupCount;
		const release = this.areaReleasesByEndpoint.get(
			releaseKey(endpoint.geography, endpoint.boundaryRelease),
		);
		return release?.status === "available" ? release.recordCount : void 0;
	}
	/** How much of each step's source release its crosswalk maps. */
	stepCoverage(path, step, missing) {
		const { crosswalkId, direction } = step;
		const artifact = this.translator.artifact(crosswalkId);
		if (!artifact) {
			const reason = missing.add({
				id: "crosswalk-artifact",
				status: "not-built",
				reason: `The crosswalk artifact ${crosswalkId} required by ${path.id} is not built.`,
			});
			return {
				crosswalkId,
				direction,
				status: "not-built",
				missingPrerequisite: reason,
			};
		}
		const stepSource =
			direction === "forward" ? artifact.from : artifact.to;
		const sourceCodes = this.inputs.areaLookup?.get(
			releaseKey(stepSource.geography, stepSource.boundaryRelease),
		);
		const mapped = this.translator.stepTargets(artifact, direction);
		let mappedSourceAreaCount = mapped.size;
		if (sourceCodes) {
			for (const code of mapped.keys())
				if (!sourceCodes.has(code)) mappedSourceAreaCount -= 1;
		}
		const sourceAreaCount = this.areaCount(stepSource);
		if (sourceAreaCount === void 0) {
			const reason = missing.add({
				id: "path-step-areas",
				status: "not-built",
				reason: areasMissingReason(stepSource),
			});
			return {
				crosswalkId,
				direction,
				status: "not-built",
				mappedSourceAreaCount,
				missingPrerequisite: reason,
			};
		}
		const share = mappedSourceAreaCount / sourceAreaCount;
		return {
			crosswalkId,
			direction,
			status: share === 1 ? "complete" : "partial",
			mappedSourceAreaCount,
			sourceAreaCount,
			share,
		};
	}
	assessPath(path, sourceAreaCount, missing) {
		const steps = path.steps.map((step) =>
			this.stepCoverage(path, step, missing),
		);
		const reached = steps.some((step) => step.status === "not-built")
			? void 0
			: this.translator.pathReach(path, path.from);
		const share =
			reached !== void 0 && sourceAreaCount
				? reached / sourceAreaCount
				: void 0;
		const status =
			reached === void 0
				? "not-built"
				: share === 1
					? "complete"
					: "partial";
		return {
			...path,
			operations: operationsForPurpose(path.purpose),
			trust: assessPathTrust(path, status),
			coverage: {
				status,
				mappedSourceAreaCount: reached,
				sourceAreaCount,
				share,
				steps,
			},
		};
	}
	/**
	 * Explains whether an exact conversion is usable, including the source
	 * coverage of each declared path and every artifact that is still needed to
	 * make that claim. This keeps route handlers out of crosswalk internals.
	 */
	relationshipCapability(from, to, purpose) {
		const missing = new PrerequisiteLog();
		const sourceAreaCount = this.areaCount(from);
		if (sourceAreaCount === void 0)
			missing.add({
				id: "source-areas",
				status: "not-built",
				reason: areasMissingReason(from),
			});
		if (this.areaCount(to) === void 0)
			missing.add({
				id: "target-areas",
				status: "not-built",
				reason: areasMissingReason(to),
			});
		const paths = this.translator.publishedPaths(from, to, purpose);
		if (paths.length === 0)
			missing.add({
				id: "relationship-path",
				status: "unsupported",
				reason: `No declared ${purpose} path is published from ${from.geography}/${from.boundaryRelease} to ${to.geography}/${to.boundaryRelease}.`,
			});
		const rankedPaths = rankResolvedPaths(
			paths.map((path) =>
				this.assessPath(path, sourceAreaCount, missing),
			),
		);
		return {
			status: capabilityStatus(rankedPaths, missing.items),
			paths: rankedPaths,
			missingPrerequisites: missing.items,
		};
	}
	conversionPlan(from, to, purpose, operation) {
		return planConversion(
			this.relationshipCapability(from, to, purpose),
			purpose,
			operation,
		);
	}
	/** Every declared conversion starting at one exact release, grouped safely by endpoint and purpose. */
	relationshipCapabilitiesFrom(from) {
		const discovered = /* @__PURE__ */ new Map();
		for (const path of this.pathsBySource.get(
			releaseKey(from.geography, from.boundaryRelease),
		) ?? []) {
			const key = [
				path.to.geography,
				path.to.boundaryRelease,
				path.purpose,
			].join("/");
			discovered.set(key, { to: path.to, purpose: path.purpose });
		}
		return [...discovered.values()]
			.map(({ to, purpose }) => ({
				to,
				purpose,
				...this.relationshipCapability(from, to, purpose),
			}))
			.sort((left, right) =>
				[left.to.geography, left.to.boundaryRelease, left.purpose]
					.join("/")
					.localeCompare(
						[
							right.to.geography,
							right.to.boundaryRelease,
							right.purpose,
						].join("/"),
					),
			);
	}
	/** Built once, because the answer for one release depends on every path. */
	conversionReach() {
		this.reachByRelease ??= buildConversionReach(
			this.inputs.relationshipPathIndex?.values() ?? [],
		);
		return this.reachByRelease;
	}
};

// src/resolver/capability.ts
var CapabilityResolver = class {
	constructor(
		inputs,
		translator,
		relationships,
		hasRelationships,
		boundaryRelease,
		relatedCodes,
	) {
		this.relationships = relationships;
		this.hasRelationships = hasRelationships;
		this.boundaryRelease = boundaryRelease;
		this.relatedCodes = relatedCodes;
		this.inputs = inputs;
		this.conversions = new ConversionCapabilities(inputs, translator);
	}
	relationships;
	hasRelationships;
	boundaryRelease;
	relatedCodes;
	conversions;
	relationshipCoverageCache = /* @__PURE__ */ new Map();
	geographyHealthCache;
	/** Counts compiled with the crosswalks, read once from the inventory. */
	compiledCoverage;
	inputs;
	relationshipCapability(from, to, purpose) {
		return this.conversions.relationshipCapability(from, to, purpose);
	}
	conversionPlan(from, to, purpose, operation) {
		return this.conversions.conversionPlan(from, to, purpose, operation);
	}
	relationshipCapabilitiesFrom(from) {
		return this.conversions.relationshipCapabilitiesFrom(from);
	}
	relationshipCoverage(geography, boundaryRelease, relation, limit = 25) {
		const areas = this.inputs.areaLookup?.get(
			releaseKey(geography, boundaryRelease),
		);
		if (!areas || !this.hasRelationships()) return void 0;
		const key = `${releaseKey(geography, boundaryRelease)}\0${relation ?? ""}`;
		let cached = this.relationshipCoverageCache.get(key);
		if (!cached) {
			const byRelation = {};
			const crosswalkIds = /* @__PURE__ */ new Set();
			let relatedAreaCount = 0;
			let relationshipCount = 0;
			const uncoveredCodes2 = [];
			for (const [code] of areas) {
				const relationships = this.relationships(
					{ geography, boundaryRelease, code },
					relation,
				);
				if (relationships.length > 0) {
					relatedAreaCount += 1;
					relationshipCount += relationships.length;
					for (const candidate of relationships) {
						byRelation[candidate.relation] =
							(byRelation[candidate.relation] ?? 0) + 1;
						crosswalkIds.add(candidate.crosswalk.id);
					}
				} else uncoveredCodes2.push(code);
			}
			cached = {
				areaCount: areas.size,
				relatedAreaCount,
				relationshipCount,
				byRelation,
				crosswalkIds: [...crosswalkIds].sort(),
				uncoveredCodes: uncoveredCodes2,
			};
			this.relationshipCoverageCache.set(key, cached);
		}
		const { uncoveredCodes, ...coverage } = cached;
		return {
			...coverage,
			byRelation: { ...coverage.byRelation },
			crosswalkIds: [...coverage.crosswalkIds],
			uncoveredAreas: uncoveredCodes.slice(0, limit).flatMap((code) => {
				const area = areas.get(code);
				return area
					? [
							{
								id: areaId({
									geography,
									boundaryRelease,
									code,
								}),
								...area,
							},
						]
					: [];
			}),
		};
	}
	/**
	 * How many of a release's areas have a relationship. Health reports this
	 * for every release at once, and everything else in a coverage answer
	 * (counts by relation, crosswalks, the uncovered areas) is built only for
	 * the one release a caller asks about.
	 */
	relatedAreaCounts(geography, boundaryRelease) {
		const areas = this.inputs.areaLookup?.get(
			releaseKey(geography, boundaryRelease),
		);
		if (!areas || !this.hasRelationships()) return void 0;
		const cached = this.relationshipCoverageCache.get(
			`${releaseKey(geography, boundaryRelease)}\0`,
		);
		if (cached) return cached;
		const compiled = this.compiledCoverageOf(
			releaseKey(geography, boundaryRelease),
		);
		if (compiled && compiled.areaCount === areas.size) return compiled;
		if (!this.relatedCodes)
			return this.relationshipCoverage(
				geography,
				boundaryRelease,
				void 0,
				1,
			);
		const related = this.relatedCodes(geography, boundaryRelease);
		let relatedAreaCount = 0;
		for (const [code] of areas)
			if (related.has(code)) relatedAreaCount += 1;
		return { areaCount: areas.size, relatedAreaCount };
	}
	/** A release's counts compiled with the crosswalks, where they are current. */
	compiledCoverageOf(release) {
		if (!this.compiledCoverage) {
			const compiled = this.inputs.crosswalkInventory?.releaseCoverage;
			this.compiledCoverage = new Map(
				compiled !== void 0 &&
					compiled.areaInventoryHash ===
						this.inputs.areaInventory?.contentHash
					? compiled.releases.map((coverage) => [
							releaseKey(
								coverage.geography,
								coverage.boundaryRelease,
							),
							coverage,
						])
					: [],
			);
		}
		return this.compiledCoverage.get(release);
	}
	geographyHealth() {
		if (!this.inputs.areaLookup) return [];
		if (this.geographyHealthCache) return [...this.geographyHealthCache];
		const reach = this.conversions.conversionReach();
		this.geographyHealthCache = [...this.inputs.areaLookup.keys()]
			.map((identity) => {
				const [geography, boundaryRelease] = identity.split("/", 2);
				const coverage = this.relatedAreaCounts(
					geography,
					boundaryRelease,
				);
				const areaCount =
					this.inputs.areaLookup?.get(identity)?.size ?? 0;
				const countries =
					this.boundaryRelease(geography, boundaryRelease)?.coverage
						.countries ?? [];
				const found = reach.get(identity) ?? {
					status: "isolated",
					reaches: [],
					reachedFrom: [],
					vintagePathCount: 0,
				};
				if (!coverage)
					return {
						geography,
						boundaryRelease,
						status: "not-built",
						areaCount,
						relatedAreaCount: 0,
						gapCount: areaCount,
						countries,
						reach: found,
					};
				return {
					geography,
					boundaryRelease,
					status:
						coverage.relatedAreaCount === coverage.areaCount
							? "available"
							: coverage.relatedAreaCount > 0
								? "partial"
								: "unsupported",
					areaCount: coverage.areaCount,
					relatedAreaCount: coverage.relatedAreaCount,
					gapCount: coverage.areaCount - coverage.relatedAreaCount,
					countries,
					reach: found,
				};
			})
			.sort((left, right) =>
				releaseKey(left.geography, left.boundaryRelease).localeCompare(
					releaseKey(right.geography, right.boundaryRelease),
				),
			);
		return [...this.geographyHealthCache];
	}
	relationshipRepairs() {
		const actionFor = (candidate) =>
			candidate.status === "eligible"
				? "publish-crosswalk"
				: candidate.status === "needs-review"
					? "review-candidate"
					: "compile-target-release";
		const order = {
			"publish-crosswalk": 0,
			"review-candidate": 1,
			"compile-target-release": 2,
		};
		return (this.inputs.relationshipCandidateInventory?.candidates ?? [])
			.filter((candidate) => !candidate.publishedCrosswalkId)
			.map((candidate) => ({ candidate, action: actionFor(candidate) }))
			.sort(
				(left, right) =>
					order[left.action] - order[right.action] ||
					left.candidate.id.localeCompare(right.candidate.id),
			);
	}
};

// src/relatedCodes.ts
var relatedCodesOf = (crosswalk) => {
	const source = /* @__PURE__ */ new Set();
	const target = /* @__PURE__ */ new Set();
	for (const record of crosswalk.records) {
		if (record.targets.length > 0) source.add(record.source.code);
		for (const { code } of record.targets) target.add(code);
	}
	return { source, target };
};

// src/relationshipPaths.ts
var relationshipPurposeFor = (crosswalk) =>
	crosswalk.relationshipPurpose ??
	(crosswalk.method === "official-lookup"
		? "identity"
		: crosswalk.method === "clean-containment" ||
			  crosswalk.method === "geometric-containment"
			? "membership"
			: crosswalk.method === "area-overlap" ||
				  crosswalk.method === "population-overlap"
				? "apportion"
				: crosswalk.method === "extent-continuity"
					? "identity"
					: void 0);
var createRelationshipPathIndex = (inventory) => {
	const index = /* @__PURE__ */ new Map();
	for (const path of inventory.paths) {
		const key = [
			path.from.geography,
			path.from.boundaryRelease,
			path.to.geography,
			path.to.boundaryRelease,
			path.purpose,
		].join("/");
		const paths = index.get(key) ?? [];
		paths.push(path);
		index.set(key, paths);
	}
	return index;
};

// src/resolver/translation.ts
var selectCrosswalks = (lookup, predicate) =>
	lookup?.where
		? lookup.where(predicate)
		: [...(lookup?.values() ?? [])].filter(predicate);
var endpointKey = (endpoint) =>
	releaseKey(endpoint.geography, endpoint.boundaryRelease);
var sameEndpoint = (left, right) =>
	left.geography === right.geography &&
	left.boundaryRelease === right.boundaryRelease;
var directRelationshipPath = (crosswalk, direction, purpose) => ({
	id: `${crosswalk.id}/${direction}/${purpose}`,
	purpose,
	from: direction === "forward" ? crosswalk.from : crosswalk.to,
	to: direction === "forward" ? crosswalk.to : crosswalk.from,
	quality: crosswalk.quality,
	origin: "crosswalk",
	steps: [
		{
			crosswalkId: crosswalk.id,
			direction,
			method: crosswalk.method,
			purpose,
		},
	],
});
var directTranslationPaths = (crosswalks, from, to, purpose) =>
	[...crosswalks].flatMap((crosswalk) => {
		if (relationshipPurposeFor(crosswalk) !== purpose) return [];
		if (
			sameEndpoint(crosswalk.from, from) &&
			sameEndpoint(crosswalk.to, to)
		)
			return [directRelationshipPath(crosswalk, "forward", purpose)];
		if (
			sameEndpoint(crosswalk.to, from) &&
			sameEndpoint(crosswalk.from, to)
		)
			return [directRelationshipPath(crosswalk, "reverse", purpose)];
		return [];
	});
var rankTranslationPaths = (paths) => {
	const origin = { crosswalk: 0, declared: 1, discovered: 2 };
	const quality = { "publisher-supplied": 0, derived: 1 };
	return [...paths].sort(
		(left, right) =>
			origin[left.origin] - origin[right.origin] ||
			quality[left.quality] - quality[right.quality] ||
			left.steps.length - right.steps.length ||
			left.id.localeCompare(right.id),
	);
};
var buildTranslationSteps = (artifact, direction) => {
	const steps = /* @__PURE__ */ new Map();
	if (direction === "forward") {
		for (const record of artifact.records)
			steps.set(record.source.code, {
				source: record.source,
				targets: record.targets,
			});
	} else if (
		artifact.method === "area-overlap" ||
		artifact.method === "population-overlap"
	) {
		const recordsByTarget = /* @__PURE__ */ new Map();
		for (const record of artifact.records) {
			for (const target of record.targets) {
				const records = recordsByTarget.get(target.code) ?? [];
				records.push({ record, target });
				recordsByTarget.set(target.code, records);
			}
		}
		for (const [code, records] of recordsByTarget) {
			const sourceCoverage = records.reduce(
				(sum, { target }) => sum + target.targetShare,
				0,
			);
			if (sourceCoverage <= 0) continue;
			steps.set(code, {
				source: {
					code,
					labels: [
						...new Set(
							records.flatMap(({ target }) => target.labels),
						),
					].sort(),
				},
				sourceCoverage,
				targets: records.map(({ record, target }) => ({
					...record.source,
					weight: target.targetShare / sourceCoverage,
					overlapAreaM2: target.overlapAreaM2,
					sourceShare: target.targetShare,
					targetShare: target.sourceShare,
				})),
			});
		}
	} else {
		const targetsBySource = /* @__PURE__ */ new Map();
		const labelsBySource = /* @__PURE__ */ new Map();
		for (const record of artifact.records) {
			for (const target of record.targets) {
				const targets = targetsBySource.get(target.code) ?? [];
				targets.push(record.source);
				targetsBySource.set(target.code, targets);
				const labels = labelsBySource.get(target.code) ?? [];
				labels.push(...target.labels);
				labelsBySource.set(target.code, labels);
			}
		}
		for (const [code, targets] of targetsBySource)
			steps.set(code, {
				source: {
					code,
					labels: [...new Set(labelsBySource.get(code) ?? [])].sort(),
				},
				targets,
			});
	}
	return steps;
};
var buildStepTargets = (artifact, direction) => {
	const targets = /* @__PURE__ */ new Map();
	for (const record of artifact.records) {
		for (const target of record.targets) {
			const [from, to] =
				direction === "forward"
					? [record.source.code, target.code]
					: [target.code, record.source.code];
			const reached = targets.get(from) ?? [];
			reached.push(to);
			targets.set(from, reached);
		}
	}
	return targets;
};
var weightOf = (target, missing) =>
	"weight" in target ? target.weight : missing;
var executeTranslationPath = (path, sourceCode, stepsFor) => {
	const [first, ...rest] = path.steps;
	if (!first) return void 0;
	const firstStep = stepsFor(first)?.get(sourceCode);
	if (!firstStep) return void 0;
	if (rest.length === 0) return { path, ...firstStep };
	let targets = firstStep.targets;
	for (const step of rest) {
		const steps = stepsFor(step);
		if (!steps) return void 0;
		targets = targets.flatMap((target) => {
			const translated = steps.get(target.code);
			if (!translated) return [];
			return translated.targets.map((next) => ({
				code: next.code,
				labels: next.labels,
				...(path.purpose === "apportion"
					? { weight: weightOf(target, 1) * weightOf(next, 1) }
					: {}),
			}));
		});
		if (targets.length === 0) return void 0;
	}
	const combined = /* @__PURE__ */ new Map();
	for (const target of targets) {
		const previous = combined.get(target.code);
		if (!previous) {
			combined.set(target.code, target);
			continue;
		}
		combined.set(target.code, {
			...previous,
			labels: [
				.../* @__PURE__ */ new Set([
					...previous.labels,
					...target.labels,
				]),
			].sort(),
			...(path.purpose === "apportion"
				? { weight: weightOf(previous, 0) + weightOf(target, 0) }
				: {}),
		});
	}
	const sourceCoverage = firstStep.sourceCoverage ?? 1;
	const resolvedCoverage =
		path.purpose === "apportion"
			? sourceCoverage *
				[...combined.values()].reduce(
					(sum, target) => sum + weightOf(target, 0),
					0,
				)
			: void 0;
	return {
		path,
		source: firstStep.source,
		targets: [...combined.values()].sort((left, right) =>
			left.code.localeCompare(right.code),
		),
		...(path.purpose === "apportion"
			? { sourceCoverage, resolvedCoverage }
			: {}),
	};
};
var translateArea = (paths, source, stepsFor) =>
	paths.flatMap((path) => {
		const translation = executeTranslationPath(path, source.code, stepsFor);
		return translation ? [translation] : [];
	});
var CrosswalkTranslator = class {
	constructor(inputs) {
		this.inputs = inputs;
	}
	inputs;
	translationStepCache = /* @__PURE__ */ new Map();
	stepTargetCache = /* @__PURE__ */ new Map();
	successorStepCache = /* @__PURE__ */ new Map();
	pathReachCache = /* @__PURE__ */ new Map();
	pathsById;
	hasCrosswalks() {
		return this.inputs.crosswalkLookup !== void 0;
	}
	artifact(id) {
		return this.inputs.crosswalkLookup?.get(id);
	}
	publishedPaths(from, to, purpose) {
		return (
			this.inputs.relationshipPathIndex?.get(
				[endpointKey(from), endpointKey(to), purpose].join("/"),
			) ?? []
		);
	}
	/** Every published path, in the inventory's order. */
	allPaths() {
		return [...(this.inputs.relationshipPathIndex?.values() ?? [])].flat();
	}
	/** A published path by id, from any source and target. */
	path(id) {
		if (!this.pathsById) {
			this.pathsById = /* @__PURE__ */ new Map();
			for (const paths of this.inputs.relationshipPathIndex?.values() ??
				[])
				for (const path of paths) this.pathsById.set(path.id, path);
		}
		return this.pathsById.get(id);
	}
	/**
	 * Every step of a path with its cached direction index, or the first
	 * crosswalk the path needs that is not loaded.
	 */
	indexedSteps(path) {
		const steps = [];
		for (const { crosswalkId, direction } of path.steps) {
			const artifact = this.artifact(crosswalkId);
			if (!artifact) return { missingCrosswalkId: crosswalkId };
			steps.push({
				artifact,
				direction,
				steps: this.translationSteps(artifact, direction),
			});
		}
		return { steps };
	}
	/**
	 * Published paths are the authority for a conversion. A small direct-path
	 * fallback keeps a translator useful when a consumer has loaded crosswalk
	 * artifacts but not the separately compiled path inventory, such as a
	 * focused test or an intentionally small deployment.
	 */
	paths(from, to, purpose) {
		const published = this.publishedPaths(from, to, purpose);
		return rankTranslationPaths(
			published.length > 0
				? published
				: directTranslationPaths(
						selectCrosswalks(
							this.inputs.crosswalkLookup,
							(header) =>
								(sameEndpoint(header.from, from) &&
									sameEndpoint(header.to, to)) ||
								(sameEndpoint(header.to, from) &&
									sameEndpoint(header.from, to)),
						),
						from,
						to,
						purpose,
					),
		);
	}
	/** Build each crosswalk direction once. */
	translationSteps(artifact, direction) {
		const key = `${artifact.id}/${direction}`;
		let steps = this.translationStepCache.get(key);
		if (!steps) {
			steps = buildTranslationSteps(artifact, direction);
			this.translationStepCache.set(key, steps);
		}
		return steps;
	}
	stepTargets(artifact, direction) {
		const key = `${artifact.id}/${direction}`;
		let targets = this.stepTargetCache.get(key);
		if (!targets) {
			targets = buildStepTargets(artifact, direction);
			this.stepTargetCache.set(key, targets);
		}
		return targets;
	}
	/**
	 * Translate one exact area through every published path that has a result
	 * for it. A composed path carries its full route so callers can inspect
	 * every step.
	 */
	translateArea(source, to, purpose) {
		return translateArea(
			this.paths(source, to, purpose),
			source,
			(step) => {
				const artifact = this.artifact(step.crosswalkId);
				return (
					artifact && this.translationSteps(artifact, step.direction)
				);
			},
		);
	}
	/**
	 * The one area of another release that is the same area as `source`, or
	 * undefined. The best-ranked identity path with an answer decides, so a
	 * publisher's lookup is heard before a derived crosswalk, and its answer
	 * stands even where it is no: an official split is not overruled by a
	 * derived match. The answer must be one area, and translating that area
	 * back must reach only `source`, so a successor that merged several areas,
	 * or took part of one, is not the same area.
	 */
	sameArea(source, to) {
		const [forward] = this.translateArea(source, to, "identity");
		const [target, ...others] = forward?.targets ?? [];
		if (!forward || !target || others.length > 0) return void 0;
		const [back] = this.translateArea(
			{ ...to, code: target.code },
			source,
			"identity",
		);
		const [returned, ...more] = back?.targets ?? [];
		return returned?.code === source.code && more.length === 0
			? { code: target.code, path: forward.path }
			: void 0;
	}
	/**
	 * The area of another release that succeeded `source`: the same area where
	 * there is one, or else one an extent-continuity crosswalk lists as
	 * realigned, its extent moved by a street but each keeping nearly all of
	 * the other. Unlike `sameArea`, a path that cannot answer one-to-one does
	 * not decide: a publisher's split of a ward that kept nearly all its
	 * extent does not stop the ward succeeding itself. Never use it to convert
	 * a value; it carries an area's history on, as a map's year picker does.
	 */
	successorArea(source, to) {
		const same = this.sameArea(source, to);
		if (same) return { ...same, realigned: false };
		const stepsFor = (step) => {
			const artifact = this.artifact(step.crosswalkId);
			return artifact && this.successorSteps(artifact, step.direction);
		};
		const only = (translation) =>
			translation.targets.length === 1
				? translation.targets[0].code
				: void 0;
		const backPaths = this.paths(to, source, "identity");
		for (const forward of translateArea(
			this.paths(source, to, "identity"),
			source,
			stepsFor,
		)) {
			const code = only(forward);
			if (code === void 0) continue;
			const returned = translateArea(
				backPaths,
				{ ...to, code },
				stepsFor,
			).map(only);
			if (returned.find((back) => back !== void 0) === source.code)
				return { code, path: forward.path, realigned: true };
		}
		return void 0;
	}
	/** A crosswalk's steps with its realigned pairs added as records. */
	successorSteps(artifact, direction) {
		if (
			artifact.method !== "extent-continuity" ||
			!artifact.validation.continuity.realigned?.length
		)
			return this.translationSteps(artifact, direction);
		const key = `${artifact.id}/${direction}`;
		let steps = this.successorStepCache.get(key);
		if (!steps) {
			steps = buildTranslationSteps(
				{
					...artifact,
					records: [
						...artifact.records,
						...artifact.validation.continuity.realigned.map(
							({ code, successor, ...measured }) => ({
								source: { code, labels: [] },
								targets: [
									{
										code: successor,
										labels: [],
										...measured,
									},
								],
							}),
						),
					],
				},
				direction,
			);
			this.successorStepCache.set(key, steps);
		}
		return steps;
	}
	/**
	 * How many of a path's source areas reach its target through every step.
	 * Walking back from the last step, each step keeps the codes with a target
	 * the next step still carries, so the pass is linear in the records.
	 */
	pathReach(path, from) {
		const cached = this.pathReachCache.get(path.id);
		if (cached !== void 0) return cached;
		let carried;
		for (const step of [...path.steps].reverse()) {
			const artifact = this.artifact(step.crosswalkId);
			if (!artifact) return void 0;
			const kept = /* @__PURE__ */ new Set();
			for (const [code, targets] of this.stepTargets(
				artifact,
				step.direction,
			))
				if (!carried || targets.some((target) => carried.has(target)))
					kept.add(code);
			carried = kept;
		}
		const sources = this.inputs.areaLookup?.get(endpointKey(from));
		const reach = sources
			? [...(carried ?? [])].filter((code) => sources.has(code)).length
			: (carried?.size ?? 0);
		this.pathReachCache.set(path.id, reach);
		return reach;
	}
};

// src/areaRelationships.ts
var areaId2 = (geography, boundaryRelease, code) =>
	areaKey(geography, boundaryRelease, code);
var relationFor = (
	{ method, relationshipPurpose },
	target,
	direction,
	cardinality,
) => {
	if (method === "best-fit")
		return "relation" in target && target.relation === "within"
			? direction === "from"
				? "within"
				: "contains"
			: "overlaps";
	if (
		method === "clean-containment" ||
		method === "geometric-containment" ||
		relationshipPurpose === "membership"
	) {
		return direction === "from" ? "within" : "contains";
	}
	if (method === "area-overlap" || method === "population-overlap")
		return "overlaps";
	if (method === "extent-continuity") return "equivalent-to";
	if (direction === "from") return "successor";
	if (
		cardinality.sourceTargetCount > 1 &&
		cardinality.targetSourceCount === 1
	)
		return "split-from";
	if (
		cardinality.targetSourceCount > 1 &&
		cardinality.sourceTargetCount === 1
	)
		return "merged-from";
	return "predecessor";
};
var AREA_RELATIONS = [
	"within",
	"contains",
	"successor",
	"predecessor",
	"split-from",
	"merged-from",
	"equivalent-to",
	"overlaps",
];
var relationsOf = ({ method, relationshipPurpose }, side) => {
	if (method === "best-fit")
		return side === "from"
			? ["within", "overlaps"]
			: ["contains", "overlaps"];
	if (
		method === "clean-containment" ||
		method === "geometric-containment" ||
		relationshipPurpose === "membership"
	)
		return side === "from" ? ["within"] : ["contains"];
	if (method === "area-overlap" || method === "population-overlap")
		return ["overlaps"];
	if (method === "extent-continuity") return ["equivalent-to"];
	return side === "from"
		? ["successor"]
		: ["split-from", "merged-from", "predecessor"];
};
var isLineageRelation = (relation) =>
	[
		"successor",
		"predecessor",
		"split-from",
		"merged-from",
		"equivalent-to",
	].includes(relation);
var overlapFor = (crosswalk, target, direction) => {
	if (crosswalk.method !== "area-overlap" || !("overlapAreaM2" in target))
		return {};
	return {
		overlap: {
			areaM2: target.overlapAreaM2,
			shareOfArea:
				direction === "from" ? target.sourceShare : target.targetShare,
			shareOfCounterpart:
				direction === "from" ? target.targetShare : target.sourceShare,
		},
	};
};
var metadataOf = (crosswalk) => ({
	id: crosswalk.id,
	method: crosswalk.method,
	quality: crosswalk.quality,
	weighting: crosswalk.weighting,
});
var sourceRelationship = (
	crosswalk,
	metadata,
	target,
	targetId,
	cardinality,
) => ({
	relation: relationFor(crosswalk, target, "from", cardinality),
	counterpart: {
		id: targetId,
		geography: crosswalk.to.geography,
		boundaryRelease: crosswalk.to.boundaryRelease,
		code: target.code,
		labels: target.labels,
	},
	crosswalk: metadata,
	...overlapFor(crosswalk, target, "from"),
});
var targetRelationship = (
	crosswalk,
	metadata,
	record,
	target,
	sourceId,
	cardinality,
) => ({
	relation: relationFor(crosswalk, target, "to", cardinality),
	counterpart: {
		id: sourceId,
		geography: crosswalk.from.geography,
		boundaryRelease: crosswalk.from.boundaryRelease,
		code: record.source.code,
		labels: record.source.labels,
	},
	crosswalk: metadata,
	...overlapFor(crosswalk, target, "to"),
});
var compareRelationships = (left, right) => {
	const relation = left.relation.localeCompare(right.relation);
	if (relation !== 0) return relation;
	const counterpart = left.counterpart.id.localeCompare(right.counterpart.id);
	return counterpart !== 0
		? counterpart
		: left.crosswalk.id.localeCompare(right.crosswalk.id);
};
var positionsIn = ({ records }) => {
	const sources = /* @__PURE__ */ new Map();
	const targets = /* @__PURE__ */ new Map();
	for (let position = 0; position < records.length; position += 1) {
		const record = records[position];
		const heads = sources.get(record.source.code);
		if (heads) heads.push(position);
		else sources.set(record.source.code, [position]);
		for (let at = 0; at < record.targets.length; at += 1) {
			const code = record.targets[at].code;
			const pairs = targets.get(code);
			if (pairs) pairs.push(position, at);
			else targets.set(code, [position, at]);
		}
	}
	return { sources, targets };
};
var LazyAreaRelationshipIndex = class {
	constructor(lookup) {
		this.lookup = lookup;
	}
	lookup;
	touching = /* @__PURE__ */ new Map();
	positions = /* @__PURE__ */ new Map();
	areas = /* @__PURE__ */ new Map();
	followed = /* @__PURE__ */ new Map();
	/**
	 * An area's relationships, or with `follow` only those of the relations
	 * it admits. A crosswalk's header says which relations it can state, so a
	 * filtered lookup reads only the crosswalks that could answer it: an
	 * area's lineage is in a few small files, and its memberships in large
	 * ones a history never needs. Which side of a crosswalk the area is on
	 * matters too: its parents are in the crosswalks it is a source of, and
	 * its children in those it is a target of.
	 */
	get(area, follow) {
		const all = this.areas.get(area);
		if (follow && !all) return this.following(area, follow);
		const relationships = all ?? this.relationshipsOf(area);
		if (!all) this.areas.set(area, relationships);
		const found = follow
			? relationships.filter(({ relation }) => follow(relation))
			: relationships;
		return found.length > 0 ? found : void 0;
	}
	following(area, follow) {
		const admitted = AREA_RELATIONS.filter(follow);
		const key = `${area}\0${admitted.join(",")}`;
		let relationships = this.followed.get(key);
		if (!relationships) {
			relationships = this.relationshipsOf(area, admitted).filter(
				({ relation }) => follow(relation),
			);
			this.followed.set(key, relationships);
		}
		return relationships.length > 0 ? relationships : void 0;
	}
	/** Built from every crosswalk naming the area's release, or those that can state `admitted`. */
	relationshipsOf(area, admitted) {
		const [geography, boundaryRelease] = area.split("/", 2);
		const code = area.slice(
			releaseKey(geography, boundaryRelease).length + 1,
		);
		return this.crosswalksFor(geography, boundaryRelease, admitted)
			.flatMap((crosswalk) =>
				this.relationshipsIn(
					crosswalk,
					geography,
					boundaryRelease,
					code,
				),
			)
			.sort(compareRelationships);
	}
	/**
	 * The codes of a release's areas that `get` answers for, read from the
	 * crosswalk records without building a relationship for any of them. A
	 * count of related areas needs no more, and building every relationship
	 * of every release holds a gigabyte of objects it would never read.
	 */
	relatedCodes(geography, boundaryRelease) {
		const codes = /* @__PURE__ */ new Set();
		for (const crosswalk of this.crosswalksFor(
			geography,
			boundaryRelease,
		)) {
			const { source, target } = relatedCodesOf(crosswalk);
			const from = crosswalk.from;
			const to = crosswalk.to;
			if (
				from.geography === geography &&
				from.boundaryRelease === boundaryRelease
			)
				for (const code of source) codes.add(code);
			if (
				to.geography === geography &&
				to.boundaryRelease === boundaryRelease
			)
				for (const code of target) codes.add(code);
		}
		return codes;
	}
	/**
	 * The crosswalks naming a release, in inventory order: all of them, or
	 * only those able to state one of the `admitted` relations.
	 */
	crosswalksFor(geography, boundaryRelease, admitted) {
		const release = releaseKey(geography, boundaryRelease);
		const key = admitted ? `${release}\0${admitted.join(",")}` : release;
		let crosswalks = this.touching.get(key);
		if (!crosswalks) {
			const names = (side) =>
				side.geography === geography &&
				side.boundaryRelease === boundaryRelease;
			crosswalks = selectCrosswalks(this.lookup, (header) =>
				["from", "to"].some(
					(side) =>
						names(header[side]) &&
						(!admitted ||
							relationsOf(header, side).some((relation) =>
								admitted.includes(relation),
							)),
				),
			);
			this.touching.set(key, crosswalks);
		}
		return crosswalks;
	}
	/**
	 * One area's relationships from one crosswalk, in the order the eager
	 * index adds them: by record, then by target, the source's before the
	 * target's.
	 */
	relationshipsIn(crosswalk, geography, boundaryRelease, code) {
		const { from, to, records } = crosswalk;
		const positions = this.positionsOf(crosswalk);
		const metadata = metadataOf(crosswalk);
		const cardinalityOf = (record, target) => ({
			// A source in two records counts as the eager index counts it:
			// by the last of them.
			sourceTargetCount:
				records[positions.sources.get(record.source.code).at(-1)]
					.targets.length,
			targetSourceCount: positions.targets.get(target.code).length / 2,
		});
		const found = [];
		if (
			from.geography === geography &&
			from.boundaryRelease === boundaryRelease
		)
			for (const position of positions.sources.get(code) ?? []) {
				const record = records[position];
				record.targets.forEach((target, targetPosition) =>
					found.push([
						position,
						targetPosition,
						0,
						sourceRelationship(
							crosswalk,
							metadata,
							target,
							areaId2(
								to.geography,
								to.boundaryRelease,
								target.code,
							),
							cardinalityOf(record, target),
						),
					]),
				);
			}
		const asSource = found.length;
		if (
			to.geography === geography &&
			to.boundaryRelease === boundaryRelease
		) {
			const pairs = positions.targets.get(code) ?? [];
			for (let pair = 0; pair < pairs.length; pair += 2) {
				const record = records[pairs[pair]];
				const target = record.targets[pairs[pair + 1]];
				found.push([
					pairs[pair],
					pairs[pair + 1],
					1,
					targetRelationship(
						crosswalk,
						metadata,
						record,
						target,
						areaId2(
							from.geography,
							from.boundaryRelease,
							record.source.code,
						),
						cardinalityOf(record, target),
					),
				]);
			}
		}
		if (asSource > 0 && found.length > asSource)
			found.sort(
				(left, right) =>
					left[0] - right[0] ||
					left[1] - right[1] ||
					left[2] - right[2],
			);
		return found.map(([, , , relationship]) => relationship);
	}
	positionsOf(crosswalk) {
		let positions = this.positions.get(crosswalk.id);
		if (!positions) {
			positions = positionsIn(crosswalk);
			this.positions.set(crosswalk.id, positions);
		}
		return positions;
	}
};

// src/resolver/lineage.ts
var LineageResolver = class {
	constructor(crosswalkLookup, area, sameCode) {
		this.area = area;
		this.sameCode = sameCode;
		if (crosswalkLookup)
			this.index = new LazyAreaRelationshipIndex(crosswalkLookup);
	}
	area;
	sameCode;
	index;
	hasAreaRelationships() {
		return this.index !== void 0;
	}
	/**
	 * An area's relationships, or only those of one relation, which reads
	 * fewer crosswalks than asking for all and filtering.
	 */
	relationships(identity, only) {
		return (
			this.index?.get(
				areaId(identity),
				only && ((relation) => relation === only),
			) ?? []
		);
	}
	/** The codes in a release that have at least one relationship. */
	relatedCodes(geography, boundaryRelease) {
		return (
			this.index?.relatedCodes(geography, boundaryRelease) ??
			/* @__PURE__ */ new Set()
		);
	}
	traverse(identity, follow, maximumDepth) {
		const origin = areaId(identity);
		const visited = /* @__PURE__ */ new Set([origin]);
		const reported = /* @__PURE__ */ new Set();
		const queue = [{ id: origin, depth: 0 }];
		const edges = [];
		while (queue.length > 0) {
			const current = queue.shift();
			if (current.depth >= maximumDepth) continue;
			for (const relationship of this.index?.get(current.id, follow) ??
				[]) {
				const ends = [current.id, relationship.counterpart.id].sort();
				const edge = `${relationship.crosswalk.id}|${ends[0]}|${ends[1]}`;
				if (!reported.has(edge)) {
					reported.add(edge);
					edges.push({
						...relationship,
						from: current.id,
						depth: current.depth + 1,
					});
				}
				if (!visited.has(relationship.counterpart.id)) {
					visited.add(relationship.counterpart.id);
					queue.push({
						id: relationship.counterpart.id,
						depth: current.depth + 1,
					});
				}
			}
		}
		return edges;
	}
	ancestorLineage(identity, maximumDepth) {
		return this.traverse(
			identity,
			(relation) => relation === "within",
			maximumDepth,
		);
	}
	descendantLineage(identity, maximumDepth) {
		return this.traverse(
			identity,
			(relation) => relation === "contains",
			maximumDepth,
		);
	}
	areaRelationshipSummary(identity) {
		const relationships = this.relationships(identity);
		const byRelation = relationships.reduce((counts, { relation }) => {
			counts[relation] = (counts[relation] ?? 0) + 1;
			return counts;
		}, {});
		return {
			relationships,
			byRelation,
			parentCount: byRelation.within ?? 0,
			childCount: byRelation.contains ?? 0,
			crosswalks: [
				...new Map(
					relationships.map((relationship) => [
						relationship.crosswalk.id,
						relationship.crosswalk,
					]),
				).values(),
			],
		};
	}
	areaHistory(identity, maximumDepth = 8) {
		const area = this.area(identity);
		if (!area) return void 0;
		const origin = areaId(identity);
		return {
			area,
			relationships: this.index?.get(origin, isLineageRelation) ?? [],
			lineage: this.traverse(identity, isLineageRelation, maximumDepth),
			sameCodeReleases: this.sameCode(identity),
		};
	}
};

// src/resolver/releaseComparison.ts
var areaId3 = ({ geography, boundaryRelease, code }) =>
	areaKey(geography, boundaryRelease, code);
var summarisePublishedRelationshipMapping = (crosswalk, direction, limit) => {
	const targetsByFrom = /* @__PURE__ */ new Map();
	const sourcesByTo = /* @__PURE__ */ new Map();
	for (const record of crosswalk.records) {
		const fromCode = direction === "forward" ? record.source.code : void 0;
		if (fromCode && !targetsByFrom.has(fromCode))
			targetsByFrom.set(fromCode, /* @__PURE__ */ new Set());
		for (const target of record.targets) {
			const viewedFrom =
				direction === "forward" ? record.source.code : target.code;
			const viewedTo =
				direction === "forward" ? target.code : record.source.code;
			const targets =
				targetsByFrom.get(viewedFrom) ?? /* @__PURE__ */ new Set();
			targets.add(viewedTo);
			targetsByFrom.set(viewedFrom, targets);
			const sources =
				sourcesByTo.get(viewedTo) ?? /* @__PURE__ */ new Set();
			sources.add(viewedFrom);
			sourcesByTo.set(viewedTo, sources);
		}
	}
	const fromEntries = [...targetsByFrom].sort(([left], [right]) =>
		left.localeCompare(right),
	);
	const toEntries = [...sourcesByTo].sort(([left], [right]) =>
		left.localeCompare(right),
	);
	const from = {
		noTargetCount: fromEntries.filter(([, targets]) => targets.size === 0)
			.length,
		oneTargetCount: fromEntries.filter(([, targets]) => targets.size === 1)
			.length,
		multipleTargetCount: fromEntries.filter(
			([, targets]) => targets.size > 1,
		).length,
	};
	const to = {
		oneSourceCount: toEntries.filter(([, sources]) => sources.size === 1)
			.length,
		multipleSourceCount: toEntries.filter(([, sources]) => sources.size > 1)
			.length,
	};
	const pairCount = fromEntries.reduce(
		(count, [, targets]) => count + targets.size,
		0,
	);
	const shape =
		pairCount === 0
			? "no-mappings"
			: from.multipleTargetCount > 0 && to.multipleSourceCount > 0
				? "many-to-many"
				: from.multipleTargetCount > 0
					? "one-to-many"
					: to.multipleSourceCount > 0
						? "many-to-one"
						: "one-to-one";
	return {
		shape,
		fromCodeCount: fromEntries.length,
		toCodeCount: toEntries.length,
		pairCount,
		from,
		to,
		examples: {
			oneToMany: fromEntries
				.filter(([, targets]) => targets.size > 1)
				.slice(0, limit)
				.map(([fromCode, targets]) => ({
					fromCode,
					toCodes: [...targets].sort(),
				})),
			manyToOne: toEntries
				.filter(([, sources]) => sources.size > 1)
				.slice(0, limit)
				.map(([toCode, sources]) => ({
					toCode,
					fromCodes: [...sources].sort(),
				})),
		},
		note: "Cardinality describes codes in this crosswalk's published records, viewed from the requested release to the other release. It does not establish a legal boundary change or account for release codes absent from the records.",
	};
};
var compareBoundaryReleases2 = (
	sources,
	geography,
	fromRelease,
	toRelease,
	limit = 25,
) => {
	const from = { geography, boundaryRelease: fromRelease };
	const to = { geography, boundaryRelease: toRelease };
	const fromAreas = sources.areaLookup?.get(
		releaseKey(geography, fromRelease),
	);
	const toAreas = sources.areaLookup?.get(releaseKey(geography, toRelease));
	if (!fromAreas || !toAreas) return void 0;
	const onlyInFrom = [...fromAreas]
		.filter(([code]) => !toAreas.has(code))
		.map(([code, area]) => ({
			id: areaId3({ ...from, code }),
			...area,
		}));
	const onlyInTo = [...toAreas]
		.filter(([code]) => !fromAreas.has(code))
		.map(([code, area]) => ({
			id: areaId3({ ...to, code }),
			...area,
		}));
	const sharedCodes = [...fromAreas.keys()]
		.filter((code) => toAreas.has(code))
		.sort();
	const between = [];
	const joins = (left, leftRelease, right, rightRelease) =>
		left.geography === geography &&
		left.boundaryRelease === leftRelease &&
		right.geography === geography &&
		right.boundaryRelease === rightRelease;
	for (const crosswalk of selectCrosswalks(
		sources.crosswalkLookup,
		({ from: from2, to: to2 }) =>
			joins(from2, fromRelease, to2, toRelease) ||
			joins(to2, fromRelease, from2, toRelease),
	)) {
		if (joins(crosswalk.from, fromRelease, crosswalk.to, toRelease))
			between.push({ crosswalk, direction: "forward" });
		else between.push({ crosswalk, direction: "reverse" });
	}
	between.sort((left, right) =>
		left.crosswalk.id.localeCompare(right.crosswalk.id),
	);
	const continuityArtifacts = between.filter(
		(entry) => entry.crosswalk.method === "extent-continuity",
	);
	const continuousCodes = /* @__PURE__ */ new Set();
	const recoded = /* @__PURE__ */ new Map();
	const changedExtent = /* @__PURE__ */ new Map();
	const unmeasured = /* @__PURE__ */ new Map();
	for (const { crosswalk, direction } of continuityArtifacts) {
		for (const record of crosswalk.records)
			for (const target of record.targets) {
				const fromCode =
					direction === "forward" ? record.source.code : target.code;
				if (target.match === "recoded")
					recoded.set(fromCode, {
						fromCode,
						toCode:
							direction === "forward"
								? target.code
								: record.source.code,
						widestDifferenceM: target.widestDifferenceM,
					});
				else continuousCodes.add(fromCode);
			}
		for (const finding of crosswalk.validation.continuity.changedExtent) {
			const current = changedExtent.get(finding.code);
			const candidate = {
				code: finding.code,
				relation: finding.relation,
				widestDifferenceM: finding.widestDifferenceM,
				fromShare:
					direction === "forward"
						? finding.sourceShare
						: finding.targetShare,
				toShare:
					direction === "forward"
						? finding.targetShare
						: finding.sourceShare,
			};
			if (
				!current ||
				candidate.widestDifferenceM > current.widestDifferenceM
			)
				changedExtent.set(finding.code, candidate);
		}
		for (const finding of crosswalk.validation.continuity.unmeasured)
			unmeasured.set(finding.code, finding.reason);
	}
	const assessed = /* @__PURE__ */ new Set([
		...continuousCodes,
		...changedExtent.keys(),
		...unmeasured.keys(),
	]);
	const unassessedSharedCodes = sharedCodes.filter(
		(code) => !assessed.has(code),
	);
	const changed = [...changedExtent.values()].sort(
		(left, right) =>
			right.widestDifferenceM - left.widestDifferenceM ||
			left.code.localeCompare(right.code),
	);
	const publishedRelationships = between
		.filter(({ crosswalk }) => crosswalk.method !== "extent-continuity")
		.map(({ crosswalk, direction }) => ({
			id: crosswalk.id,
			direction,
			method: crosswalk.method,
			quality: crosswalk.quality,
			...(crosswalk.relationshipPurpose
				? { relationshipPurpose: crosswalk.relationshipPurpose }
				: {}),
			weighting: crosswalk.weighting,
			recordCount: crosswalk.records.length,
			mapping: summarisePublishedRelationshipMapping(
				crosswalk,
				direction,
				limit,
			),
		}));
	return {
		geography,
		from,
		to,
		summary: {
			fromAreaCount: fromAreas.size,
			toAreaCount: toAreas.size,
			sharedCodeCount: sharedCodes.length,
			codesOnlyInFromCount: onlyInFrom.length,
			codesOnlyInToCount: onlyInTo.length,
			continuousCodeCount: continuousCodes.size,
			recodedCodeCount: recoded.size,
			changedExtentCount: changed.filter(
				({ relation }) => relation === "changed",
			).length,
			indeterminateExtentCount: changed.filter(
				({ relation }) => relation === "indeterminate",
			).length,
			unmeasuredCodeCount: unmeasured.size,
			unassessedSharedCodeCount: unassessedSharedCodes.length,
			publishedRelationshipCount: publishedRelationships.length,
		},
		codes: {
			onlyInFrom: onlyInFrom.slice(0, limit),
			onlyInTo: onlyInTo.slice(0, limit),
		},
		continuity:
			continuityArtifacts.length > 0
				? {
						status: "available",
						crosswalks: continuityArtifacts.map(
							({ crosswalk }) => crosswalk.id,
						),
						recoded: [...recoded.values()]
							.sort((left, right) =>
								left.fromCode.localeCompare(right.fromCode),
							)
							.slice(0, limit),
						changedExtent: changed.slice(0, limit),
						unmeasured: [...unmeasured]
							.map(([code, reason]) => ({ code, reason }))
							.sort((left, right) =>
								left.code.localeCompare(right.code),
							)
							.slice(0, limit),
						unassessedSharedCodes: unassessedSharedCodes.slice(
							0,
							limit,
						),
					}
				: {
						status: "not-published",
						reason: "No extent continuity crosswalk has compared these releases' shared identifiers.",
					},
		publishedRelationships,
	};
};

// src/resolver/locations.ts
var memberAreaKey = (geography, code) => `${geography}/${code}`;
var LocationsResolver = class {
	constructor(inputs, catalogue) {
		this.inputs = inputs;
		this.catalogue = catalogue;
		for (const location of inputs.namedLocationInventory?.locations ?? [])
			for (const code of location.memberCodes) {
				const key = memberAreaKey(location.memberGeography, code);
				const locations = this.locationsByMemberArea.get(key) ?? [];
				locations.push(location);
				this.locationsByMemberArea.set(key, locations);
			}
		for (const locations of this.locationsByMemberArea.values())
			locations.sort((left, right) => left.id.localeCompare(right.id));
	}
	inputs;
	catalogue;
	locationsByMemberArea = /* @__PURE__ */ new Map();
	namedLocation(id, asOf) {
		const location = this.inputs.namedLocationLookup?.get(id);
		return location && selectNamedLocationAt(location, asOf);
	}
	namedLocations(asOf) {
		return (this.inputs.namedLocationInventory?.locations ?? []).map(
			(location) => selectNamedLocationAt(location, asOf),
		);
	}
	hasNamedLocationInventory() {
		return this.inputs.namedLocationInventory !== void 0;
	}
	namedLocationsForArea(identity, asOf) {
		return (
			this.locationsByMemberArea.get(
				memberAreaKey(identity.geography, identity.code),
			) ?? []
		).filter((location) =>
			membersAt(location, asOf).includes(identity.code),
		);
	}
	locationProjection(locationId, geography, boundaryRelease, crosswalkId) {
		return this.inputs.locationProjectionStore?.get(
			locationId,
			geography,
			boundaryRelease,
			crosswalkId,
		);
	}
	locationProjectionCacheStats() {
		return this.inputs.locationProjectionStore?.stats();
	}
	hasLocationProjectionStore() {
		return this.inputs.locationProjectionStore !== void 0;
	}
	locationMemberProjectionShards(memberGeography) {
		return (
			this.inputs.locationProjectionStore?.memberProjectionShards() ?? []
		).flatMap((shard) => {
			const summary = this.catalogue.crosswalkSummary(shard.crosswalkId);
			return summary?.to.geography === memberGeography
				? [{ shard, summary }]
				: [];
		});
	}
	locationParentProjectionShards(memberGeography) {
		return (
			this.inputs.locationProjectionStore?.parentProjectionShards() ?? []
		).flatMap((shard) => {
			const summary = this.catalogue.crosswalkSummary(shard.crosswalkId);
			return summary?.from.geography === memberGeography
				? [{ shard, summary }]
				: [];
		});
	}
	locationParentCrosswalks(geography, boundaryRelease) {
		return (
			this.inputs.locationProjectionStore?.parentCrosswalks(
				geography,
				boundaryRelease,
			) ?? []
		);
	}
	locationParents(locationId, crosswalkId) {
		return this.inputs.locationProjectionStore?.parents(
			locationId,
			crosswalkId,
		);
	}
	locationReleaseViews(memberGeography, memberCodes) {
		if (!this.inputs.areaLookup) return [];
		return [...this.inputs.areaLookup]
			.flatMap(([identity, areas]) => {
				const [geography, boundaryRelease] = identity.split("/", 2);
				if (geography !== memberGeography || !boundaryRelease)
					return [];
				return [
					{
						geography,
						boundaryRelease,
						resolvedMemberCount: memberCodes.filter((code) =>
							areas.has(code),
						).length,
					},
				];
			})
			.sort((left, right) =>
				left.boundaryRelease.localeCompare(right.boundaryRelease),
			);
	}
	reconcileMembers(geography, boundaryRelease, memberCodes, resolvedCodes) {
		return this.inputs.areaLookup
			? reconcileMembers(
					this.inputs.areaLookup,
					geography,
					boundaryRelease,
					memberCodes,
					resolvedCodes,
				)
			: void 0;
	}
	reconcileMembersForYear(
		geography,
		boundaryYear,
		memberCodes,
		resolvedCodes,
	) {
		return this.inputs.areaLookup
			? reconcileMembersForYear(
					this.inputs.areaLookup,
					geography,
					boundaryYear,
					memberCodes,
					resolvedCodes,
				)
			: void 0;
	}
	crosswalksToLocationMembers(geography, boundaryRelease, memberGeography) {
		return this.catalogue
			.crosswalkSummaries()
			.filter(
				(crosswalk) =>
					crosswalk.from.geography === geography &&
					crosswalk.from.boundaryRelease === boundaryRelease &&
					crosswalk.to.geography === memberGeography,
			)
			.sort((left, right) => left.id.localeCompare(right.id));
	}
};

// src/areaContainment.ts
var EPSILON = 1e-12;
var isCoordinate = (value) =>
	Array.isArray(value) &&
	value.length >= 2 &&
	typeof value[0] === "number" &&
	Number.isFinite(value[0]) &&
	typeof value[1] === "number" &&
	Number.isFinite(value[1]);
var coordinatesOf = (value) => {
	if (isCoordinate(value)) return [[value[0], value[1]]];
	return Array.isArray(value) ? value.flatMap(coordinatesOf) : [];
};
var geometryBounds = (geometry) => {
	const coordinates =
		geometry.type === "GeometryCollection"
			? (geometry.geometries ?? []).flatMap((part) => {
					const bounds = geometryBounds(part);
					return bounds ? [bounds] : [];
				})
			: coordinatesOf(geometry.coordinates).map(
					([longitude, latitude]) => [
						longitude,
						latitude,
						longitude,
						latitude,
					],
				);
	if (coordinates.length === 0) return void 0;
	return coordinates.reduce(
		(bounds, [minLongitude, minLatitude, maxLongitude, maxLatitude]) => [
			Math.min(bounds[0], minLongitude),
			Math.min(bounds[1], minLatitude),
			Math.max(bounds[2], maxLongitude),
			Math.max(bounds[3], maxLatitude),
		],
		[Infinity, Infinity, -Infinity, -Infinity],
	);
};
var pointInBounds = (point, bounds) =>
	point[0] >= bounds[0] - EPSILON &&
	point[0] <= bounds[2] + EPSILON &&
	point[1] >= bounds[1] - EPSILON &&
	point[1] <= bounds[3] + EPSILON;
var pointOnSegment = (point, start, end) => {
	const [longitude, latitude] = point;
	const [startLongitude, startLatitude] = start;
	const [endLongitude, endLatitude] = end;
	const cross =
		(longitude - startLongitude) * (endLatitude - startLatitude) -
		(latitude - startLatitude) * (endLongitude - startLongitude);
	if (Math.abs(cross) > EPSILON) return false;
	return (
		longitude >= Math.min(startLongitude, endLongitude) - EPSILON &&
		longitude <= Math.max(startLongitude, endLongitude) + EPSILON &&
		latitude >= Math.min(startLatitude, endLatitude) - EPSILON &&
		latitude <= Math.max(startLatitude, endLatitude) + EPSILON
	);
};
var preparedGeometries = /* @__PURE__ */ new Map();
var MAX_PREPARED_GEOMETRIES = 96;
var RING_LATITUDE_BUCKET_DEGREES = 0.025;
var prepareRing = (value, bucketDegrees) => {
	if (!Array.isArray(value)) return void 0;
	const coordinates = value.filter(isCoordinate);
	if (coordinates.length < 3) return void 0;
	let west = Infinity;
	let south = Infinity;
	let east = -Infinity;
	let north = -Infinity;
	for (const [longitude, latitude] of coordinates) {
		west = Math.min(west, longitude);
		south = Math.min(south, latitude);
		east = Math.max(east, longitude);
		north = Math.max(north, latitude);
	}
	const latitudeBuckets = /* @__PURE__ */ new Map();
	for (
		let index = 0, previous = coordinates.length - 1;
		index < coordinates.length;
		previous = index++
	) {
		const minBucket = Math.floor(
			Math.min(coordinates[previous][1], coordinates[index][1]) /
				bucketDegrees,
		);
		const maxBucket = Math.floor(
			Math.max(coordinates[previous][1], coordinates[index][1]) /
				bucketDegrees,
		);
		for (let bucket = minBucket; bucket <= maxBucket; bucket++) {
			const indices = latitudeBuckets.get(bucket) ?? [];
			indices.push(index);
			latitudeBuckets.set(bucket, indices);
		}
	}
	return {
		coordinates,
		bounds: [west, south, east, north],
		latitudeBuckets,
		bucketDegrees,
	};
};
var preparePolygon = (value, bucketDegrees) => {
	if (!Array.isArray(value)) return void 0;
	const rings = value.flatMap((ring) => {
		const prepared = prepareRing(ring, bucketDegrees);
		return prepared ? [prepared] : [];
	});
	return rings.length ? { rings } : void 0;
};
var prepareUncached = (
	geometry,
	bucketDegrees = RING_LATITUDE_BUCKET_DEGREES,
) => {
	if (geometry.type === "Polygon") {
		const polygon = preparePolygon(geometry.coordinates, bucketDegrees);
		return { type: "Polygon", polygons: polygon ? [polygon] : [] };
	}
	if (geometry.type === "MultiPolygon") {
		const polygons = Array.isArray(geometry.coordinates)
			? geometry.coordinates.flatMap((polygon) => {
					const result = preparePolygon(polygon, bucketDegrees);
					return result ? [result] : [];
				})
			: [];
		return { type: "MultiPolygon", polygons };
	}
	if (geometry.type === "GeometryCollection")
		return {
			type: "GeometryCollection",
			geometries: (geometry.geometries ?? []).map((part) =>
				prepareUncached(part, bucketDegrees),
			),
		};
	return { type: "Other" };
};
var prepareGeometry = (geometry) => {
	const cached = preparedGeometries.get(geometry);
	if (cached) {
		preparedGeometries.delete(geometry);
		preparedGeometries.set(geometry, cached);
		return cached;
	}
	const prepared = prepareUncached(geometry);
	preparedGeometries.set(geometry, prepared);
	if (preparedGeometries.size > MAX_PREPARED_GEOMETRIES)
		preparedGeometries.delete(preparedGeometries.keys().next().value);
	return prepared;
};
var pointInRing = (point, ring) => {
	if (!pointInBounds(point, ring.bounds)) return "outside";
	const coordinates = ring.coordinates;
	const candidates =
		ring.latitudeBuckets.get(Math.floor(point[1] / ring.bucketDegrees)) ??
		[];
	let inside = false;
	for (const index of candidates) {
		const previous = index === 0 ? coordinates.length - 1 : index - 1;
		const start = coordinates[previous];
		const end = coordinates[index];
		if (pointOnSegment(point, start, end)) return "boundary";
		const crossesLatitude = start[1] > point[1] !== end[1] > point[1];
		if (
			crossesLatitude &&
			point[0] <
				((end[0] - start[0]) * (point[1] - start[1])) /
					(end[1] - start[1]) +
					start[0]
		) {
			inside = !inside;
		}
	}
	return inside ? "interior" : "outside";
};
var pointInPolygon = (point, polygon) => {
	const [outerRing, ...holes] = polygon.rings;
	if (!outerRing) return "outside";
	const outer = pointInRing(point, outerRing);
	if (outer === "outside") return "outside";
	for (const hole of holes) {
		const containment = pointInRing(point, hole);
		if (containment === "boundary") return "boundary";
		if (containment === "interior") return "outside";
	}
	return outer;
};
var strongest = (left, right) =>
	left === "interior" || right === "interior"
		? "interior"
		: left === "boundary" || right === "boundary"
			? "boundary"
			: "outside";
var containPreparedPoint = (point, prepared) => {
	if (prepared.type === "Polygon" || prepared.type === "MultiPolygon") {
		return prepared.polygons.reduce(
			(status, polygon) =>
				strongest(status, pointInPolygon(point, polygon)),
			"outside",
		);
	}
	if (prepared.type === "GeometryCollection") {
		return prepared.geometries.reduce(
			(status, part) =>
				strongest(status, containPreparedPoint(point, part)),
			"outside",
		);
	}
	return "outside";
};
var containPoint = (point, geometry) =>
	containPreparedPoint(point, prepareGeometry(geometry));
var boundsIntersect = (left, right) =>
	left[0] <= right[2] + EPSILON &&
	right[0] <= left[2] + EPSILON &&
	left[1] <= right[3] + EPSILON &&
	right[1] <= left[3] + EPSILON;
var boundsWithin = (inner, outer) =>
	inner[0] >= outer[0] - EPSILON &&
	inner[1] >= outer[1] - EPSILON &&
	inner[2] <= outer[2] + EPSILON &&
	inner[3] <= outer[3] + EPSILON;
var segmentMeetsBounds = (
	[startLongitude, startLatitude],
	[endLongitude, endLatitude],
	bounds,
) => {
	const deltaLongitude = endLongitude - startLongitude;
	const deltaLatitude = endLatitude - startLatitude;
	let enter = 0;
	let leave = 1;
	const clip = (edge, distance) => {
		if (edge === 0) return distance >= -EPSILON;
		const crossing = distance / edge;
		if (edge < 0) {
			if (crossing > leave) return false;
			if (crossing > enter) enter = crossing;
		} else {
			if (crossing < enter) return false;
			if (crossing < leave) leave = crossing;
		}
		return true;
	};
	return (
		clip(-deltaLongitude, startLongitude - bounds[0]) &&
		clip(deltaLongitude, bounds[2] - startLongitude) &&
		clip(-deltaLatitude, startLatitude - bounds[1]) &&
		clip(deltaLatitude, bounds[3] - startLatitude)
	);
};
var ringsOf = (geometry) => {
	if (geometry.type === "GeometryCollection")
		return (geometry.geometries ?? []).flatMap(ringsOf);
	const polygons =
		geometry.type === "Polygon"
			? [geometry.coordinates]
			: geometry.type === "MultiPolygon"
				? geometry.coordinates
				: [];
	return (Array.isArray(polygons) ? polygons : []).flatMap((polygon) =>
		(Array.isArray(polygon) ? polygon : []).map((ring) =>
			coordinatesOf(ring),
		),
	);
};
var geometryMeetsBounds = (geometry, bounds) => {
	for (const ring of ringsOf(geometry)) {
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			if (segmentMeetsBounds(ring[j], ring[i], bounds)) return true;
		}
	}
	return containPoint([bounds[0], bounds[1]], geometry) !== "outside";
};

// src/areaDistance.ts
var A = 6378137;
var F = 1 / 298.257223563;
var E2 = F * (2 - F);
var metresPerDegree = (latitude) => {
	const sinLat = Math.sin((latitude * Math.PI) / 180);
	const w = Math.sqrt(1 - E2 * sinLat * sinLat);
	const meridional = (A * (1 - E2)) / (w * w * w);
	const primeVertical = (A / w) * Math.sqrt(1 - sinLat * sinLat);
	return {
		longitude: (primeVertical * Math.PI) / 180,
		latitude: (meridional * Math.PI) / 180,
	};
};
var planar = (origin) => {
	const scale = metresPerDegree(origin[1]);
	return ([longitude, latitude]) => [
		(longitude - origin[0]) * scale.longitude,
		(latitude - origin[1]) * scale.latitude,
	];
};
var segmentDistance = ([startX, startY], [endX, endY]) => {
	const deltaX = endX - startX;
	const deltaY = endY - startY;
	const lengthSquared = deltaX * deltaX + deltaY * deltaY;
	const along =
		lengthSquared === 0
			? 0
			: Math.max(
					0,
					Math.min(
						1,
						-(startX * deltaX + startY * deltaY) / lengthSquared,
					),
				);
	return Math.hypot(startX + along * deltaX, startY + along * deltaY);
};
var distanceToBoundaryM = (point, geometry) => {
	const toPlane = planar(point);
	let nearest = Infinity;
	for (const ring of ringsOf(geometry)) {
		const projected = ring.map(toPlane);
		for (let i = 0, j = projected.length - 1; i < projected.length; j = i++)
			nearest = Math.min(
				nearest,
				segmentDistance(projected[j], projected[i]),
			);
	}
	return nearest;
};
var distanceToGeometryM = (point, geometry) =>
	containPoint(point, geometry) === "outside"
		? distanceToBoundaryM(point, geometry)
		: 0;
var distanceToBoundsM = (point, bounds) => {
	const scale = metresPerDegree(point[1]);
	return Math.hypot(
		Math.max(bounds[0] - point[0], 0, point[0] - bounds[2]) *
			scale.longitude,
		Math.max(bounds[1] - point[1], 0, point[1] - bounds[3]) *
			scale.latitude,
	);
};

// src/resolver/spatial.ts
var SpatialResolver = class {
	constructor(cache, area) {
		this.cache = cache;
		this.area = area;
	}
	cache;
	area;
	hasAreaGeometryCache() {
		return this.cache !== void 0;
	}
	geometryCacheStats() {
		return this.cache?.stats();
	}
	warmGeometryReleases(releases) {
		this.cache?.warm(releases);
	}
	geometryFor(identity) {
		const geometry = this.cache?.get(
			identity.geography,
			identity.boundaryRelease,
			identity.code,
		);
		return geometry && this.cache
			? {
					geometry,
					geometrySource: this.cache.provenance(
						identity.geography,
						identity.boundaryRelease,
						identity.code,
					),
				}
			: void 0;
	}
	areaGeometry(identity) {
		const area = this.area(identity);
		const resolved = this.geometryFor(identity);
		return area && resolved
			? { id: areaId(identity), ...area, ...resolved }
			: void 0;
	}
	areaNeighbours(identity) {
		const cache = this.cache;
		if (!cache) return void 0;
		const neighbours = cache.findNeighbours(
			identity.geography,
			identity.boundaryRelease,
			identity.code,
		);
		const geometry = cache.get(
			identity.geography,
			identity.boundaryRelease,
			identity.code,
		);
		if (!neighbours || !geometry) return void 0;
		return {
			geometry,
			neighbours: neighbours.map((neighbour) => ({
				...neighbour,
				id: areaId({
					geography: identity.geography,
					boundaryRelease: identity.boundaryRelease,
					code: neighbour.code,
				}),
				area: this.area({
					geography: identity.geography,
					boundaryRelease: identity.boundaryRelease,
					code: neighbour.code,
				}),
			})),
		};
	}
	/**
	 * The codes of the areas containing a point, for a caller that needs no
	 * more than which areas those are. `containingAreas` also measures the
	 * point's distance to each boundary, which for a country's coastline is
	 * tens of milliseconds a lookup.
	 */
	containingCodes(geography, boundaryRelease, point) {
		const cache = this.cache;
		if (!cache) return void 0;
		return cache
			.findContaining(geography, boundaryRelease, point)
			.filter(
				({ code }) =>
					this.area({ geography, boundaryRelease, code }) &&
					cache.get(geography, boundaryRelease, code),
			)
			.map(({ code }) => code);
	}
	containingAreas(geography, boundaryRelease, point) {
		const cache = this.cache;
		if (!cache) return void 0;
		return cache
			.findContaining(geography, boundaryRelease, point)
			.flatMap(({ code, containment }) => {
				const area = this.area({ geography, boundaryRelease, code });
				const geometry = cache.get(geography, boundaryRelease, code);
				return area && geometry
					? [
							{
								id: areaId({
									geography,
									boundaryRelease,
									code,
								}),
								...area,
								containment,
								distanceToBoundaryM: distanceToBoundaryM(
									point,
									geometry,
								),
								geometrySource: cache.provenance(
									geography,
									boundaryRelease,
									code,
								),
							},
						]
					: [];
			});
	}
	/**
	 * Areas already found to contain a point, as `containingAreas` describes
	 * them. Undefined without a geometry cache, whose provenance they carry.
	 */
	resolvePlacedAreas(geography, boundaryRelease, placed) {
		const cache = this.cache;
		if (!cache) return void 0;
		return placed.flatMap(
			({
				code,
				containment,
				distanceToBoundaryM: distanceToBoundaryM2,
			}) => {
				const area = this.area({ geography, boundaryRelease, code });
				return area
					? [
							{
								id: areaId({
									geography,
									boundaryRelease,
									code,
								}),
								...area,
								containment,
								distanceToBoundaryM: distanceToBoundaryM2,
								geometrySource: cache.provenance(
									geography,
									boundaryRelease,
									code,
								),
							},
						]
					: [];
			},
		);
	}
	nearestAreas(geography, boundaryRelease, point, { withinM, limit }) {
		const cache = this.cache;
		if (!cache) return void 0;
		const found = cache
			.findNearest(geography, boundaryRelease, point, withinM)
			.flatMap(({ code, distanceM }) => {
				const area = this.area({ geography, boundaryRelease, code });
				return area ? [{ code, area, distanceM }] : [];
			});
		return {
			matched: found.length,
			nearest: found.slice(0, limit).map(({ code, area, distanceM }) => ({
				id: areaId({ geography, boundaryRelease, code }),
				...area,
				distanceM,
				geometrySource: cache.provenance(
					geography,
					boundaryRelease,
					code,
				),
			})),
		};
	}
	releaseGeometrySource(geography, boundaryRelease) {
		return this.cache?.provenance(geography, boundaryRelease);
	}
	intersectingAreas(
		geography,
		boundaryRelease,
		box,
		limit = Infinity,
		includeGeometry = true,
		after2,
	) {
		const cache = this.cache;
		if (!cache) return void 0;
		const found = cache.findIntersecting(geography, boundaryRelease, box);
		const start =
			after2 === void 0
				? 0
				: found.findIndex(({ code }) => code.localeCompare(after2) > 0);
		const page = start === -1 ? [] : found.slice(start, start + limit + 1);
		const matches = page
			.flatMap(({ code, relation, bounds }) => {
				const area = this.area({ geography, boundaryRelease, code });
				return area
					? [
							{
								id: areaId({
									geography,
									boundaryRelease,
									code,
								}),
								...area,
								relation,
								boundingBox: bounds,
								geometrySource: cache.provenance(
									geography,
									boundaryRelease,
									code,
								),
							},
						]
					: [];
			})
			.slice(0, limit);
		return {
			matched: found.length,
			more: page.length > limit,
			matches: includeGeometry
				? matches.flatMap((match) => {
						const geometry = cache.get(
							geography,
							boundaryRelease,
							match.code,
						);
						return geometry
							? [
									{
										...match,
										geometry,
									},
								]
							: [];
					})
				: matches,
		};
	}
};

// src/routeResponse.ts
var problem = (status, title, detail, extensions = {}) => ({
	status,
	body: {
		type: `https://api.ukdataatlas.com/problems/${title.toLowerCase().replaceAll(" ", "-")}`,
		title,
		status,
		detail,
		...extensions,
	},
});

// src/geographyResolver.ts
var GeographyResolver = class {
	constructor(inputs) {
		this.inputs = inputs;
		this.areas = new AreasResolver(inputs);
		this.catalogue = new CatalogueResolver(inputs);
		this.locations = new LocationsResolver(inputs, this.catalogue);
		this.spatial = new SpatialResolver(
			inputs.areaGeometryCache,
			(identity) => this.areas.area(identity),
		);
		this.lineage = new LineageResolver(
			inputs.crosswalkLookup,
			(identity) => this.areas.area(identity),
			(identity) => this.areas.sameCode(identity),
		);
		this.translator = new CrosswalkTranslator(inputs);
		this.capability = new CapabilityResolver(
			inputs,
			this.translator,
			(identity, only) => this.lineage.relationships(identity, only),
			() => this.lineage.hasAreaRelationships(),
			(geography, release) =>
				this.areas.boundaryRelease(geography, release),
			(geography, release) =>
				this.lineage.relatedCodes(geography, release),
		);
	}
	inputs;
	areas;
	catalogue;
	locations;
	spatial;
	lineage;
	translator;
	capability;
	/** Return the shared 503 response when a route's required geography input is absent. */
	requires(requirement) {
		const available = {
			areas: this.areas.hasAreas(),
			places: this.areas.hasPlaceIndex(),
			"area-search": this.areas.hasAreaSearch(),
			postcodes: this.inputs.postcodeIndex !== void 0,
			geometry: this.spatial.hasAreaGeometryCache(),
			relationships: this.lineage.hasAreaRelationships(),
			"named-locations": this.locations.hasNamedLocationInventory(),
			"location-projections": this.locations.hasLocationProjectionStore(),
			crosswalks: this.translator.hasCrosswalks(),
		};
		if (available[requirement]) return void 0;
		const descriptions = {
			areas: "Build the area inventory before serving geography data.",
			places: "Build the place index before resolving place names.",
			"area-search":
				"Build the area search index before searching areas.",
			postcodes: "Build the postcode index before resolving postcodes.",
			geometry:
				"Build the geometry source registry before serving geometry.",
			relationships:
				"Build the crosswalk inventory before serving area relationships.",
			"named-locations":
				"Build the named location inventory before serving locations.",
			"location-projections":
				"Build the location projection inventory before serving location projections.",
			crosswalks:
				"Build the crosswalk artifacts before serving crosswalk data.",
		};
		return problem(503, "Catalogue Unavailable", descriptions[requirement]);
	}
	geographyInventory() {
		return this.inputs.geographyInventory;
	}
	postcodeIndex() {
		return this.inputs.postcodeIndex;
	}
	postcodeCounts(identity) {
		return this.inputs.postcodeCountsIndex?.forArea(
			identity.geography,
			identity.boundaryRelease,
			identity.code,
		);
	}
	postcodeAreaIndex() {
		return this.inputs.postcodeAreaIndex;
	}
	/**
	 * The areas of one release a unit postcode's centroid lies in, from the
	 * compiled postcode area index: the answer `containingAreas` gives for the
	 * centroid, without reading geometry. Undefined when the index does not
	 * hold the release, so the caller places the centroid live.
	 */
	postcodeContainingAreas(postcode, geography, boundaryRelease) {
		const matches = this.inputs.postcodeAreaIndex?.containing(
			postcode,
			geography,
			boundaryRelease,
		);
		if (!matches) return void 0;
		return this.spatial.resolvePlacedAreas(
			geography,
			boundaryRelease,
			matches,
		);
	}
	area(identity) {
		return this.areas.area(identity);
	}
	codeReleases(identity) {
		return this.areas.codeReleases(identity);
	}
	releaseAreas(geography, boundaryRelease) {
		return this.areas.releaseAreas(geography, boundaryRelease);
	}
	locationReleaseViews(memberGeography, memberCodes) {
		return this.locations.locationReleaseViews(
			memberGeography,
			memberCodes,
		);
	}
	reconcileMembers(geography, boundaryRelease, memberCodes, resolvedCodes) {
		return this.locations.reconcileMembers(
			geography,
			boundaryRelease,
			memberCodes,
			resolvedCodes,
		);
	}
	reconcileMembersForYear(
		geography,
		boundaryYear,
		memberCodes,
		resolvedCodes,
	) {
		return this.locations.reconcileMembersForYear(
			geography,
			boundaryYear,
			memberCodes,
			resolvedCodes,
		);
	}
	countryIdentity(code) {
		return this.areas.countryIdentity(code);
	}
	places(query, limit = 10, asOf) {
		return this.areas.places(query, limit, asOf);
	}
	hasAreaRelease(geography, boundaryRelease) {
		return this.areas.hasAreaRelease(geography, boundaryRelease);
	}
	areaCodes(geography, boundaryRelease) {
		return this.areas.areaCodes(geography, boundaryRelease);
	}
	areaReleases() {
		return this.areas.areaReleases();
	}
	boundaryRelease(geography, id) {
		return this.areas.boundaryRelease(geography, id);
	}
	boundaryReleasesFor(geography) {
		return this.areas.boundaryReleasesFor(geography);
	}
	explainAreaAbsence(geography, boundaryRelease, code) {
		return this.areas.explainAreaAbsence(geography, boundaryRelease, code);
	}
	validateAreas(geography, boundaryRelease, values, parents) {
		const validated = this.areas.validateAreas(
			geography,
			boundaryRelease,
			values,
		);
		if (!validated || !parents) return validated;
		const endpoint = { geography, boundaryRelease };
		const resolved = validated.values.map((value, index) =>
			this.resolveParent(value, parents[index] ?? "", endpoint),
		);
		return { values: resolved, summary: summariseBatch(resolved) };
	}
	/**
	 * Ranks compiled releases by values that resolve exactly. The leading result
	 * is a likely interpretation, never an implicit conversion or a join.
	 */
	matchAreaValues(values, parents) {
		const candidates = this.areaReleases()
			.map(({ geography, boundaryRelease }) => {
				const validated = this.validateAreas(
					geography,
					boundaryRelease,
					values,
					parents,
				);
				if (!validated) return void 0;
				const resolved = validated.values.filter(
					(value) =>
						value.status === "valid" || value.status === "matched",
				).length;
				return {
					geography,
					boundaryRelease,
					resolved,
					ambiguous: validated.values.filter(
						(value) => value.status === "ambiguous",
					).length,
					summary: validated.summary,
					values: validated.values,
				};
			})
			.filter(
				(candidate) => candidate !== void 0 && candidate.resolved > 0,
			)
			.sort(
				(left, right) =>
					right.resolved - left.resolved ||
					left.ambiguous - right.ambiguous ||
					right.boundaryRelease.localeCompare(left.boundaryRelease) ||
					left.geography.localeCompare(right.geography),
			);
		const likely = candidates[0];
		const origins = likely
			? likely.values.flatMap((value) => {
					if (value.kind !== "code") return [];
					if ("presentIn" in value)
						return value.presentIn.map(({ boundaryRelease }) => ({
							geography: likely.geography,
							boundaryRelease,
						}));
					if ("heldBy" in value)
						return value.heldBy.flatMap(
							({ geography, boundaryReleases }) =>
								boundaryReleases.map((boundaryRelease) => ({
									geography,
									boundaryRelease,
								})),
						);
					return [];
				})
			: [];
		const recommendations = likely
			? [
					...new Map(
						origins.flatMap((from) =>
							["identity", "membership", "apportion"].flatMap(
								(purpose) =>
									this.translator
										.paths(
											from,
											{
												geography: likely.geography,
												boundaryRelease:
													likely.boundaryRelease,
											},
											purpose,
										)
										.map((path) => [path.id, path]),
							),
						),
					).values(),
				]
			: [];
		const mixedCodeSystems = likely?.values.some(
			(value) =>
				value.kind === "code" &&
				(value.status === "other-geography" || "presentIn" in value),
		);
		const tiedWith = likely
			? candidates
					.slice(1)
					.filter(
						(candidate) =>
							candidate.resolved === likely.resolved &&
							candidate.ambiguous === likely.ambiguous,
					)
					.map(({ geography, boundaryRelease }) => ({
						geography,
						boundaryRelease,
					}))
			: [];
		return {
			likely: likely && {
				geography: likely.geography,
				boundaryRelease: likely.boundaryRelease,
				resolved: likely.resolved,
				summary: likely.summary,
				...(tiedWith.length > 0 ? { tiedWith } : {}),
			},
			candidates: candidates
				.slice(0, 10)
				.map(({ values: _values, ...candidate }) => candidate),
			values: likely?.values ?? [],
			verdict: !likely
				? "unmatched"
				: likely.summary.joinable
					? "joinable"
					: mixedCodeSystems
						? "mixed-code-systems"
						: "incomplete",
			recommendations,
		};
	}
	resolveParent(value, parentValue, endpoint) {
		if (value.kind !== "name" || value.status !== "ambiguous") return value;
		const parent = parentValue.trim();
		if (!parent) return value;
		const parentCode = parent.toUpperCase();
		const parentName = normalisePlaceName(parent);
		const candidates = value.candidates.filter((candidate2) => {
			const relationships = this.relationships(
				{ ...endpoint, code: candidate2.code },
				"within",
			);
			return relationships.some(
				(relationship2) =>
					relationship2.counterpart.code === parentCode ||
					relationship2.counterpart.labels.some(
						(label) => normalisePlaceName(label) === parentName,
					),
			);
		});
		if (candidates.length !== 1) return value;
		const candidate = candidates[0];
		const relationship = this.relationships(
			{ ...endpoint, code: candidate.code },
			"within",
		).find(
			(entry) =>
				entry.counterpart.code === parentCode ||
				entry.counterpart.labels.some(
					(label) => normalisePlaceName(label) === parentName,
				),
		);
		const { candidates: _candidates, ...base } = value;
		return {
			...base,
			kind: "name",
			status: "matched",
			match: candidate.match,
			area: {
				id: candidate.id,
				code: candidate.code,
				name: candidate.name,
			},
			parent: {
				value: parentValue,
				match:
					relationship.counterpart.code === parentCode
						? "code"
						: "name",
				area: {
					id: relationship.counterpart.id,
					code: relationship.counterpart.code,
					name:
						relationship.counterpart.labels[0] ??
						relationship.counterpart.code,
				},
				crosswalk: relationship.crosswalk.id,
			},
		};
	}
	selectReleaseForDate(geography, month2, country) {
		return this.areas.selectReleaseForDate(geography, month2, country);
	}
	searchAreas(query) {
		return this.areas.searchAreas(query);
	}
	exactAreaCandidates(query) {
		return this.areas.exactAreaCandidates(query);
	}
	resolveAreaCandidates(query) {
		return this.areas.resolveAreaCandidates(query);
	}
	geometryCacheStats() {
		return this.spatial.geometryCacheStats();
	}
	locationProjectionCacheStats() {
		return this.locations.locationProjectionCacheStats();
	}
	warmGeometryReleases(releases) {
		this.spatial.warmGeometryReleases(releases);
	}
	geometryFor(identity) {
		return this.spatial.geometryFor(identity);
	}
	areaGeometry(identity) {
		return this.spatial.areaGeometry(identity);
	}
	areaNeighbours(identity) {
		return this.spatial.areaNeighbours(identity);
	}
	containingAreas(geography, boundaryRelease, point) {
		return this.spatial.containingAreas(geography, boundaryRelease, point);
	}
	containingCodes(geography, boundaryRelease, point) {
		return this.spatial.containingCodes(geography, boundaryRelease, point);
	}
	nearestAreas(geography, boundaryRelease, point, options) {
		return this.spatial.nearestAreas(
			geography,
			boundaryRelease,
			point,
			options,
		);
	}
	releaseGeometrySource(geography, boundaryRelease) {
		return this.spatial.releaseGeometrySource(geography, boundaryRelease);
	}
	intersectingAreas(
		geography,
		boundaryRelease,
		box,
		limit,
		includeGeometry,
		after2,
	) {
		return this.spatial.intersectingAreas(
			geography,
			boundaryRelease,
			box,
			limit,
			includeGeometry,
			after2,
		);
	}
	relationships(identity, only) {
		return this.lineage.relationships(identity, only);
	}
	ancestorLineage(identity, maximumDepth) {
		return this.lineage.ancestorLineage(identity, maximumDepth);
	}
	descendantLineage(identity, maximumDepth) {
		return this.lineage.descendantLineage(identity, maximumDepth);
	}
	areaRelationshipSummary(identity) {
		return this.lineage.areaRelationshipSummary(identity);
	}
	areaHistory(identity, maximumDepth = 8) {
		return this.lineage.areaHistory(identity, maximumDepth);
	}
	namedLocation(id, asOf) {
		return this.locations.namedLocation(id, asOf);
	}
	namedLocations(asOf) {
		return this.locations.namedLocations(asOf);
	}
	namedLocationsForArea(identity, asOf) {
		return this.locations.namedLocationsForArea(identity, asOf);
	}
	crosswalk(id) {
		return this.translator.artifact(id);
	}
	crosswalkSummary(id) {
		return this.catalogue.crosswalkSummary(id);
	}
	crosswalkSummaryForArtifact(artifact) {
		return this.catalogue.crosswalkSummaryForArtifact(artifact);
	}
	crosswalkSummaries() {
		return this.catalogue.crosswalkSummaries();
	}
	areaIdentityRelease(geography, boundaryRelease) {
		return this.catalogue.areaIdentityRelease(geography, boundaryRelease);
	}
	areaIdentityReleaseForArtifact(artifact) {
		return this.catalogue.areaIdentityReleaseForArtifact(artifact);
	}
	namedLocationMembershipInventory() {
		return this.catalogue.namedLocationMembershipInventory();
	}
	locationProjection(locationId, geography, boundaryRelease, crosswalkId) {
		return this.locations.locationProjection(
			locationId,
			geography,
			boundaryRelease,
			crosswalkId,
		);
	}
	locationMemberProjectionShards(memberGeography) {
		return this.locations.locationMemberProjectionShards(memberGeography);
	}
	locationParentProjectionShards(memberGeography) {
		return this.locations.locationParentProjectionShards(memberGeography);
	}
	locationParentCrosswalks(geography, boundaryRelease) {
		return this.locations.locationParentCrosswalks(
			geography,
			boundaryRelease,
		);
	}
	locationParents(locationId, crosswalkId) {
		return this.locations.locationParents(locationId, crosswalkId);
	}
	crosswalksToLocationMembers(geography, boundaryRelease, memberGeography) {
		return this.locations.crosswalksToLocationMembers(
			geography,
			boundaryRelease,
			memberGeography,
		);
	}
	relationshipPaths(from, to, purpose) {
		return this.translator.publishedPaths(from, to, purpose);
	}
	relationshipPath(id) {
		return this.translator.path(id);
	}
	publishedRelationshipPaths() {
		return this.translator.allPaths();
	}
	indexedPathSteps(path) {
		return this.translator.indexedSteps(path);
	}
	translateArea(source, to, purpose) {
		return this.translator.translateArea(source, to, purpose);
	}
	sameArea(source, to) {
		return this.translator.sameArea(source, to);
	}
	successorArea(source, to) {
		return this.translator.successorArea(source, to);
	}
	relationshipCapability(from, to, purpose) {
		return this.capability.relationshipCapability(from, to, purpose);
	}
	conversionPlan(from, to, purpose, operation) {
		return this.capability.conversionPlan(from, to, purpose, operation);
	}
	relationshipCapabilitiesFrom(from) {
		return this.capability.relationshipCapabilitiesFrom(from);
	}
	relationshipCoverage(geography, boundaryRelease, relation, limit = 25) {
		return this.capability.relationshipCoverage(
			geography,
			boundaryRelease,
			relation,
			limit,
		);
	}
	geographyHealth() {
		return this.capability.geographyHealth();
	}
	relationshipRepairs() {
		return this.capability.relationshipRepairs();
	}
	compareBoundaryReleases(geography, fromRelease, toRelease, limit = 25) {
		return compareBoundaryReleases2(
			this.inputs,
			geography,
			fromRelease,
			toRelease,
			limit,
		);
	}
};
var createGeographyResolver = (inputs) => new GeographyResolver(inputs);

// src/boundaryLoader.ts
import {
	existsSync as existsSync2,
	readFileSync as readFileSync3,
} from "node:fs";

// src/reprojection.ts
var import_proj4 = __toESM(require_proj4_src(), 1);

// src/packedGeometry.ts
var DEPTH = {
	Point: 0,
	MultiPoint: 1,
	LineString: 1,
	MultiLineString: 2,
	Polygon: 2,
	MultiPolygon: 3,
};
var isPosition = (value) =>
	Array.isArray(value) &&
	value.length > 0 &&
	value.every((item) => typeof item === "number");
var packGeometry = (geometry) => {
	if (geometry.type === "GeometryCollection")
		return {
			kind: "collection",
			geometries: (geometry.geometries ?? []).map(packGeometry),
		};
	const depth = DEPTH[geometry.type];
	if (depth === void 0) return { kind: "raw", geometry };
	const numbers = [];
	const counts = Array.from({ length: depth }, () => []);
	let stride = -1;
	const walk = (value, level) => {
		if (level === depth) {
			if (!isPosition(value)) return false;
			if (stride === -1) stride = value.length;
			if (value.length !== stride) return false;
			for (const number of value) numbers.push(number);
			return true;
		}
		if (!Array.isArray(value)) return false;
		counts[level].push(value.length);
		return value.every((child) => walk(child, level + 1));
	};
	if (!walk(geometry.coordinates, 0) || stride === -1)
		return { kind: "raw", geometry };
	return {
		kind: "packed",
		type: geometry.type,
		stride,
		positions: Float64Array.from(numbers),
		counts: counts.map((level) => Uint32Array.from(level)),
	};
};
var unpackGeometry = (packed) => {
	if (packed.kind === "raw") return packed.geometry;
	if (packed.kind === "collection")
		return {
			type: "GeometryCollection",
			geometries: packed.geometries.map(unpackGeometry),
		};
	const { positions, stride, counts } = packed;
	const cursors = counts.map(() => 0);
	let at = 0;
	const build = (level) => {
		if (level === counts.length) {
			const position = Array.from(positions.subarray(at, at + stride));
			at += stride;
			return position;
		}
		const length = counts[level][cursors[level]];
		cursors[level] += 1;
		const children = new Array(length);
		for (let index = 0; index < length; index += 1)
			children[index] = build(level + 1);
		return children;
	};
	return { type: packed.type, coordinates: build(0) };
};
var packedBounds = (packed) => {
	if (packed.kind === "raw") return geometryBounds(packed.geometry);
	if (packed.kind === "collection") {
		let merged;
		for (const part of packed.geometries) {
			const bounds = packedBounds(part);
			if (!bounds) continue;
			merged = merged
				? [
						Math.min(merged[0], bounds[0]),
						Math.min(merged[1], bounds[1]),
						Math.max(merged[2], bounds[2]),
						Math.max(merged[3], bounds[3]),
					]
				: bounds;
		}
		return merged;
	}
	const { positions, stride } = packed;
	if (positions.length === 0 || stride < 2) return void 0;
	let west = Infinity;
	let south = Infinity;
	let east = -Infinity;
	let north = -Infinity;
	for (let at = 0; at < positions.length; at += stride) {
		const longitude = positions[at];
		const latitude = positions[at + 1];
		if (longitude < west) west = longitude;
		if (longitude > east) east = longitude;
		if (latitude < south) south = latitude;
		if (latitude > north) north = latitude;
	}
	return [west, south, east, north];
};

// src/geometryPositions.ts
var mapCoordinates = (coordinates, move) =>
	Array.isArray(coordinates) && typeof coordinates[0] === "number"
		? move([coordinates[0], coordinates[1]])
		: Array.isArray(coordinates)
			? coordinates.map((child) => mapCoordinates(child, move))
			: coordinates;
var mapGeometryPositions = (geometry, move) =>
	geometry.type === "GeometryCollection"
		? {
				...geometry,
				geometries: (geometry.geometries ?? []).map((child) =>
					mapGeometryPositions(child, move),
				),
			}
		: {
				...geometry,
				coordinates: mapCoordinates(geometry.coordinates, move),
			};

// src/reprojection.ts
var isWgs84 = (crs) =>
	crs === "EPSG:4326" || crs === "CRS84" || crs.endsWith(":CRS84");
var britishNationalGrid = (0, import_proj4.default)(
	"+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs",
	"+proj=longlat +datum=WGS84 +no_defs",
);
var irishGrid = (0, import_proj4.default)(
	"+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=1.000035 +x_0=200000 +y_0=250000 +a=6377340.189 +rf=299.3249646 +towgs84=482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15 +units=m +no_defs",
	"+proj=longlat +datum=WGS84 +no_defs",
);
var round = (value) => Math.round(value * 1e7) / 1e7;
var roundGrid = (value) => Math.round(value * 100) / 100;
var REPROJECTIONS = {
	"EPSG:27700": {
		transformation: {
			name: "OSGB36 to WGS 84 (6)",
			epsg: "EPSG:1314",
			accuracyM: 2,
			areaOfUse: "Great Britain onshore and the Isle of Man.",
		},
		toWgs84: (position) => {
			const [lon, lat] = britishNationalGrid.forward(position);
			return [round(lon), round(lat)];
		},
		fromWgs84: (position) => {
			const [easting, northing] = britishNationalGrid.inverse(position);
			return [roundGrid(easting), roundGrid(northing)];
		},
	},
	"EPSG:29902": {
		transformation: {
			name: "TM65 to WGS 84 (2)",
			epsg: "EPSG:1641",
			accuracyM: 1,
			areaOfUse: "Ireland and Northern Ireland onshore.",
		},
		toWgs84: (position) => {
			const [lon, lat] = irishGrid.forward(position);
			return [round(lon), round(lat)];
		},
		fromWgs84: (position) => {
			const [easting, northing] = irishGrid.inverse(position);
			return [roundGrid(easting), roundGrid(northing)];
		},
	},
};
var canServeAsWgs84 = (crs) => isWgs84(crs) || crs in REPROJECTIONS;
var geometryProvenance = (crs) =>
	isWgs84(crs) || !(crs in REPROJECTIONS)
		? { sourceCrs: crs }
		: { sourceCrs: crs, transformation: REPROJECTIONS[crs].transformation };
var reprojectionFor = (crs, direction) => {
	const reprojection = REPROJECTIONS[crs];
	if (!reprojection)
		throw new Error(
			direction === "toWgs84"
				? `No transformation to WGS84 is available from ${crs}.`
				: `No transformation from WGS84 is available to ${crs}.`,
		);
	return reprojection;
};
var reprojectGeometry = (geometry, crs, direction) =>
	isWgs84(crs)
		? geometry
		: mapGeometryPositions(
				geometry,
				reprojectionFor(crs, direction)[direction],
			);
var toWgs84Geometry = (geometry, crs) =>
	reprojectGeometry(geometry, crs, "toWgs84");
var toWgs84Packed = (packed, crs) => {
	if (isWgs84(crs)) return packed;
	const reprojection = reprojectionFor(crs, "toWgs84");
	const reproject = (value) => {
		if (value.kind === "collection")
			return {
				kind: "collection",
				geometries: value.geometries.map(reproject),
			};
		if (value.kind === "raw" || value.stride < 2)
			return packGeometry(toWgs84Geometry(unpackGeometry(value), crs));
		const { positions, stride } = value;
		const count = positions.length / stride;
		const reprojected = new Float64Array(count * 2);
		for (let at = 0; at < count; at += 1) {
			const [longitude, latitude] = reprojection.toWgs84([
				positions[at * stride],
				positions[at * stride + 1],
			]);
			reprojected[at * 2] = longitude;
			reprojected[at * 2 + 1] = latitude;
		}
		return {
			kind: "packed",
			type: value.type,
			stride: 2,
			positions: reprojected,
			counts: value.counts,
		};
	};
	return reproject(packed);
};
var fromWgs84Geometry = (geometry, crs) =>
	reprojectGeometry(geometry, crs, "fromWgs84");

// src/queryRules.ts
var QUERY_RULES = {
	"GET /map-resources/{geography}/{release}/features": {
		tier: {
			values: ["full", "high", "medium", "low"],
		},
		format: {
			values: ["geoparquet", "geojson"],
			default: "geoparquet",
		},
	},
	"GET /map-resources/{geography}/{release}/join/{measure-id}": {
		format: {
			values: ["json", "parquet"],
			default: "json",
		},
	},
	"GET /boundary-releases:resolve": {
		country: {
			values: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"],
		},
	},
	"GET /boundary-releases:compare": {
		limit: {
			minimum: 1,
			maximum: 100,
			default: 25,
		},
	},
	"POST /boundary-releases/{geography}/{release}:join": {
		format: {
			values: ["json", "geojson"],
			default: "json",
		},
		tier: {
			values: ["full", "high", "medium", "low"],
			default: "medium",
		},
	},
	"GET /terrain/elevation/point": {
		interpolation: {
			values: ["bilinear", "nearest"],
			default: "bilinear",
		},
	},
	"GET /coordinates:convert": {
		crs: {
			values: ["EPSG:4326", "EPSG:27700", "EPSG:29902"],
			default: "EPSG:4326",
		},
		to: {
			values: ["EPSG:4326", "EPSG:27700", "EPSG:29902"],
			default: "EPSG:4326",
		},
		gridrefDigits: {
			minimum: 1,
			maximum: 5,
			default: 5,
		},
	},
	"GET /data/{measure-id}": {
		geography: {
			values: [
				"ward",
				"localAuthority",
				"constituency",
				"lsoa",
				"msoa",
				"dataZone",
				"superOutputArea",
			],
		},
		include: {
			values: ["area"],
		},
		format: {
			values: ["json", "csv", "ndjson"],
			default: "json",
		},
		units: {
			values: ["source", "canonical"],
			default: "source",
		},
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
	"GET /data/{measure-id}/convert": {
		geography: {
			values: [
				"ward",
				"localAuthority",
				"constituency",
				"lsoa",
				"msoa",
				"dataZone",
				"superOutputArea",
			],
		},
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
	"GET /data/{measure-id}/series": {
		geography: {
			values: [
				"ward",
				"localAuthority",
				"constituency",
				"lsoa",
				"msoa",
				"dataZone",
				"superOutputArea",
			],
		},
	},
	"GET /data/{measure-id}/rankings": {
		geography: {
			values: [
				"ward",
				"localAuthority",
				"constituency",
				"lsoa",
				"msoa",
				"dataZone",
				"superOutputArea",
			],
		},
		order: {
			values: ["asc", "desc"],
			default: "desc",
		},
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
	"GET /places": {
		limit: {
			minimum: 1,
			maximum: 500,
			default: 10,
		},
		country: {
			values: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"],
		},
	},
	"GET /postcodes/{postcode}": {
		view: {
			values: ["full", "compact"],
			default: "full",
		},
	},
	"POST /postcodes:batch": {
		view: {
			values: ["full", "compact"],
			default: "full",
		},
	},
	"GET /data/{measure-id}/change": {
		by: {
			values: ["absolute", "relative"],
			default: "absolute",
		},
		order: {
			values: ["asc", "desc"],
			default: "desc",
		},
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
	"GET /data/{measure-id}/compare": {
		geography: {
			values: [
				"ward",
				"localAuthority",
				"constituency",
				"lsoa",
				"msoa",
				"dataZone",
				"superOutputArea",
			],
		},
	},
	"GET /areas": {
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
	"GET /areas:intersects": {
		tier: {
			values: ["full", "high", "medium", "low"],
		},
		limit: {
			minimum: 1,
			maximum: 1e3,
			default: 200,
		},
	},
	"GET /areas:validate": {
		format: {
			values: ["json", "csv"],
			default: "json",
		},
	},
	"GET /areas:contains": {
		crs: {
			values: ["EPSG:4326", "EPSG:27700", "EPSG:29902"],
			default: "EPSG:4326",
		},
	},
	"POST /areas:containsBatch": {
		crs: {
			values: ["EPSG:4326", "EPSG:27700", "EPSG:29902"],
			default: "EPSG:4326",
		},
	},
	"GET /areas:near": {
		crs: {
			values: ["EPSG:4326", "EPSG:27700", "EPSG:29902"],
			default: "EPSG:4326",
		},
		limit: {
			minimum: 1,
			maximum: 10,
			default: 1,
		},
		within: {
			minimum: 1,
			maximum: 5e4,
			default: 1e3,
		},
	},
	"GET /areas/{geography}/{release}/{code}/history": {
		depth: {
			minimum: 1,
			maximum: 20,
			default: 8,
		},
	},
	"GET /areas/{geography}/{release}/{code}/parents": {
		depth: {
			minimum: 1,
			maximum: 20,
		},
	},
	"GET /areas/{geography}/{release}/{code}/children": {
		depth: {
			minimum: 1,
			maximum: 20,
		},
	},
	"GET /areas/{geography}/{release}/{code}/children/geometry": {
		tier: {
			values: ["full", "high", "medium", "low"],
			default: "full",
		},
	},
	"GET /areas/{geography}/{release}/{code}/neighbours": {
		touches: {
			values: ["edge", "any"],
			default: "edge",
		},
	},
	"GET /areas/{geography}/{release}/{code}/geometry": {
		tier: {
			values: ["full", "high", "medium", "low"],
			default: "full",
		},
	},
	"GET /relationships": {
		purpose: {
			values: ["identity", "membership", "apportion"],
			default: "membership",
		},
		operation: {
			values: [
				"identity-join",
				"code-translation",
				"containment-aggregation",
				"membership-join",
				"weighted-allocation",
			],
		},
		relation: {
			values: [
				"within",
				"contains",
				"successor",
				"predecessor",
				"split-from",
				"merged-from",
				"equivalent-to",
				"overlaps",
			],
		},
		limit: {
			minimum: 1,
			maximum: 100,
			default: 25,
		},
	},
	"GET /crosswalks/{crosswalk-id}/records": {
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
	"GET /lookups/{lookup-id}": {
		format: {
			values: ["csv", "ndjson"],
			default: "csv",
		},
	},
	"GET /translations": {
		purpose: {
			values: ["identity", "membership", "apportion"],
			default: "membership",
		},
	},
	"GET /locations": {
		limit: {
			minimum: 1,
			maximum: 500,
			default: 100,
		},
	},
};

// src/pointLookup.ts
var CRS = QUERY_RULES["GET /areas:contains"].crs;

// src/postcodes.ts
var NORTHERN_IRELAND_EXCLUSION =
	"Northern Ireland postcodes are licensed by Land and Property Services for internal business use only, so this API does not serve them.";
var QUALITY = {
	1: {
		description:
			"Within the building of the matched address closest to the postcode mean.",
		accuracyM: 0.5,
	},
	2: {
		description:
			"Within the building of the matched address closest to the postcode mean, placed by visual inspection of Landline maps.",
		accuracyM: 0.5,
	},
	3: { description: "Approximate to within 50 metres.", accuracyM: 50 },
	4: {
		description:
			"The mean of the postcode's matched addresses, not snapped to a building.",
		accuracyM: 0.5,
	},
	5: {
		description:
			"Imputed by ONS by reference to surrounding postcodes' grid references.",
		accuracyM: null,
	},
	6: {
		description: "The mean of the postcode sector, mainly for PO Boxes.",
		accuracyM: null,
	},
	// England and Wales grid references from before November 2000 are to
	// 100 metres, the rest of the UK's to 10: the error is half a cell's
	// diagonal.
	8: {
		description:
			"Terminated before November 2000; the last grid reference ONS knew.",
		accuracyM: null,
	},
	9: { description: "No grid reference is available.", accuracyM: null },
};
var preGridlinkAccuracyM = (country) =>
	Math.round(
		(country === "E" || country === "W" ? 50 : 5) * Math.SQRT2 * 100,
	) / 100;
var COUNTRY_CODES = {
	E: "E92000001",
	W: "W92000004",
	S: "S92000003",
	N: "N92000002",
	L: "L93000001",
	M: "M83000003",
};
var month = (yyyymm) =>
	`${String(yyyymm).slice(0, 4)}-${String(yyyymm).slice(4, 6)}`;
var postcodeIndexMismatch = (artifact) => {
	if (
		artifact.schemaVersion !== 1 ||
		typeof artifact.source?.edition !== "string" ||
		!Array.isArray(artifact.shards) ||
		!Array.isArray(artifact.excluded)
	)
		return "is malformed";
	const { contentHash, ...body } = artifact;
	if (sha256(JSON.stringify(body)) !== contentHash)
		return "does not match its own content hash";
	return void 0;
};
var PostcodeIndex = class {
	constructor(artifact, readShard, capacity = 512) {
		this.artifact = artifact;
		this.readShard = readShard;
		this.capacity = capacity;
		this.districts = artifact.shards.map((shard) => shard.district);
	}
	artifact;
	readShard;
	capacity;
	shards = /* @__PURE__ */ new Map();
	districts;
	/** Shards already checked against the manifest; a re-read need not be. */
	verified = /* @__PURE__ */ new Set();
	shard(district) {
		const cached = this.shards.get(district);
		if (cached) {
			this.shards.delete(district);
			this.shards.set(district, cached);
			return cached;
		}
		const at = findSorted(this.districts, district);
		if (at === -1) return void 0;
		const entry = this.artifact.shards[at];
		const text = this.readShard(entry.path);
		if (!this.verified.has(entry.path)) {
			if (sha256(text) !== entry.contentHash)
				throw new Error(
					`The postcode shard ${entry.path} does not match the postcode index. Run pnpm build:postcode-index.`,
				);
			this.verified.add(entry.path);
		}
		const shard = JSON.parse(text);
		this.shards.set(district, shard);
		if (this.shards.size > this.capacity)
			this.shards.delete(this.shards.keys().next().value);
		return shard;
	}
	/** Where a compact unit postcode sits: its district and position there. */
	position(postcode) {
		const district = postcode.slice(0, -3);
		const shard = this.shard(district);
		if (!shard) return void 0;
		const at = findSorted(shard.postcodes, postcode);
		return at === -1 ? void 0 : { district, at };
	}
	lookup(postcode) {
		const shard = this.shard(postcode.district);
		if (!shard) {
			const excluded = this.artifact.excluded.find(
				(entry) => entry.area === postcode.area,
			);
			if (excluded)
				return { status: "excluded", reason: excluded.reason };
			return postcode.area === "BT"
				? { status: "excluded", reason: NORTHERN_IRELAND_EXCLUSION }
				: { status: "not-found" };
		}
		const at = findSorted(shard.postcodes, postcode.compact);
		if (at === -1) return { status: "not-found" };
		const quality = shard.quality[at];
		const country = shard.country[at];
		const easting = shard.grid[at * 2];
		const northing = shard.grid[at * 2 + 1];
		const terminated = shard.terminated[at];
		return {
			status: "found",
			record: {
				postcode: postcode.display,
				status: terminated ? "terminated" : "live",
				introduced: month(shard.introduced[at]),
				...(terminated ? { terminated: month(terminated) } : {}),
				userType: shard.largeUser[at] === "1" ? "large" : "small",
				country: COUNTRY_CODES[country],
				centroid:
					easting == null || northing == null
						? null
						: {
								crs:
									country === "N"
										? "EPSG:29902"
										: "EPSG:27700",
								easting,
								northing,
								positionalQuality: {
									indicator: Number(quality),
									...QUALITY[quality],
									...(quality === "8"
										? {
												accuracyM:
													preGridlinkAccuracyM(
														country,
													),
											}
										: {}),
								},
							},
			},
		};
	}
};

// src/postcodeRoutes.ts
var VIEW = QUERY_RULES["GET /postcodes/{postcode}"].view;

// src/postcodeAreas.ts
var NONE = -1;
var releaseKey2 = (geography, boundaryRelease) =>
	`${geography}/${boundaryRelease}`;
var postcodeAreasMismatch = (artifact, postcodeIndex, inputs) => {
	if (
		artifact.schemaVersion !== 1 ||
		!Array.isArray(artifact.releases) ||
		!Array.isArray(artifact.shards)
	)
		return "is malformed";
	const { contentHash, ...body } = artifact;
	if (sha256(JSON.stringify(body)) !== contentHash)
		return "does not match its own content hash";
	if (artifact.postcodeIndex !== postcodeIndex.contentHash)
		return "was not compiled from the current postcode index";
	for (const release of artifact.releases) {
		const key = releaseKey2(release.geography, release.boundaryRelease);
		if (
			inputs.areaRelease(release.geography, release.boundaryRelease) !==
			release.areaRelease
		)
			return `was not compiled from the current areas of ${key}`;
		if (
			inputs.geometryInput(release.geography, release.boundaryRelease) !==
			release.geometryInput
		)
			return `was not compiled from the current geometry of ${key}`;
	}
	return void 0;
};
var PostcodeAreaIndex = class {
	constructor(artifact, postcodes, readShard, capacity = 256) {
		this.artifact = artifact;
		this.postcodes = postcodes;
		this.readShard = readShard;
		this.capacity = capacity;
		this.districts = artifact.shards.map((shard) => shard.district);
		this.releases = new Set(
			artifact.releases.map((release) =>
				releaseKey2(release.geography, release.boundaryRelease),
			),
		);
	}
	artifact;
	postcodes;
	readShard;
	capacity;
	shards = /* @__PURE__ */ new Map();
	districts;
	releases;
	verified = /* @__PURE__ */ new Set();
	covers(geography, boundaryRelease) {
		return this.releases.has(releaseKey2(geography, boundaryRelease));
	}
	shard(district) {
		const cached = this.shards.get(district);
		if (cached) {
			this.shards.delete(district);
			this.shards.set(district, cached);
			return cached;
		}
		const at = findSorted(this.districts, district);
		if (at === -1) return void 0;
		const entry = this.artifact.shards[at];
		const text = this.readShard(entry.path);
		if (!this.verified.has(entry.path)) {
			if (sha256(text) !== entry.contentHash)
				throw new Error(
					`The postcode area shard ${entry.path} does not match the postcode area index. Run pnpm build:postcode-areas.`,
				);
			this.verified.add(entry.path);
		}
		const shard = JSON.parse(text);
		this.shards.set(district, shard);
		if (this.shards.size > this.capacity)
			this.shards.delete(this.shards.keys().next().value);
		return shard;
	}
	/**
	 * The areas of one release a unit postcode's centroid lies in, ordered by
	 * code, or undefined when this index does not hold that release or
	 * postcode and the answer must be found live.
	 */
	containing(postcode, geography, boundaryRelease) {
		const key = releaseKey2(geography, boundaryRelease);
		if (!this.releases.has(key)) return void 0;
		const position = this.postcodes.position(postcode);
		if (!position) return void 0;
		const column = this.shard(position.district)?.releases[key];
		if (!column) return void 0;
		const area = column.area[position.at];
		if (area === void 0 || area === NONE) return [];
		if (area >= 0)
			return [
				{
					code: column.codes[area],
					containment: "interior",
					distanceToBoundaryM: column.distanceCm[position.at] / 100,
				},
			];
		return (column.several?.[position.at] ?? []).map(
			([codeAt, containment, distance]) => ({
				code: column.codes[codeAt],
				containment,
				distanceToBoundaryM: distance / 100,
			}),
		);
	}
};

// src/postcodeCounts.ts
var postcodeCountsMismatch = (artifact, postcodeIndex, postcodeAreas) => {
	if (artifact.schemaVersion !== 1 || !Array.isArray(artifact.releases))
		return "is malformed";
	const { contentHash, ...body } = artifact;
	if (sha256(JSON.stringify(body)) !== contentHash)
		return "does not match its own content hash";
	if (artifact.postcodeIndex !== postcodeIndex.contentHash)
		return "was not compiled from the current postcode index";
	if (artifact.postcodeAreas !== postcodeAreas.contentHash)
		return "was not compiled from the current postcode area index";
	return void 0;
};
var PostcodeCountsIndex = class {
	constructor(artifact, edition) {
		this.artifact = artifact;
		this.edition = edition;
		for (const release of artifact.releases)
			this.releases.set(
				releaseKey2(release.geography, release.boundaryRelease),
				new Map(Object.entries(release.areas)),
			);
	}
	artifact;
	edition;
	releases = /* @__PURE__ */ new Map();
	forArea(geography, boundaryRelease, code) {
		const areas = this.releases.get(
			releaseKey2(geography, boundaryRelease),
		);
		if (!areas) return void 0;
		return {
			...(areas.get(code) ?? { live: 0, terminated: 0, largeUser: 0 }),
			edition: this.edition,
		};
	}
};

// src/publicManifest.ts
import { readFileSync as readFileSync2 } from "node:fs";
import { join as join3 } from "node:path";
var publicPath = (apiRoot2, filename) => join3(apiRoot2, "public", filename);
var readPublicManifest = (apiRoot2, filename, listKey, label) => {
	const path = publicPath(apiRoot2, filename);
	const manifest = JSON.parse(readFileSync2(path, "utf8"));
	if (manifest.schemaVersion !== 1 || !Array.isArray(manifest[listKey])) {
		throw new Error(`Invalid ${label} at ${path}`);
	}
	return manifest;
};

// src/boundaryLoader.ts
var readBoundaryRegistry = (apiRoot2) =>
	readPublicManifest(
		apiRoot2,
		"boundary-releases.json",
		"releases",
		"boundary registry",
	);
var readGeographyInventory = (apiRoot2) =>
	readPublicManifest(
		apiRoot2,
		"geography-inventory.json",
		"releases",
		"geography inventory",
	);
var readTerrainCatalogue = (apiRoot2) =>
	readPublicManifest(
		apiRoot2,
		"terrain-catalogue.json",
		"products",
		"terrain catalogue",
	);
var readAreaInventory = (apiRoot2) =>
	readPublicManifest(
		apiRoot2,
		"area-inventory.json",
		"releases",
		"area inventory",
	);
var LazyAreaLookup = class extends Map {
	constructor(apiRoot2, inventory) {
		super();
		this.apiRoot = apiRoot2;
		this.releases = new Map(
			inventory.releases.flatMap((release) => {
				if (release.status !== "available") return [];
				const path = publicPath(apiRoot2, release.artifact);
				if (!existsSync2(path))
					throw new Error(`Missing area release artifact at ${path}`);
				const key = `${release.geography}/${release.id}`;
				super.set(key, /* @__PURE__ */ new Map());
				return [[key, release]];
			}),
		);
	}
	apiRoot;
	loaded = /* @__PURE__ */ new Map();
	releases;
	get(key) {
		const cached = this.loaded.get(key);
		if (cached) {
			this.loaded.delete(key);
			this.loaded.set(key, cached);
			return cached;
		}
		const release = this.releases.get(key);
		if (!release || release.status !== "available") return void 0;
		const path = publicPath(this.apiRoot, release.artifact);
		const artifact = JSON.parse(readFileSync3(path, "utf8"));
		if (
			artifact.schemaVersion !== 1 ||
			artifact.contentHash !== release.contentHash ||
			!Array.isArray(artifact.areas)
		)
			throw new Error(`Invalid area release artifact at ${path}`);
		const areas = new Map(artifact.areas.map((area) => [area.code, area]));
		this.loaded.set(key, areas);
		if (this.loaded.size > 8)
			this.loaded.delete(this.loaded.keys().next().value);
		return areas;
	}
	*entries() {
		for (const key of this.keys()) yield [key, this.get(key)];
	}
	*values() {
		for (const key of this.keys()) yield this.get(key);
	}
	[Symbol.iterator]() {
		return this.entries();
	}
	forEach(callback, thisArg) {
		for (const [key, value] of this)
			callback.call(thisArg, value, key, this);
	}
};
var readAreaLookup = (apiRoot2, inventory = readAreaInventory(apiRoot2)) =>
	new LazyAreaLookup(apiRoot2, inventory);
var readPlaceIndex = (apiRoot2, areaInventory, namedLocations) => {
	const path = publicPath(apiRoot2, "place-index.json");
	const index = JSON.parse(readFileSync3(path, "utf8"));
	const mismatch = placeIndexMismatch(
		index,
		areaInventory.contentHash,
		namedLocations,
	);
	if (mismatch) {
		throw new Error(
			`The place index at ${path} ${mismatch}. Run pnpm build:place-index.`,
		);
	}
	return index;
};
var readPostcodeIndex = (apiRoot2) => {
	const path = publicPath(apiRoot2, "postcode-index.json");
	const artifact = JSON.parse(readFileSync3(path, "utf8"));
	const mismatch = postcodeIndexMismatch(artifact);
	if (mismatch) {
		throw new Error(
			`The postcode index at ${path} ${mismatch}. Run pnpm build:postcode-index.`,
		);
	}
	return new PostcodeIndex(artifact, (shard) =>
		readFileSync3(publicPath(apiRoot2, shard), "utf8"),
	);
};
var readPostcodeAreaIndex = (
	apiRoot2,
	postcodeIndex,
	areaInventory,
	geometrySources,
) => {
	const path = publicPath(apiRoot2, "postcode-areas.json");
	const artifact = JSON.parse(readFileSync3(path, "utf8"));
	const mismatch = postcodeAreasMismatch(artifact, postcodeIndex.artifact, {
		areaRelease: (geography, boundaryRelease) => {
			const release = areaInventory.releases.find(
				(entry) =>
					entry.geography === geography &&
					entry.id === boundaryRelease,
			);
			return release?.status === "available"
				? release.contentHash
				: void 0;
		},
		geometryInput: (geography, boundaryRelease) =>
			geometrySources.get(`${geography}/${boundaryRelease}`)?.inputHash,
	});
	if (mismatch) {
		throw new Error(
			`The postcode area index at ${path} ${mismatch}. Run pnpm build:postcode-areas.`,
		);
	}
	return new PostcodeAreaIndex(artifact, postcodeIndex, (shard) =>
		readFileSync3(publicPath(apiRoot2, shard), "utf8"),
	);
};
var readPostcodeCounts = (apiRoot2, postcodeIndex, postcodeAreas) => {
	const path = publicPath(apiRoot2, "postcode-counts.json");
	const artifact = JSON.parse(readFileSync3(path, "utf8"));
	const mismatch = postcodeCountsMismatch(
		artifact,
		postcodeIndex.artifact,
		postcodeAreas.artifact,
	);
	if (mismatch)
		throw new Error(
			`The postcode counts at ${path} ${mismatch}. Run pnpm build:postcode-counts.`,
		);
	return new PostcodeCountsIndex(
		artifact,
		postcodeIndex.artifact.source.edition,
	);
};
var readAreaSearchIndex = (apiRoot2, areaInventory) => {
	const path = publicPath(apiRoot2, "area-search-index.json");
	const index = JSON.parse(readFileSync3(path, "utf8"));
	const mismatch = areaSearchIndexMismatch(index, areaInventory.contentHash);
	if (mismatch) {
		throw new Error(
			`The area search index at ${path} ${mismatch}. Run pnpm build:area-search-index.`,
		);
	}
	return index;
};

// src/crosswalkLoader.ts
import {
	existsSync as existsSync3,
	readFileSync as readFileSync4,
} from "node:fs";
var readCrosswalkInventory = (apiRoot2) =>
	readPublicManifest(
		apiRoot2,
		"crosswalk-inventory.json",
		"crosswalks",
		"crosswalk inventory",
	);
var LazyCrosswalkLookup = class {
	entries;
	paths = /* @__PURE__ */ new Map();
	loaded = /* @__PURE__ */ new Map();
	constructor(apiRoot2, inventory) {
		this.entries = inventory.crosswalks;
		for (const crosswalk of this.entries) {
			const path = publicPath(apiRoot2, crosswalk.artifact);
			if (!existsSync3(path))
				throw new Error(`Missing crosswalk artifact at ${path}`);
			this.paths.set(crosswalk.id, path);
		}
	}
	get(id) {
		const cached = this.loaded.get(id);
		if (cached) return cached;
		const expected = this.entries.find((crosswalk) => crosswalk.id === id);
		if (!expected) return void 0;
		const path = this.paths.get(id);
		const artifact = JSON.parse(readFileSync4(path, "utf8"));
		if (
			artifact.schemaVersion !== 1 ||
			artifact.contentHash !== expected.contentHash ||
			!Array.isArray(artifact.records)
		) {
			throw new Error(`Invalid crosswalk artifact at ${path}`);
		}
		this.loaded.set(id, artifact);
		return artifact;
	}
	*values() {
		for (const crosswalk of this.entries) yield this.get(crosswalk.id);
	}
	where(predicate) {
		return this.entries
			.filter(predicate)
			.map((crosswalk) => this.get(crosswalk.id));
	}
};
var readCrosswalkLookup = (apiRoot2, inventory) =>
	new LazyCrosswalkLookup(apiRoot2, inventory);
var readRelationshipPathInventory = (apiRoot2, crosswalks) => {
	const path = publicPath(apiRoot2, "relationship-paths.json");
	const inventory = JSON.parse(readFileSync4(path, "utf8"));
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.paths) ||
		inventory.crosswalkInventoryHash !== crosswalks.contentHash
	) {
		throw new Error(`Invalid relationship path inventory at ${path}`);
	}
	return inventory;
};

// src/locationLoader.ts
import {
	existsSync as existsSync4,
	readFileSync as readFileSync5,
} from "node:fs";

// src/locationProjections.ts
var locationProjectionKey = (
	locationId,
	geography,
	boundaryRelease,
	crosswalkId,
) => [locationId, geography, boundaryRelease, crosswalkId].join("/");
var createLocationProjectionLookup = (artifact) =>
	new Map(
		artifact.projections.map((projection) => [
			locationProjectionKey(
				projection.locationId,
				projection.geography,
				projection.boundaryRelease,
				projection.via.id,
			),
			projection,
		]),
	);
var LocationProjectionStore = class {
	constructor(inventory, load, loadParents, capacity = 8) {
		this.load = load;
		this.loadParents = loadParents;
		this.capacity = capacity;
		for (const shard of inventory.shards)
			this.shards.set(shard.crosswalkId, shard);
		for (const shard of inventory.parentShards ?? [])
			this.parentShards.set(shard.crosswalkId, shard);
	}
	load;
	loadParents;
	capacity;
	shards = /* @__PURE__ */ new Map();
	/** Loaded member lookups by crosswalk, least recently used first. */
	lookups = /* @__PURE__ */ new Map();
	parentShards = /* @__PURE__ */ new Map();
	parentLookups = /* @__PURE__ */ new Map();
	counts = {
		reads: 0,
		loads: 0,
		evictions: 0,
		loadSeconds: 0,
	};
	stats() {
		return {
			maxShards: this.capacity,
			loadedShards: [...this.lookups.keys()],
			...this.counts,
		};
	}
	/** Crosswalks with parent projections into a geography and release. */
	parentCrosswalks(geography, boundaryRelease) {
		return [...this.parentShards.values()].filter(
			(shard) =>
				shard.geography === geography &&
				shard.boundaryRelease === boundaryRelease,
		);
	}
	/** Every materialised member projection shard, without loading its rows. */
	memberProjectionShards() {
		return [...this.shards.values()].sort((left, right) =>
			left.crosswalkId.localeCompare(right.crosswalkId),
		);
	}
	/** Every materialised parent projection shard, without loading its rows. */
	parentProjectionShards() {
		return [...this.parentShards.values()].sort((left, right) =>
			left.crosswalkId.localeCompare(right.crosswalkId),
		);
	}
	parents(locationId, crosswalkId) {
		const shard = this.parentShards.get(crosswalkId);
		if (!shard || !this.loadParents) return void 0;
		let lookup = this.parentLookups.get(crosswalkId);
		if (!lookup) {
			const artifact = this.loadParents(shard);
			if (artifact.contentHash !== shard.contentHash) {
				throw new Error(
					`${crosswalkId}: location parent projection hash mismatch.`,
				);
			}
			lookup = new Map(
				artifact.parentProjections.map((projection) => [
					projection.locationId,
					projection,
				]),
			);
			this.parentLookups.set(crosswalkId, lookup);
		}
		return lookup.get(locationId);
	}
	get(locationId, geography, boundaryRelease, crosswalkId) {
		const shard = this.shards.get(crosswalkId);
		if (
			!shard ||
			shard.geography !== geography ||
			shard.boundaryRelease !== boundaryRelease
		)
			return void 0;
		let lookup = this.lookups.get(crosswalkId);
		if (lookup) {
			this.counts.reads += 1;
			this.lookups.delete(crosswalkId);
			this.lookups.set(crosswalkId, lookup);
		} else {
			const started2 = performance.now();
			const artifact = this.load(shard);
			if (artifact.contentHash !== shard.contentHash) {
				throw new Error(
					`${crosswalkId}: location projection hash mismatch.`,
				);
			}
			lookup = createLocationProjectionLookup(artifact);
			this.lookups.set(crosswalkId, lookup);
			this.counts.loads += 1;
			this.counts.loadSeconds += (performance.now() - started2) / 1e3;
			if (this.lookups.size > this.capacity) {
				this.lookups.delete(this.lookups.keys().next().value);
				this.counts.evictions += 1;
			}
		}
		return lookup.get(
			locationProjectionKey(
				locationId,
				geography,
				boundaryRelease,
				crosswalkId,
			),
		);
	}
};

// src/locationLoader.ts
var readNamedLocationInventory = (apiRoot2) => {
	const packed = publicPath(apiRoot2, "named-locations-metadata.json");
	if (!existsSync4(packed))
		return readPublicManifest(
			apiRoot2,
			"named-locations.json",
			"locations",
			"named location inventory",
		);
	const inventory = readPublicManifest(
		apiRoot2,
		"named-locations-metadata.json",
		"locations",
		"named location metadata",
	);
	return {
		...inventory,
		locations: inventory.locations.map(
			({ geometryArtifact, ...location }) => {
				if (!geometryArtifact) return location;
				if (
					!/^location-geometries\/[a-f0-9]{64}\.json$/.test(
						geometryArtifact,
					)
				)
					throw new Error("Invalid location geometry artifact");
				const path = publicPath(apiRoot2, geometryArtifact);
				if (!existsSync4(path))
					throw new Error(`Missing location geometry at ${path}`);
				const geometry = lazyValue(() => {
					const value = JSON.parse(readFileSync5(path, "utf8"));
					if (
						!value.boundaryRelease ||
						!value.geometry ||
						!Array.isArray(value.bbox)
					)
						throw new Error(`Invalid location geometry at ${path}`);
					return value;
				});
				return {
					...location,
					get geometry() {
						return geometry();
					},
				};
			},
		),
	};
};
var readLocationProjectionInventory = (
	apiRoot2,
	namedLocations,
	crosswalkInventory,
) => {
	const path = publicPath(apiRoot2, "location-projection-inventory.json");
	const inventory = JSON.parse(readFileSync5(path, "utf8"));
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.shards) ||
		inventory.namedLocationInventoryHash !== namedLocations.contentHash ||
		inventory.crosswalkInventoryHash !== crosswalkInventory.contentHash
	) {
		throw new Error(`Invalid location projection inventory at ${path}`);
	}
	return inventory;
};
var createLocationProjectionStore = (
	apiRoot2,
	inventory,
	namedLocations,
	crosswalkInventory,
) =>
	new LocationProjectionStore(
		inventory,
		(shard) => {
			const path = publicPath(apiRoot2, shard.artifact);
			const artifact = JSON.parse(readFileSync5(path, "utf8"));
			if (
				artifact.schemaVersion !== 1 ||
				artifact.contentHash !== shard.contentHash ||
				artifact.crosswalkId !== shard.crosswalkId ||
				artifact.namedLocationInventoryHash !==
					namedLocations.contentHash ||
				artifact.crosswalkInventoryHash !==
					crosswalkInventory.contentHash ||
				!Array.isArray(artifact.projections)
			) {
				throw new Error(`Invalid location projection shard at ${path}`);
			}
			return artifact;
		},
		(shard) => {
			const path = publicPath(apiRoot2, shard.artifact);
			const artifact = JSON.parse(readFileSync5(path, "utf8"));
			if (
				artifact.schemaVersion !== 1 ||
				artifact.contentHash !== shard.contentHash ||
				artifact.crosswalkId !== shard.crosswalkId ||
				artifact.namedLocationInventoryHash !==
					namedLocations.contentHash ||
				artifact.crosswalkInventoryHash !==
					crosswalkInventory.contentHash ||
				!Array.isArray(artifact.parentProjections)
			) {
				throw new Error(
					`Invalid location parent projection shard at ${path}`,
				);
			}
			return artifact;
		},
	);
var createNamedLocations = (inventory) => createNamedLocationLookup(inventory);

// src/catalogueManifestLoader.ts
import { readFileSync as readFileSync6 } from "node:fs";

// src/operationTemplates.ts
var UNMATCHED = "unmatched";
var openapiDocumentHash = (openapiDocument) => sha256(openapiDocument);
var compileSegment = (segment) =>
	new RegExp(
		`^${segment
			.split(/(\{[^}]+\})/)
			.map((part) =>
				/^\{[^}]+\}$/.test(part)
					? "[^/]+"
					: part.replace(/[.*+?^$()|[\]\\]/g, "\\$&"),
			)
			.join("")}$`,
	);
var segmentRank = (segment) =>
	!segment.includes("{") ? 2 : /^\{[^}]+\}$/.test(segment) ? 0 : 1;
var outranks = (left, right) => {
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) return left[index] > right[index];
	}
	return false;
};
var createOperationMatcher = (templates) => {
	const byLength = /* @__PURE__ */ new Map();
	for (const operation of templates) {
		const parts = operation.path.split("/").filter(Boolean);
		const compiled = {
			operation,
			segments: parts.map(compileSegment),
			rank: parts.map(segmentRank),
		};
		byLength.set(parts.length, [
			...(byLength.get(parts.length) ?? []),
			compiled,
		]);
	}
	const find = (segments) => {
		let best;
		for (const candidate of byLength.get(segments.length) ?? []) {
			if (
				candidate.segments.every((pattern, index) =>
					pattern.test(segments[index]),
				) &&
				(!best || outranks(candidate.rank, best.rank))
			)
				best = candidate;
		}
		return best?.operation;
	};
	return (pathname) => {
		const segments = pathname.split("/").filter(Boolean);
		if (segments[0] !== "v1") return { route: UNMATCHED };
		const rest = segments.slice(1);
		const operation = find(rest);
		return operation
			? {
					route:
						operation.path === "/" ? "/v1" : `/v1${operation.path}`,
					operation,
				}
			: { route: UNMATCHED };
	};
};

// src/unitRegistry.ts
var definition = (code, scaleToCanonical = 1, per) => ({
	code,
	scaleToCanonical,
	...(per ? { per } : {}),
});
var countUnits = /* @__PURE__ */ new Set([
	"1x1 km grid cells",
	"applications",
	"chargers",
	"children",
	"claimants aged 16 and over",
	"claimants aged 16 to 24",
	"clients",
	"dwellings",
	"enterprises",
	"households",
	"jobs",
	"offences",
	"people",
	"people in employment",
	"reported collisions",
	"unemployed residents aged 16 and over",
	"usual residents",
	"usual residents aged 16 and over",
	"votes",
]);
var unitDefinitionFor = (unit) => {
	if (countUnits.has(unit)) return definition("1");
	switch (unit) {
		case "percent":
		case "% of premises":
		case "% of economically active residents aged 16 and over":
			return definition(
				"proportion",
				0.01,
				unit === "% of premises"
					? "premises"
					: unit.startsWith("% of ")
						? unit.slice("% of ".length)
						: void 0,
			);
		case "GBP":
		case "\xA3":
			return definition("GBP");
		case "\xA3 thousand":
			return definition("GBP", 1e3);
		case "\xA3 million":
			return definition("GBP", 1e6);
		case "\xA3 per hour":
			return definition("GBP", 1, "hour");
		case "\xA3 per year":
			return definition("GBP", 1, "year");
		case "GWh":
			return definition("GWh");
		case "kt CO2e":
			return definition("t[CO2e]", 1e3);
		case "tonnes":
			return definition("t");
		case "\xB5g/m\xB3":
			return definition("ug/m3");
		case "years":
			return definition("year");
		case "people per square kilometre":
			return definition("person", 1, "km2");
		case "score out of 24":
			return definition("score");
		case "party":
			return definition("category");
		default:
			if (unit.startsWith("rank of ")) return definition("rank");
			if (unit.startsWith("decile, where ")) return definition("decile");
			throw new Error(
				`No canonical unit definition is declared for display unit ${JSON.stringify(unit)}.`,
			);
	}
};
var withUnitDefinitions = (catalog) => ({
	...catalog,
	measures: catalog.measures.map((measure) => ({
		...measure,
		unitDefinition: unitDefinitionFor(measure.unit),
	})),
});

// src/catalogueManifestLoader.ts
var readAtlasRelease = (apiRoot2) =>
	readPublicManifest(
		apiRoot2,
		"atlas-release.json",
		"artifacts",
		"atlas release manifest",
	);
var readOperations = (apiRoot2, openapiDocument) => {
	const artifact = readPublicManifest(
		apiRoot2,
		"operations.json",
		"operations",
		"operations artifact",
	);
	if (
		artifact.inputs?.openapiDocument !==
		openapiDocumentHash(openapiDocument)
	) {
		throw new Error(
			`${publicPath(apiRoot2, "operations.json")} was compiled from another openapi.yaml; run pnpm build:operations.`,
		);
	}
	return artifact;
};
var readValidationReport = (apiRoot2) =>
	readPublicManifest(
		apiRoot2,
		"validation-report.json",
		"resources",
		"validation report",
	);
var readDataCatalog = (apiRoot2) => {
	const path = publicPath(apiRoot2, "data-catalog.json");
	const catalog = JSON.parse(readFileSync6(path, "utf8"));
	if (
		catalog.schemaVersion !== 1 ||
		!Array.isArray(catalog.datasets) ||
		!Array.isArray(catalog.measures)
	) {
		throw new Error(`Invalid data catalogue at ${path}`);
	}
	return withUnitDefinitions(catalog);
};
var readExportManifest = (apiRoot2) =>
	readPublicManifest(
		apiRoot2,
		"export-manifest.json",
		"exports",
		"export manifest",
	);
var readLookupManifest = (apiRoot2) =>
	readPublicManifest(
		apiRoot2,
		"lookup-manifest.json",
		"lookups",
		"lookup manifest",
	);
var readMeasureCompatibility = (apiRoot2) =>
	readPublicManifest(
		apiRoot2,
		"measure-compatibility.json",
		"measures",
		"measure compatibility inventory",
	);
var readAnalysisGeographyInventory = (
	apiRoot2,
	dataCatalog,
	crosswalkInventory,
) => {
	const path = publicPath(apiRoot2, "analysis-geographies.json");
	const inventory = JSON.parse(readFileSync6(path, "utf8"));
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.supports) ||
		inventory.dataCatalogHash !== dataCatalog.contentHash ||
		inventory.crosswalkInventoryHash !== crosswalkInventory.contentHash
	) {
		throw new Error(`Invalid analysis geography inventory at ${path}`);
	}
	return inventory;
};
var readAnalysisGeographyValidationInventory = (
	apiRoot2,
	analysisGeographies,
	dataCatalog,
	crosswalkInventory,
) => {
	const path = publicPath(apiRoot2, "analysis-geography-validation.json");
	const inventory = JSON.parse(readFileSync6(path, "utf8"));
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.supports) ||
		inventory.analysisGeographyInventoryHash !==
			analysisGeographies.contentHash ||
		inventory.dataCatalogHash !== dataCatalog.contentHash ||
		inventory.crosswalkInventoryHash !== crosswalkInventory.contentHash
	) {
		throw new Error(
			`Invalid analysis geography validation inventory at ${path}`,
		);
	}
	return inventory;
};

// src/mapResourceLoader.ts
import {
	existsSync as existsSync5,
	readFileSync as readFileSync7,
} from "node:fs";
import { join as join4 } from "node:path";

// src/mapResource/archiveReader.ts
import { fstatSync, openSync, readSync } from "node:fs";
import { gunzipSync } from "node:zlib";

// src/mapResource/pmtiles.ts
var tileId = (z, x, y) => {
	if (z < 0 || z > 26) throw new Error(`Zoom ${z} is outside PMTiles range.`);
	const size = 2 ** z;
	if (x < 0 || y < 0 || x >= size || y >= size)
		throw new Error(`Tile ${z}/${x}/${y} is outside zoom ${z}.`);
	let accumulated = (4 ** z - 1) / 3;
	let alongX = x;
	let alongY = y;
	let rotation = 0;
	for (let step = size / 2; step > 0; step /= 2) {
		const overX = (alongX & step) > 0 ? 1 : 0;
		const overY = (alongY & step) > 0 ? 1 : 0;
		accumulated += step * step * ((3 * overX) ^ overY);
		if (overY === 0) {
			if (overX === 1) {
				alongX = step - 1 - alongX;
				alongY = step - 1 - alongY;
			}
			rotation = alongX;
			alongX = alongY;
			alongY = rotation;
		}
	}
	return accumulated;
};

// src/mapResource/archiveReader.ts
var readDirectory = (block) => {
	let at = 0;
	const varint2 = () => {
		let value = 0;
		let shift = 1;
		for (;;) {
			const byte = block[at];
			at += 1;
			value += (byte & 127) * shift;
			if ((byte & 128) === 0) return value;
			shift *= 128;
		}
	};
	const count = varint2();
	const entries = Array.from({ length: count }, () => ({
		tileId: 0,
		offset: 0,
		length: 0,
		runLength: 0,
	}));
	let id = 0;
	for (const entry of entries) {
		id += varint2();
		entry.tileId = id;
	}
	for (const entry of entries) entry.runLength = varint2();
	for (const entry of entries) entry.length = varint2();
	for (const [index, entry] of entries.entries()) {
		const value = varint2();
		const previous = entries[index - 1];
		entry.offset =
			value === 0 && previous
				? previous.offset + previous.length
				: value - 1;
	}
	return entries;
};
var covering = (entries, wanted) => {
	let low = 0;
	let high = entries.length - 1;
	let found;
	while (low <= high) {
		const middle = (low + high) >> 1;
		if (entries[middle].tileId <= wanted) {
			found = entries[middle];
			low = middle + 1;
		} else high = middle - 1;
	}
	return found;
};
var openArchive = (path) => {
	const descriptor = openSync(path, "r");
	const bytes = fstatSync(descriptor).size;
	const read = (at, length) => {
		const buffer = Buffer.alloc(length);
		readSync(descriptor, buffer, 0, length, at);
		return buffer;
	};
	const header = read(0, Math.min(127, bytes));
	if (header.subarray(0, 7).toString("ascii") !== "PMTiles")
		throw new Error(`${path} is not a PMTiles archive.`);
	if (header.readUInt8(7) !== 3)
		throw new Error(`${path} is not a version 3 PMTiles archive.`);
	const offset = (at) => Number(header.readBigUInt64LE(at));
	const rootOffset = offset(8);
	const rootLength = offset(16);
	const leafOffset = offset(40);
	const dataOffset = offset(56);
	const minZoom = header.readUInt8(100);
	const maxZoom = header.readUInt8(101);
	const root = readDirectory(gunzipSync(read(rootOffset, rootLength)));
	const leaves = /* @__PURE__ */ new Map();
	const tile = (z, x, y) => {
		if (z < minZoom || z > maxZoom) return void 0;
		let wanted;
		try {
			wanted = tileId(z, x, y);
		} catch {
			return void 0;
		}
		let entries = root;
		for (let depth = 0; depth < 3; depth += 1) {
			const found = covering(entries, wanted);
			if (!found) return void 0;
			if (found.runLength > 0)
				return wanted < found.tileId + found.runLength
					? read(dataOffset + found.offset, found.length)
					: void 0;
			let leaf = leaves.get(found.offset);
			if (!leaf) {
				leaf = readDirectory(
					gunzipSync(read(leafOffset + found.offset, found.length)),
				);
				leaves.set(found.offset, leaf);
			}
			entries = leaf;
		}
		return void 0;
	};
	return { bytes, minZoom, maxZoom, path, tile };
};

// src/mapResourceLoader.ts
var allFeatures = (mapResources) => [
	...mapResources.resources.flatMap((resource) => resource.features ?? []),
	...(mapResources.unavailable ?? []).flatMap(
		(entry) => entry.features ?? [],
	),
];
var readMapResources = (apiRoot2, assetBaseUrl, tileBaseUrl) => {
	const path = join4(apiRoot2, "public", "map-resources.json");
	if (!existsSync5(path)) return { resources: [] };
	const resources = JSON.parse(readFileSync7(path, "utf8"));
	if (!assetBaseUrl) return resources;
	const href = (artifact) =>
		`${assetBaseUrl}/${artifact.split("/").map(encodeURIComponent).join("/")}`;
	return {
		...resources,
		assetBaseUrl,
		tileBaseUrl,
		resources: resources.resources.map((resource) => ({
			...resource,
			tiles: { ...resource.tiles, href: href(resource.tiles.artifact) },
			features: resource.features.map((entry) => ({
				...entry,
				href: href(entry.artifact),
			})),
		})),
		unavailable: resources.unavailable?.map((resource) => ({
			...resource,
			features: resource.features?.map((entry) => ({
				...entry,
				href: href(entry.artifact),
			})),
		})),
	};
};
var readMapAssets = (apiRoot2, mapResources) => ({
	mapArchives: new Map(
		(mapResources.assetBaseUrl ? [] : mapResources.resources).map(
			(resource) => [
				resource.id,
				openArchive(join4(apiRoot2, "public", resource.tiles.artifact)),
			],
		),
	),
	mapFeatures: new Map(
		allFeatures(mapResources).map((entry) => [
			entry.artifact,
			{
				path: join4(apiRoot2, "public", entry.artifact),
				bytes: entry.bytes,
				contentHash: entry.contentHash,
				...(entry.gzipBytes === void 0
					? {}
					: { gzipBytes: entry.gzipBytes }),
			},
		]),
	),
});

// src/geometryLoader.ts
import { resolve } from "node:path";

// src/areaGeometry.ts
import {
	existsSync as existsSync6,
	readFileSync as readFileSync12,
} from "node:fs";
import { join as join7 } from "node:path";

// src/gridOffset.ts
import { readFileSync as readFileSync8 } from "node:fs";
import { join as join5 } from "node:path";

// ../../packages/geography/src/geometrySubstitutions.ts
var GEOMETRY_SUBSTITUTIONS = [
	{
		id: "northern-ireland-constituencies-2016",
		description:
			"Northern Ireland's constituencies are taken from the December 2016 release. In this release their boundaries lie up to about 67 m east of their true position, and the eighteen constituencies were unchanged from 2008 until the 2024 review.",
		geography: "constituency",
		releases: [
			"2017-12-uk-bgc",
			"2018-12-uk-bgc",
			"2019-12-uk-bgc",
			"2020-12-uk-bgc",
			"2021-12-uk-bgc",
			"2022-12-uk-bgc",
		],
		codePrefix: "N",
		donor: { geography: "constituency", boundaryRelease: "2016-12-uk-bgc" },
	},
];
var REVERSED_GRID_OFFSETS = [
	{
		id: "northern-ireland-offset-reversed",
		description:
			"Northern Ireland's travel to work areas are published about 60 m east of their true position, the northern-ireland-offset correction applied backwards. Its exact inverse, applied in the British National Grid, brings 63% of their vertices within 10 m of the May 2023 local authorities, against 5% as published.",
		offset: "northern-ireland-offset",
		geography: "travelToWorkArea",
		boundaryRelease: "2011-12-uk-gcb",
		codePrefix: "N",
	},
];

// ../../packages/geography/src/gridOffset.ts
var offsetPosition = (offset, [easting, northing, ...rest]) => {
	const x = (easting - offset.origin.easting) / offset.unitMetres;
	const y = (northing - offset.origin.northing) / offset.unitMetres;
	const [e0, e1, e2] = offset.east;
	const [n0, n1, n2] = offset.north;
	return [
		easting + e0 + e1 * x + e2 * y,
		northing + n0 + n1 * x + n2 * y,
		...rest,
	];
};
var reverseOffsetPosition = (offset, [easting, northing, ...rest]) => {
	const unit = offset.unitMetres;
	const [e0, e1, e2] = offset.east;
	const [n0, n1, n2] = offset.north;
	const p = easting - offset.origin.easting - e0;
	const q = northing - offset.origin.northing - n0;
	const a = unit + e1;
	const d = unit + n2;
	const determinant = a * d - e2 * n1;
	const x = (p * d - e2 * q) / determinant;
	const y = (a * q - n1 * p) / determinant;
	return [
		offset.origin.easting + unit * x,
		offset.origin.northing + unit * y,
		...rest,
	];
};

// src/gridOffset.ts
var isTriple = (value) =>
	Array.isArray(value) &&
	value.length === 3 &&
	value.every((item) => typeof item === "number" && Number.isFinite(item));
var readGridOffset = (repositoryRoot, id) => {
	const path = join5(repositoryRoot, "data", "boundaries", `${id}.json`);
	const record = JSON.parse(readFileSync8(path, "utf8"));
	const origin = record.origin ?? {};
	if (
		record.id !== id ||
		typeof record.description !== "string" ||
		record.crs !== "EPSG:27700" ||
		typeof record.codePrefix !== "string" ||
		record.codePrefix.length === 0 ||
		typeof origin.easting !== "number" ||
		typeof origin.northing !== "number" ||
		typeof record.unitMetres !== "number" ||
		record.unitMetres <= 0 ||
		!isTriple(record.east) ||
		!isTriple(record.north)
	) {
		throw new Error(`${path}: not a valid grid offset definition`);
	}
	return {
		id,
		description: record.description,
		crs: record.crs,
		codePrefix: record.codePrefix,
		origin: { easting: origin.easting, northing: origin.northing },
		unitMetres: record.unitMetres,
		east: record.east,
		north: record.north,
	};
};
var appliesTo = (offset, code) => code.startsWith(offset.codePrefix);
var offsetPosition2 = (offset, [easting, northing]) =>
	offsetPosition(offset, [easting, northing]);
var offsetGeometry = (offset, geometry) =>
	mapGeometryPositions(geometry, (position) =>
		offsetPosition2(offset, position),
	);
var reverseOffsetGeometry = (offset, geometry) =>
	mapGeometryPositions(geometry, (position) =>
		reverseOffsetPosition(offset, position),
	);

// src/shapefile.ts
import { readFileSync as readFileSync10 } from "node:fs";

// src/dbf.ts
import { readFileSync as readFileSync9 } from "node:fs";
var readFields = (buffer, headerLength) => {
	if (headerLength < 33 || headerLength > buffer.length) {
		throw new Error("Invalid dBase header length");
	}
	if (buffer[headerLength - 1] !== 13) {
		throw new Error("The dBase field descriptors are not terminated");
	}
	const fields = [];
	for (let offset = 32; offset < headerLength - 1; offset += 32) {
		const name = buffer
			.subarray(offset, offset + 11)
			.toString("latin1")
			.replace(/\0.*$/, "")
			.trim();
		const length = buffer[offset + 16];
		if (!name || length === 0) {
			throw new Error("Invalid dBase field descriptor");
		}
		fields.push({ name, length });
	}
	return fields;
};
var readDbfRows = (path) => {
	const buffer = readFileSync9(path);
	if (buffer.length < 33) throw new Error(`${path}: file is too short`);
	const recordCount = buffer.readUInt32LE(4);
	const headerLength = buffer.readUInt16LE(8);
	const recordLength = buffer.readUInt16LE(10);
	const fields = readFields(buffer, headerLength);
	const fieldLength = fields.reduce(
		(total, field) => total + field.length,
		0,
	);
	if (recordLength !== fieldLength + 1) {
		throw new Error(
			`${path}: record length does not match field definitions`,
		);
	}
	if (headerLength + recordCount * recordLength > buffer.length) {
		throw new Error(`${path}: file ends before its declared records`);
	}
	return Array.from({ length: recordCount }, (_, index) => {
		const offset = headerLength + index * recordLength;
		if (buffer[offset] === 42) return void 0;
		let fieldOffset = offset + 1;
		const record = Object.fromEntries(
			fields.map((field) => {
				const value = buffer
					.subarray(fieldOffset, fieldOffset + field.length)
					.toString("latin1")
					.trim();
				fieldOffset += field.length;
				return [field.name, value];
			}),
		);
		return record;
	});
};

// src/shapefile.ts
var NULL_SHAPE = 0;
var POLYGON_SHAPES = /* @__PURE__ */ new Set([5, 15, 25]);
var signedArea = (ring) => {
	let total = 0;
	for (let index = 0; index < ring.length - 1; index += 1) {
		const [x1, y1] = ring[index];
		const [x2, y2] = ring[index + 1];
		total += x1 * y2 - x2 * y1;
	}
	return total;
};
var ringContains = (ring, [x, y]) => {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
			inside = !inside;
	}
	return inside;
};
var toPolygon = (rings) => {
	const outers = [];
	const holes = [];
	for (const ring of rings) {
		if (signedArea(ring) <= 0) outers.push([[...ring].reverse()]);
		else holes.push([...ring].reverse());
	}
	for (const hole of holes) {
		const owner =
			outers.find((polygon) => ringContains(polygon[0], hole[0])) ??
			outers[0];
		if (!owner) throw new Error("A shape has holes but no outer ring.");
		owner.push(hole);
	}
	return outers.length === 1
		? { type: "Polygon", coordinates: outers[0] }
		: { type: "MultiPolygon", coordinates: outers };
};
var readShapefileFeatures = (shpPath) => {
	const buffer = readFileSync10(shpPath);
	if (buffer.length < 100 || buffer.readInt32BE(0) !== 9994) {
		throw new Error(`${shpPath}: not a Shapefile`);
	}
	if (buffer.readInt32BE(24) * 2 !== buffer.length) {
		throw new Error(`${shpPath}: file length does not match its header`);
	}
	const rows = readDbfRows(shpPath.replace(/\.shp$/i, ".dbf"));
	const features = [];
	let offset = 100;
	let index = 0;
	while (offset < buffer.length) {
		const contentLength = buffer.readInt32BE(offset + 4) * 2;
		const content = offset + 8;
		const shapeType = buffer.readInt32LE(content);
		const properties = rows[index];
		if (shapeType !== NULL_SHAPE && properties) {
			if (!POLYGON_SHAPES.has(shapeType)) {
				throw new Error(
					`${shpPath}: shape type ${shapeType} is not a polygon`,
				);
			}
			const partCount = buffer.readInt32LE(content + 36);
			const pointCount = buffer.readInt32LE(content + 40);
			const parts = Array.from({ length: partCount }, (_, part) =>
				buffer.readInt32LE(content + 44 + part * 4),
			);
			const points = content + 44 + partCount * 4;
			const rings = parts.map((start, part) => {
				const end = parts[part + 1] ?? pointCount;
				return Array.from({ length: end - start }, (_, point) => [
					buffer.readDoubleLE(points + (start + point) * 16),
					buffer.readDoubleLE(points + (start + point) * 16 + 8),
				]);
			});
			features.push({ properties, geometry: toPolygon(rings) });
		}
		offset = content + contentLength;
		index += 1;
	}
	if (index !== rows.length) {
		throw new Error(
			`${shpPath}: ${index} shapes but ${rows.length} attribute records`,
		);
	}
	return features;
};

// src/geometrySubstitution.ts
import { readFileSync as readFileSync11 } from "node:fs";
import { join as join6 } from "node:path";
var geometrySubstitution = (id) => {
	const substitution = GEOMETRY_SUBSTITUTIONS.find(
		(candidate) => candidate.id === id,
	);
	if (!substitution)
		throw new Error(`No geometry substitution is defined as ${id}.`);
	return substitution;
};
var loadSubstitutions = (
	repositoryRoot,
	sources,
	identity,
	ids,
	targetCodes,
) => {
	const codes = [...targetCodes];
	return ids.map((id) => {
		const substitution = geometrySubstitution(id);
		const donorIdentity = releaseKey(
			substitution.donor.geography,
			substitution.donor.boundaryRelease,
		);
		const donor = sources.get(donorIdentity);
		if (!donor)
			throw new Error(
				`${identity}: ${id} takes areas from ${donorIdentity}, which has no geometry source.`,
			);
		if (donor.input.toLowerCase().endsWith(".shp"))
			throw new Error(
				`${identity}: ${id} takes areas from a Shapefile, which is not supported.`,
			);
		const content = readFileSync11(
			join6(repositoryRoot, "data", donor.input),
		);
		const collection = JSON.parse(content.toString("utf8"));
		if (
			collection.type !== "FeatureCollection" ||
			!Array.isArray(collection.features)
		)
			throw new Error(`${donorIdentity} is not a FeatureCollection.`);
		const offsets2 = (donor.corrections ?? []).map((correction) =>
			readGridOffset(repositoryRoot, correction),
		);
		const geometries = /* @__PURE__ */ new Map();
		for (const feature of collection.features) {
			const props = feature.properties;
			const code = props?.[donor.codeProperty];
			if (
				typeof code !== "string" ||
				!code.startsWith(substitution.codePrefix) ||
				typeof feature.geometry !== "object" ||
				feature.geometry === null
			)
				continue;
			if (geometries.has(code))
				throw new Error(
					`${donorIdentity}: ${id} expects one feature per code, but ${code} repeats.`,
				);
			const corrected = offsets2
				.filter((offset) => appliesTo(offset, code))
				.reduce(
					(geometry, offset) => offsetGeometry(offset, geometry),
					feature.geometry,
				);
			geometries.set(code, toWgs84Geometry(corrected, donor.crs));
		}
		const covered = new Set(
			codes.filter((code) => code.startsWith(substitution.codePrefix)),
		);
		const unmatched = [
			...[...covered].filter((code) => !geometries.has(code)),
			...[...geometries.keys()].filter((code) => !covered.has(code)),
		].sort();
		if (covered.size === 0 || unmatched.length > 0)
			throw new Error(
				`${identity}: ${id} needs the same ${substitution.codePrefix} codes as ${donorIdentity}; ${covered.size === 0 ? "the release has none" : `unmatched: ${unmatched.join(", ")}`}.`,
			);
		return {
			substitution,
			donor: {
				release: donorIdentity,
				input: donor.input,
				inputHash: donor.inputHash ?? sha256(content),
			},
			geometries,
		};
	});
};
var substitutionProvenance = (sources, ids, code) =>
	ids
		.map(geometrySubstitution)
		.filter(
			(substitution) =>
				code === void 0 || code.startsWith(substitution.codePrefix),
		)
		.map((substitution) => {
			const donor = sources.get(
				releaseKey(
					substitution.donor.geography,
					substitution.donor.boundaryRelease,
				),
			);
			return {
				id: substitution.id,
				description: donor
					? `${substitution.description} Source: ${donor.input}${donor.inputHash ? ` (${donor.inputHash})` : ""}.`
					: substitution.description,
			};
		});
var reversedGridOffset = (id) => {
	const reversed = REVERSED_GRID_OFFSETS.find(
		(candidate) => candidate.id === id,
	);
	if (!reversed)
		throw new Error(`No reversed grid offset is defined as ${id}.`);
	return reversed;
};
var offsets = /* @__PURE__ */ new Map();
var gridOffset = (repositoryRoot, id) => {
	const key = `${repositoryRoot}\0${id}`;
	let offset = offsets.get(key);
	if (!offset) {
		offset = readGridOffset(repositoryRoot, id);
		offsets.set(key, offset);
	}
	return offset;
};
var applyReversedOffsets = (repositoryRoot, ids, code, geometry) =>
	ids
		.map(reversedGridOffset)
		.filter((reversed) => code.startsWith(reversed.codePrefix))
		.reduce((moved, reversed) => {
			const offset = gridOffset(repositoryRoot, reversed.offset);
			return toWgs84Geometry(
				reverseOffsetGeometry(
					offset,
					fromWgs84Geometry(moved, offset.crs),
				),
				offset.crs,
			);
		}, geometry);
var reversedOffsetProvenance = (ids, code) =>
	ids
		.map(reversedGridOffset)
		.filter(
			(reversed) =>
				code === void 0 || code.startsWith(reversed.codePrefix),
		)
		.map(({ id, description }) => ({ id, description }));

// src/geometryStore.ts
import {
	closeSync,
	fstatSync as fstatSync2,
	openSync as openSync2,
	readSync as readSync2,
} from "node:fs";

// src/geometrySpatialIndex.ts
var SPATIAL_CELL_DEGREES = 0.25;
var MAX_SPATIAL_QUERY_CELLS = 1e4;
var spatialCells = (bounds) => {
	const west = Math.max(-180, bounds[0]);
	const south = Math.max(-90, bounds[1]);
	const east = Math.min(180, bounds[2]);
	const north = Math.min(90, bounds[3]);
	if (west > east || south > north) return [];
	const range = {
		west: Math.floor((west + 180) / SPATIAL_CELL_DEGREES),
		south: Math.floor((south + 90) / SPATIAL_CELL_DEGREES),
		east: Math.floor((east + 180) / SPATIAL_CELL_DEGREES),
		north: Math.floor((north + 90) / SPATIAL_CELL_DEGREES),
	};
	const count =
		(range.east - range.west + 1) * (range.north - range.south + 1);
	if (count > MAX_SPATIAL_QUERY_CELLS) return void 0;
	const cells = [];
	for (let longitude = range.west; longitude <= range.east; longitude++)
		for (let latitude = range.south; latitude <= range.north; latitude++)
			cells.push([longitude, latitude]);
	return cells;
};
var spatialCellKey = ([longitude, latitude]) => `${longitude}/${latitude}`;

// src/geometryStore.ts
var MAGIC = Buffer.from("ATLGEO2\n");
var align = (offset) => Math.ceil(offset / 8) * 8;
var sameSource = (left, right) =>
	JSON.stringify(left) === JSON.stringify(right);
var readAt = (descriptor, position, length) => {
	const content = Buffer.alloc(length);
	let read = 0;
	while (read < length) {
		const count = readSync2(
			descriptor,
			content,
			read,
			length - read,
			position + read,
		);
		if (count === 0)
			throw new Error("Compiled geometry store ends unexpectedly.");
		read += count;
	}
	return content;
};
var tableLength = (count, index) =>
	(count + 1) * Float64Array.BYTES_PER_ELEMENT +
	count * 4 * Float64Array.BYTES_PER_ELEMENT +
	index.cellCount * 2 * Int32Array.BYTES_PER_ELEMENT +
	(index.cellCount + 1) * Uint32Array.BYTES_PER_ELEMENT +
	index.candidateCount * Uint32Array.BYTES_PER_ELEMENT +
	index.indexedCodeCount * Uint32Array.BYTES_PER_ELEMENT;
var validSpatialIndex = (index) =>
	Number.isSafeInteger(index.cellCount) &&
	Number.isSafeInteger(index.candidateCount) &&
	Number.isSafeInteger(index.indexedCodeCount) &&
	index.cellCount >= 0 &&
	index.candidateCount >= 0 &&
	index.indexedCodeCount >= 0;
var readGeometryStore = (path, expected) => {
	const descriptor = openSync2(path, "r");
	let closed = false;
	const close = () => {
		if (!closed) {
			closeSync(descriptor);
			closed = true;
		}
	};
	try {
		const prefix = readAt(descriptor, 0, MAGIC.length + 8);
		if (!prefix.subarray(0, MAGIC.length).equals(MAGIC))
			throw new Error(`${path} is not a compiled geometry release.`);
		const headerLength = prefix.readUInt32LE(MAGIC.length);
		const count = prefix.readUInt32LE(MAGIC.length + 4);
		const headerAt = MAGIC.length + 8;
		const header = JSON.parse(
			readAt(descriptor, headerAt, headerLength).toString("utf8"),
		);
		if (!sameSource(header.source, expected)) {
			close();
			return void 0;
		}
		if (
			header.codes.length !== count ||
			!validSpatialIndex(header.spatialIndex)
		)
			throw new Error(`${path} has invalid compiled geometry metadata.`);
		const tablesAt = align(headerAt + headerLength);
		const tablesBytes = tableLength(count, header.spatialIndex);
		const recordsAt = align(tablesAt + tablesBytes);
		const bytes = fstatSync2(descriptor).size;
		if (recordsAt > bytes)
			throw new Error(`${path} ends before its geometry records.`);
		let tables = readAt(descriptor, tablesAt, tablesBytes);
		if (tables.byteOffset % 8 !== 0) tables = Buffer.from(tables);
		let offset = 0;
		const offsets2 = new Float64Array(
			tables.buffer,
			tables.byteOffset + offset,
			count + 1,
		);
		offset += offsets2.byteLength;
		const envelopes = new Float64Array(
			tables.buffer,
			tables.byteOffset + offset,
			count * 4,
		);
		offset += envelopes.byteLength;
		const cells = new Int32Array(
			tables.buffer,
			tables.byteOffset + offset,
			header.spatialIndex.cellCount * 2,
		);
		offset += cells.byteLength;
		const cellOffsets = new Uint32Array(
			tables.buffer,
			tables.byteOffset + offset,
			header.spatialIndex.cellCount + 1,
		);
		offset += cellOffsets.byteLength;
		const candidates = new Uint32Array(
			tables.buffer,
			tables.byteOffset + offset,
			header.spatialIndex.candidateCount,
		);
		offset += candidates.byteLength;
		const indexedCodes = new Uint32Array(
			tables.buffer,
			tables.byteOffset + offset,
			header.spatialIndex.indexedCodeCount,
		);
		const index = new Map(header.codes.map((code, at) => [code, at]));
		for (let at = 0; at <= count; at++)
			if (
				!Number.isSafeInteger(offsets2[at]) ||
				offsets2[at] < recordsAt ||
				(at > 0 && offsets2[at] < offsets2[at - 1])
			)
				throw new Error(
					`${path} has invalid compiled geometry offsets.`,
				);
		if (
			offsets2[0] !== recordsAt ||
			offsets2[count] !== bytes ||
			cellOffsets[0] !== 0 ||
			cellOffsets[cellOffsets.length - 1] !== candidates.length
		)
			throw new Error(`${path} has invalid compiled geometry indexes.`);
		for (const at of [...candidates, ...indexedCodes])
			if (at >= count)
				throw new Error(
					`${path} has invalid compiled geometry indexes.`,
				);
		const codeAt = (at) => header.codes[at];
		const findCell = ([longitude, latitude]) => {
			let low = 0;
			let high = header.spatialIndex.cellCount - 1;
			while (low <= high) {
				const middle = Math.floor((low + high) / 2);
				const compared =
					cells[middle * 2] - longitude ||
					cells[middle * 2 + 1] - latitude;
				if (compared === 0) return middle;
				if (compared < 0) low = middle + 1;
				else high = middle - 1;
			}
			return void 0;
		};
		const decode = (at) => {
			const start = offsets2[at];
			const end = offsets2[at + 1];
			const record = readAt(descriptor, start, end - start);
			const descriptorLength = record.readUInt32LE(0);
			if (descriptorLength > record.length - 4)
				throw new Error(`${path} has an invalid area descriptor.`);
			const area = JSON.parse(
				record.toString("utf8", 4, 4 + descriptorLength),
			);
			let cursor = 4 + descriptorLength;
			const float64 = (length) => {
				cursor = align(cursor);
				const array = new Float64Array(
					record.buffer,
					record.byteOffset + cursor,
					length,
				);
				cursor += array.byteLength;
				return array;
			};
			const uint32 = (length) => {
				cursor = align(cursor);
				const array = new Uint32Array(
					record.buffer,
					record.byteOffset + cursor,
					length,
				);
				cursor += array.byteLength;
				return array;
			};
			const build = (part) =>
				part.k === "p"
					? {
							kind: "packed",
							type: part.t,
							stride: part.s,
							positions: float64(part.n),
							counts: part.c.map(uint32),
						}
					: part.k === "c"
						? { kind: "collection", geometries: part.g.map(build) }
						: { kind: "raw", geometry: part.g };
			return build(area);
		};
		return {
			codes: header.codes,
			has: (code) => index.has(code),
			get: (code) => {
				const at = index.get(code);
				return at === void 0 ? void 0 : decode(at);
			},
			bounds: (code) => {
				const at = index.get(code);
				if (at === void 0 || Number.isNaN(envelopes[at * 4]))
					return void 0;
				return [
					envelopes[at * 4],
					envelopes[at * 4 + 1],
					envelopes[at * 4 + 2],
					envelopes[at * 4 + 3],
				];
			},
			spatialIndex: {
				codes: [...indexedCodes].map((at) => codeAt(at)),
				cellCount: header.spatialIndex.cellCount,
				candidates: (bounds) => {
					const queryCells = spatialCells(bounds);
					if (queryCells === void 0)
						return [...indexedCodes].map((at) => codeAt(at));
					const found = /* @__PURE__ */ new Set();
					for (const cell of queryCells) {
						const at = findCell(cell);
						if (at === void 0) continue;
						for (
							let candidate = cellOffsets[at];
							candidate < cellOffsets[at + 1];
							candidate++
						)
							found.add(candidates[candidate]);
					}
					return [...found].map((at) => codeAt(at));
				},
			},
			bytes,
			close,
		};
	} catch (error) {
		close();
		throw error;
	}
};

// src/equalAreaProjection.ts
var A2 = 6378137;
var F2 = 1 / 298.257223563;
var E22 = F2 * (2 - F2);
var E = Math.sqrt(E22);
var K0 =
	Math.cos(Math.PI / 6) / Math.sqrt(1 - E22 * Math.sin(Math.PI / 6) ** 2);
var edgeLengthM = ([lon1, lat1], [lon2, lat2]) => {
	const sinLat = Math.sin((((lat1 + lat2) / 2) * Math.PI) / 180);
	const w = Math.sqrt(1 - E22 * sinLat * sinLat);
	const meridional = (A2 * (1 - E22)) / (w * w * w);
	const primeVertical = (A2 / w) * Math.sqrt(1 - sinLat * sinLat);
	return Math.hypot(
		(((lon2 - lon1) * Math.PI) / 180) * primeVertical,
		(((lat2 - lat1) * Math.PI) / 180) * meridional,
	);
};

// src/areaNeighbours.ts
var vertexKey = ([longitude, latitude]) => `${longitude},${latitude}`;
var edgeKey = (start, end) => {
	const from = vertexKey(start);
	const to = vertexKey(end);
	return from < to ? `${from}|${to}` : `${to}|${from}`;
};
var ringsOf2 = (geometry) => {
	if (geometry.type === "GeometryCollection")
		return (geometry.geometries ?? []).flatMap(ringsOf2);
	const polygons =
		geometry.type === "Polygon"
			? [geometry.coordinates]
			: geometry.type === "MultiPolygon"
				? geometry.coordinates
				: [];
	return (Array.isArray(polygons) ? polygons : []).flatMap((polygon) =>
		(Array.isArray(polygon) ? polygon : []).flatMap((ring) =>
			Array.isArray(ring) ? [ring] : [],
		),
	);
};
var borderIndex = (geometry) => {
	const edges = /* @__PURE__ */ new Map();
	const vertices = /* @__PURE__ */ new Set();
	let bounds;
	for (const ring of ringsOf2(geometry)) {
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const start = ring[j];
			const end = ring[i];
			if (!Array.isArray(start) || !Array.isArray(end)) continue;
			vertices.add(vertexKey(start));
			if (bounds) {
				bounds[0] = Math.min(bounds[0], start[0]);
				bounds[1] = Math.min(bounds[1], start[1]);
				bounds[2] = Math.max(bounds[2], start[0]);
				bounds[3] = Math.max(bounds[3], start[1]);
			} else bounds = [start[0], start[1], start[0], start[1]];
			if (vertexKey(start) === vertexKey(end)) continue;
			const key = edgeKey(start, end);
			if (!edges.has(key)) edges.set(key, edgeLengthM(start, end));
		}
	}
	return { edges, vertices, bounds };
};
var sharedBorderWith = (target, geometry) => {
	if (!target.bounds) return void 0;
	const [west, south, east, north] = target.bounds;
	const inside = ([longitude, latitude]) =>
		longitude >= west &&
		longitude <= east &&
		latitude >= south &&
		latitude <= north;
	const sharedVertexKeys = /* @__PURE__ */ new Set();
	const sharedEdgeKeys = /* @__PURE__ */ new Set();
	let sharedBorderM = 0;
	for (const ring of ringsOf2(geometry)) {
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const start = ring[j];
			const end = ring[i];
			if (!Array.isArray(start) || !Array.isArray(end)) continue;
			if (!inside(start)) continue;
			const from = vertexKey(start);
			if (!target.vertices.has(from)) continue;
			sharedVertexKeys.add(from);
			if (!inside(end)) continue;
			const to = vertexKey(end);
			if (from === to) continue;
			const key = from < to ? `${from}|${to}` : `${to}|${from}`;
			const length = target.edges.get(key);
			if (length === void 0 || sharedEdgeKeys.has(key)) continue;
			sharedEdgeKeys.add(key);
			sharedBorderM += length;
		}
	}
	if (sharedVertexKeys.size === 0) return void 0;
	return {
		touch: sharedEdgeKeys.size > 0 ? "edge" : "point",
		sharedBorderM,
		sharedEdges: sharedEdgeKeys.size,
		sharedVertices: sharedVertexKeys.size,
	};
};

// src/areaGeometry.ts
var isGeometry = (value) =>
	typeof value === "object" &&
	value !== null &&
	typeof value.type === "string";
var MATERIALISED_AREAS = 256;
var compiledGeometryFile = (geography, boundaryRelease) =>
	`${geography}-${boundaryRelease}.bin`;
var AreaGeometryCache = class {
	constructor(
		repositoryRoot,
		sources,
		maxReleases = 2,
		storeDirectory,
		onStaleCompiled,
	) {
		this.repositoryRoot = repositoryRoot;
		this.sources = sources;
		this.maxReleases = maxReleases;
		this.storeDirectory = storeDirectory;
		this.onStaleCompiled = onStaleCompiled;
		if (!Number.isInteger(maxReleases) || maxReleases < 1)
			throw new Error(
				"The geometry cache must hold at least one release.",
			);
	}
	repositoryRoot;
	sources;
	maxReleases;
	storeDirectory;
	onStaleCompiled;
	releases = /* @__PURE__ */ new Map();
	offsets = /* @__PURE__ */ new Map();
	/** Recently read areas as GeoJSON, least recently used first. */
	materialised = /* @__PURE__ */ new Map();
	counts = {
		reads: 0,
		loads: 0,
		compiledLoads: 0,
		staleCompiledLoads: 0,
		evictions: 0,
		loadSeconds: 0,
		spatialIndexBuilds: 0,
	};
	stats() {
		return {
			maxReleases: this.maxReleases,
			loadedReleases: [...this.releases.keys()],
			spatialIndexes: [...this.releases.entries()].flatMap(
				([release, cached]) =>
					cached.spatialIndex
						? [
								{
									release,
									areas: cached.spatialIndex.codes.length,
									cells: cached.spatialIndex.cellCount,
								},
							]
						: [],
			),
			...this.counts,
		};
	}
	source(geography, boundaryRelease) {
		const identity = [geography, boundaryRelease].join("/");
		const source = this.sources.get(identity);
		if (!source)
			throw new Error(
				"No raw geometry source is available for " + identity + ".",
			);
		if (!canServeAsWgs84(source.crs))
			throw new Error(
				"No transformation to WGS84 is available for geometry in " +
					source.crs +
					".",
			);
		return source;
	}
	/** The declared corrections that move this area, loaded once each. */
	correctionsFor(source, code) {
		return (source.corrections ?? [])
			.map((id) => {
				let offset = this.offsets.get(id);
				if (!offset) {
					offset = readGridOffset(this.repositoryRoot, id);
					this.offsets.set(id, offset);
				}
				return offset;
			})
			.filter((offset) => appliesTo(offset, code));
	}
	/** One area in WGS84, packed; reprojected from its source on first use. */
	wgs84Packed(release, geography, boundaryRelease, code, keep = true) {
		const packed = release.geometries.get(code);
		if (!packed || isWgs84(release.crs)) return packed;
		const cached = release.wgs84.get(code);
		if (cached) return cached;
		const corrections = this.correctionsFor(
			this.source(geography, boundaryRelease),
			code,
		);
		const reprojected =
			corrections.length === 0
				? toWgs84Packed(packed, release.crs)
				: packGeometry(
						toWgs84Geometry(
							corrections.reduce(
								(moved, offset) =>
									offsetGeometry(offset, moved),
								unpackGeometry(packed),
							),
							release.crs,
						),
					);
		if (keep) release.wgs84.set(code, reprojected);
		return reprojected;
	}
	/**
	 * One area as WGS84 GeoJSON. Reads through `get` keep it for the next
	 * request; internal whole-release passes build it and let it go.
	 */
	wgs84Geometry(release, geography, boundaryRelease, code, cache) {
		const key = `${release.identity}\0${code}`;
		const held = this.materialised.get(key);
		if (held) {
			this.materialised.delete(key);
			this.materialised.set(key, held);
			return held;
		}
		const packed = this.wgs84Packed(
			release,
			geography,
			boundaryRelease,
			code,
		);
		if (!packed) return void 0;
		const geometry = unpackGeometry(packed);
		if (cache) {
			this.materialised.set(key, geometry);
			if (this.materialised.size > MATERIALISED_AREAS)
				this.materialised.delete(this.materialised.keys().next().value);
		}
		return geometry;
	}
	/** One area's WGS84 envelope, read from its packed coordinates. */
	boundsFor(release, geography, boundaryRelease, code) {
		if (release.storedBounds) return release.storedBounds(code);
		if (release.bounds.has(code)) return release.bounds.get(code);
		const packed = this.wgs84Packed(
			release,
			geography,
			boundaryRelease,
			code,
		);
		const bounds = packed ? packedBounds(packed) : void 0;
		release.bounds.set(code, bounds);
		return bounds;
	}
	/** Build the release-local candidate index once, independently of exact reads. */
	spatialIndexFor(geography, boundaryRelease) {
		this.get(geography, boundaryRelease, "");
		const identity = [geography, boundaryRelease].join("/");
		const release = this.releases.get(identity);
		if (!release) return void 0;
		if (release.spatialIndex)
			return { release, index: release.spatialIndex };
		const cells = /* @__PURE__ */ new Map();
		const codes = [];
		for (const code of release.geometries.keys()) {
			const bounds = this.boundsFor(
				release,
				geography,
				boundaryRelease,
				code,
			);
			if (!bounds) continue;
			codes.push(code);
			for (const cell of spatialCells(bounds) ?? []) {
				const key = spatialCellKey(cell);
				const candidates = cells.get(key) ?? [];
				candidates.push(code);
				cells.set(key, candidates);
			}
		}
		release.spatialIndex = {
			codes,
			cellCount: cells.size,
			candidates: (bounds) => {
				const queryCells = spatialCells(bounds);
				if (queryCells === void 0) return codes;
				const candidates = /* @__PURE__ */ new Set();
				for (const cell of queryCells)
					for (const code of cells.get(spatialCellKey(cell)) ?? [])
						candidates.add(code);
				return candidates;
			},
		};
		this.counts.spatialIndexBuilds += 1;
		return { release, index: release.spatialIndex };
	}
	spatialCandidates(index, bounds) {
		return index.candidates(bounds);
	}
	/**
	 * The geometry's source CRS, how it was transformed to WGS84, and, given
	 * an area code, any declared correction that moved that area.
	 */
	provenance(geography, boundaryRelease, code) {
		const source = this.source(geography, boundaryRelease);
		const corrections = [
			...(code === void 0 || isWgs84(source.crs)
				? []
				: this.correctionsFor(source, code)
			).map(({ id, description }) => ({ id, description })),
			...(code === void 0
				? []
				: [
						...substitutionProvenance(
							this.sources,
							source.substitutions ?? [],
							code,
						),
						...reversedOffsetProvenance(
							source.reversedOffsets ?? [],
							code,
						),
					]),
		];
		return {
			...(source.inputHash
				? { input: source.input, inputHash: source.inputHash }
				: {}),
			...geometryProvenance(source.crs),
			...(corrections.length > 0 ? { corrections } : {}),
		};
	}
	/** A compiled release of this area set, if one is current. */
	readCompiled(identity, geography, boundaryRelease) {
		if (!this.storeDirectory) return void 0;
		const path = join7(
			this.storeDirectory,
			compiledGeometryFile(geography, boundaryRelease),
		);
		if (!existsSync6(path)) return void 0;
		const stored = readGeometryStore(
			path,
			this.source(geography, boundaryRelease),
		);
		if (!stored) {
			this.counts.staleCompiledLoads += 1;
			this.onStaleCompiled?.(identity, path);
			return void 0;
		}
		this.counts.compiledLoads += 1;
		return {
			identity,
			crs: "EPSG:4326",
			geometries: { get: stored.get, keys: () => stored.codes.values() },
			storedBounds: stored.bounds,
			wgs84: /* @__PURE__ */ new Map(),
			bounds: /* @__PURE__ */ new Map(),
			spatialIndex: stored.spatialIndex,
			close: stored.close,
		};
	}
	/** A release read from its publisher's file, as it was registered. */
	readSource(identity, geography, boundaryRelease) {
		const source = this.source(geography, boundaryRelease);
		const inputPath = join7(this.repositoryRoot, "data", source.input);
		const data = inputPath.toLowerCase().endsWith(".shp")
			? {
					type: "FeatureCollection",
					features: readShapefileFeatures(inputPath),
				}
			: JSON.parse(readFileSync12(inputPath, "utf8"));
		if (data.type !== "FeatureCollection" || !Array.isArray(data.features))
			throw new Error(
				"Geometry source is not a GeoJSON FeatureCollection.",
			);
		const geometries = /* @__PURE__ */ new Map();
		for (const feature of data.features) {
			const props = feature.properties;
			const value =
				typeof props === "object" && props !== null
					? props[source.codeProperty]
					: void 0;
			if (typeof value !== "string" || !isGeometry(feature.geometry))
				continue;
			const existing = geometries.get(value);
			geometries.set(
				value,
				existing
					? {
							type: "GeometryCollection",
							geometries: [
								...(existing.type === "GeometryCollection"
									? (existing.geometries ?? [])
									: [existing]),
								feature.geometry,
							],
						}
					: feature.geometry,
			);
		}
		if (source.substitutions?.length) {
			if (!isWgs84(source.crs))
				throw new Error(
					`${identity}: geometry substitutions need a WGS84 release, not ${source.crs}.`,
				);
			for (const { geometries: donor } of loadSubstitutions(
				this.repositoryRoot,
				this.sources,
				identity,
				source.substitutions,
				geometries.keys(),
			))
				for (const [code, geometry] of donor)
					geometries.set(code, geometry);
		}
		if (source.reversedOffsets?.length) {
			if (!isWgs84(source.crs))
				throw new Error(
					`${identity}: reversed grid offsets need a WGS84 release, not ${source.crs}.`,
				);
			for (const [code, geometry] of geometries)
				geometries.set(
					code,
					applyReversedOffsets(
						this.repositoryRoot,
						source.reversedOffsets,
						code,
						geometry,
					),
				);
		}
		const packed = /* @__PURE__ */ new Map();
		for (const [code, geometry] of geometries)
			packed.set(code, packGeometry(geometry));
		return {
			identity,
			crs: source.crs,
			geometries: packed,
			wgs84: /* @__PURE__ */ new Map(),
			bounds: /* @__PURE__ */ new Map(),
		};
	}
	/**
	 * Every area of a release in WGS84, packed, in source order, for
	 * compiling it. Reprojections are not kept, so a whole release passes
	 * through without being held twice.
	 */
	*compile(geography, boundaryRelease) {
		const identity = [geography, boundaryRelease].join("/");
		const release = this.readSource(identity, geography, boundaryRelease);
		for (const code of release.geometries.keys()) {
			const packed = this.wgs84Packed(
				release,
				geography,
				boundaryRelease,
				code,
				false,
			);
			if (packed) yield [code, packed];
		}
	}
	/** The area's geometry in WGS84, reprojected from its source if needed. */
	get(geography, boundaryRelease, code) {
		const identity = [geography, boundaryRelease].join("/");
		let release = this.releases.get(identity);
		if (!release) {
			const started2 = performance.now();
			release =
				this.readCompiled(identity, geography, boundaryRelease) ??
				this.readSource(identity, geography, boundaryRelease);
			this.releases.set(identity, release);
			this.counts.loads += 1;
			this.counts.loadSeconds += (performance.now() - started2) / 1e3;
			while (this.releases.size > this.maxReleases) {
				const evicted = this.releases.keys().next().value;
				const release2 = this.releases.get(evicted);
				this.releases.delete(evicted);
				release2?.close?.();
				for (const key of this.materialised.keys())
					if (key.startsWith(`${evicted}\0`))
						this.materialised.delete(key);
				this.counts.evictions += 1;
			}
		} else {
			this.counts.reads += 1;
			this.releases.delete(identity);
			this.releases.set(identity, release);
		}
		return this.wgs84Geometry(
			release,
			geography,
			boundaryRelease,
			code,
			true,
		);
	}
	/** Load releases and their precomputed indexes before accepting traffic. */
	warm(releases) {
		for (const [geography, boundaryRelease] of releases)
			this.spatialIndexFor(geography, boundaryRelease);
	}
	/**
	 * Every area code the release publishes, in the order its source lists
	 * them. Used to compile a whole release rather than answer for one area.
	 */
	codes(geography, boundaryRelease) {
		this.get(geography, boundaryRelease, "");
		const release = this.releases.get(
			[geography, boundaryRelease].join("/"),
		);
		return release ? [...release.geometries.keys()] : [];
	}
	/**
	 * Find areas containing a WGS84 point within one boundary release. A compact
	 * grid index first finds candidate bounds; exact polygon tests preserve the
	 * published boundary semantics, including shared edges and holes.
	 */
	findContaining(geography, boundaryRelease, point) {
		const indexed = this.spatialIndexFor(geography, boundaryRelease);
		if (!indexed) return [];
		const { release, index } = indexed;
		const matches = [];
		for (const code of this.spatialCandidates(index, [
			point[0],
			point[1],
			point[0],
			point[1],
		])) {
			const bounds = this.boundsFor(
				release,
				geography,
				boundaryRelease,
				code,
			);
			if (!bounds || !pointInBounds(point, bounds)) continue;
			const geometry = this.get(geography, boundaryRelease, code);
			if (!geometry) continue;
			const containment = containPoint(point, geometry);
			if (containment !== "outside") matches.push({ code, containment });
		}
		return matches.sort((left, right) =>
			left.code.localeCompare(right.code),
		);
	}
	/**
	 * The areas of one release nearest a WGS84 point, no further than
	 * `withinM`, nearest first. The same compact grid narrows the work to areas
	 * whose envelopes can reach the requested radius.
	 */
	findNearest(geography, boundaryRelease, point, withinM) {
		const indexed = this.spatialIndexFor(geography, boundaryRelease);
		if (!indexed) return [];
		const { release, index } = indexed;
		const latitudeDelta = withinM / 11e4;
		const furthestLatitude = Math.min(
			89.999,
			Math.abs(point[1]) + latitudeDelta,
		);
		const longitudeMetresPerDegree = Math.max(
			1e-3,
			11e4 * Math.cos((furthestLatitude * Math.PI) / 180),
		);
		const longitudeDelta = withinM / longitudeMetresPerDegree;
		const searchBounds = [
			Math.max(-180, point[0] - longitudeDelta),
			Math.max(-90, point[1] - latitudeDelta),
			Math.min(180, point[0] + longitudeDelta),
			Math.min(90, point[1] + latitudeDelta),
		];
		const nearby = [];
		for (const code of this.spatialCandidates(index, searchBounds)) {
			const bounds = this.boundsFor(
				release,
				geography,
				boundaryRelease,
				code,
			);
			if (!bounds || distanceToBoundsM(point, bounds) > withinM) continue;
			const geometry = this.get(geography, boundaryRelease, code);
			if (!geometry) continue;
			const distanceM = distanceToGeometryM(point, geometry);
			if (distanceM <= withinM) nearby.push({ code, distanceM });
		}
		return nearby.sort(
			(left, right) =>
				left.distanceM - right.distanceM ||
				left.code.localeCompare(right.code),
		);
	}
	/**
	 * Find areas meeting a WGS84 box within one boundary release.
	 *
	 * Most areas are settled by their cached bounds alone. Bounds that fall
	 * entirely inside the box put the area inside it too, exactly, since an
	 * area never reaches past its own bounds; bounds that miss the box settle
	 * it the other way. Only an area straddling an edge of the box needs its
	 * rings walked, which is a thin band around the box however large the box
	 * is.
	 */
	findIntersecting(geography, boundaryRelease, box) {
		const indexed = this.spatialIndexFor(geography, boundaryRelease);
		if (!indexed) return [];
		const { release, index } = indexed;
		const matches = [];
		for (const code of this.spatialCandidates(index, box)) {
			const bounds = this.boundsFor(
				release,
				geography,
				boundaryRelease,
				code,
			);
			if (!bounds || !boundsIntersect(bounds, box)) continue;
			if (boundsWithin(bounds, box)) {
				matches.push({ code, relation: "within", bounds });
				continue;
			}
			const geometry = this.get(geography, boundaryRelease, code);
			if (!geometry) continue;
			if (geometryMeetsBounds(geometry, box))
				matches.push({ code, relation: "overlaps", bounds });
		}
		return matches.sort((left, right) =>
			left.code.localeCompare(right.code),
		);
	}
	/**
	 * Find the areas whose boundary meets this one's, within one release.
	 *
	 * Only areas whose bounds touch the target's can share anything with it, so
	 * the boundary comparison runs against a handful of candidates rather than
	 * the whole release, and the grid index finds those candidates without
	 * visiting every area's envelope. Nothing here is indexed across every
	 * area's edges, which for a ward release would be millions held to answer
	 * one question.
	 *
	 * Returns undefined when the area itself has no geometry to compare.
	 */
	findNeighbours(geography, boundaryRelease, code) {
		const geometry = this.get(geography, boundaryRelease, code);
		if (!geometry) return void 0;
		const indexed = this.spatialIndexFor(geography, boundaryRelease);
		if (!indexed) return void 0;
		const { release, index } = indexed;
		const boundsFor = (forCode) =>
			this.boundsFor(release, geography, boundaryRelease, forCode);
		const targetBounds = boundsFor(code);
		if (!targetBounds) return [];
		const target = borderIndex(geometry);
		const neighbours = [];
		for (const otherCode of this.spatialCandidates(index, targetBounds)) {
			if (otherCode === code) continue;
			const otherBounds = boundsFor(otherCode);
			if (!otherBounds || !boundsIntersect(targetBounds, otherBounds))
				continue;
			const other = this.get(geography, boundaryRelease, otherCode);
			if (!other) continue;
			const shared = sharedBorderWith(target, other);
			if (shared) neighbours.push({ code: otherCode, ...shared });
		}
		return neighbours.sort(
			(left, right) =>
				right.sharedBorderM - left.sharedBorderM ||
				left.code.localeCompare(right.code),
		);
	}
};

// src/geometrySources.ts
import { readFileSync as readFileSync13 } from "node:fs";
import { join as join8 } from "node:path";
var readGeometrySourceLookup = (apiRoot2) => {
	const registry = JSON.parse(
		readFileSync13(
			join8(apiRoot2, "public", "geometry-sources.json"),
			"utf8",
		),
	);
	if (registry.schemaVersion !== 1 || !Array.isArray(registry.releases))
		throw new Error("Invalid geometry source registry.");
	return new Map(
		registry.releases.flatMap((release) => {
			if (typeof release !== "object" || release === null) return [];
			const r = release;
			if (
				r.status !== "available" ||
				typeof r.id !== "string" ||
				typeof r.input !== "string" ||
				typeof r.crs !== "string" ||
				typeof r.codeProperty !== "string"
			)
				return [];
			return [
				[
					r.id,
					{
						input: r.input,
						...(typeof r.inputHash === "string"
							? { inputHash: r.inputHash }
							: {}),
						crs: r.crs,
						codeProperty: r.codeProperty,
						...(Array.isArray(r.corrections)
							? {
									corrections: r.corrections.filter(
										(id) => typeof id === "string",
									),
								}
							: {}),
						...(Array.isArray(r.substitutions)
							? {
									substitutions: r.substitutions.filter(
										(id) => typeof id === "string",
									),
								}
							: {}),
						...(Array.isArray(r.reversedOffsets)
							? {
									reversedOffsets: r.reversedOffsets.filter(
										(id) => typeof id === "string",
									),
								}
							: {}),
					},
				],
			];
		}),
	);
};

// src/geometryLoader.ts
var readGeometrySources = (apiRoot2) => readGeometrySourceLookup(apiRoot2);
var createAreaGeometryCache = (apiRoot2, maxReleases, onStaleCompiled) =>
	new AreaGeometryCache(
		resolve(apiRoot2, "../.."),
		readGeometrySources(apiRoot2),
		maxReleases,
		resolve(apiRoot2, "public", "geometry-store"),
		onStaleCompiled,
	);

// src/terrainProvider.ts
var TerrainRemoteError = class extends Error {
	cause;
	constructor(message, cause) {
		super(message);
		this.name = "TerrainRemoteError";
		this.cause = cause;
	}
};
var createRemoteTerrainProvider = ({
	endpoint,
	coverageEndpoint,
	source,
	fetcher = fetch,
	timeoutMs = 5e3,
	maxConcurrent = 4,
}) => {
	if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1)
		throw new Error("maxConcurrent must be a positive integer.");
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
		throw new Error("timeoutMs must be positive.");
	let active = 0;
	const waiters = [];
	const acquire = async () => {
		if (active < maxConcurrent) {
			active += 1;
			return;
		}
		await new Promise((resolve4) => waiters.push(resolve4));
		active += 1;
	};
	const release = () => {
		active -= 1;
		waiters.shift()?.();
	};
	const requestJson = async (url) => {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetcher(url, { signal: controller.signal });
			if (!response.ok)
				throw new TerrainRemoteError(
					`Remote terrain request failed (${response.status}).`,
				);
			return await response.json();
		} catch (error) {
			if (error instanceof TerrainRemoteError) throw error;
			throw new TerrainRemoteError(
				"The remote terrain service did not respond in time or returned invalid JSON.",
				error,
			);
		} finally {
			clearTimeout(timeout);
		}
	};
	return {
		point: async (x, y, options = {}) => {
			const [minX, minY, maxX, maxY] = source.coverage.bbox;
			if (x < minX || x > maxX || y < minY || y > maxY) {
				return {
					status: "outside_coverage",
					x,
					y,
					interpolation: options.interpolation ?? "bilinear",
					unit: "metres",
					value: null,
					source: {
						...source,
						tileHash: sha256(`outside:${x}:${y}`),
						contentHash: sha256(endpoint),
					},
				};
			}
			await acquire();
			try {
				if (coverageEndpoint) {
					const coverageUrl = new URL(coverageEndpoint);
					coverageUrl.searchParams.set(
						"geometry",
						JSON.stringify({
							x,
							y,
							spatialReference: { wkid: 27700 },
						}),
					);
					coverageUrl.searchParams.set(
						"geometryType",
						"esriGeometryPoint",
					);
					coverageUrl.searchParams.set(
						"spatialRel",
						"esriSpatialRelIntersects",
					);
					coverageUrl.searchParams.set("returnGeometry", "false");
					coverageUrl.searchParams.set("f", "json");
					const coverage = await requestJson(coverageUrl);
					if (coverage.error)
						throw new TerrainRemoteError(
							coverage.error.message ??
								"Remote coverage query failed.",
						);
					if (!coverage.features?.length)
						return {
							status: "outside_coverage",
							x,
							y,
							interpolation: options.interpolation ?? "bilinear",
							unit: "metres",
							value: null,
							source: {
								...source,
								tileHash: sha256(`outside:${x}:${y}`),
								contentHash: sha256(endpoint),
							},
						};
				}
				const url = new URL(endpoint);
				url.searchParams.set(
					"geometry",
					JSON.stringify({ x, y, spatialReference: { wkid: 27700 } }),
				);
				url.searchParams.set("geometryType", "esriGeometryPoint");
				url.searchParams.set("returnFirstValueOnly", "true");
				url.searchParams.set(
					"interpolation",
					options.interpolation === "nearest"
						? "RSP_NearestNeighbor"
						: "RSP_BilinearInterpolation",
				);
				url.searchParams.set("f", "json");
				const payload = await requestJson(url);
				if (payload.error)
					throw new TerrainRemoteError(
						payload.error.message ??
							"Remote terrain service returned an error.",
					);
				const sample = payload.samples?.[0];
				const rawValue = sample?.value ?? sample?.values?.[0];
				const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
				const resultSource = {
					...source,
					tileHash: sha256(JSON.stringify(payload)),
					contentHash: sha256(endpoint),
				};
				return {
					status:
						value === void 0 || value === source.noData
							? "nodata"
							: "ok",
					x,
					y,
					interpolation: options.interpolation ?? "bilinear",
					unit: "metres",
					value: value ?? null,
					source: resultSource,
				};
			} finally {
				release();
			}
		},
	};
};

// src/terrainLoader.ts
var createTerrainAsyncProvider = (options) =>
	options.terrainRemoteEndpoint
		? createRemoteTerrainProvider({
				endpoint: options.terrainRemoteEndpoint,
				coverageEndpoint: options.terrainCoverageEndpoint,
				timeoutMs: options.terrainRemoteTimeoutMs,
				maxConcurrent: options.terrainRemoteConcurrency,
				source: {
					id: "ea-lidar-composite-dtm-2m",
					version: "remote-preview",
					provenance: "remote-preview",
					crs: "EPSG:27700",
					horizontalDatum: "OSGB36",
					horizontalTransformation: "OSTN15",
					verticalDatum: "ODN",
					verticalModel: "OSGM15",
					resolutionMetres: 2,
					noData: -34028235e31,
					uncertainty: { metric: "rmse", valueMetres: 0.15 },
					coverage: {
						kind: "bbox",
						bbox: [8e4, 4e3, 658081.8635, 666e3],
						footprintHash: "remote-ea-2022-coverage",
					},
				},
			})
		: void 0;

// src/governanceLoader.ts
import { readFileSync as readFileSync14 } from "node:fs";
import { join as join9 } from "node:path";
var readRelationshipCandidateInventory = (apiRoot2) => {
	const path = join9(apiRoot2, "public", "relationship-candidates.json");
	const inventory = JSON.parse(readFileSync14(path, "utf8"));
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.candidates)) {
		throw new Error(`Invalid relationship candidate inventory at ${path}`);
	}
	return inventory;
};

// src/catalogueLoader.ts
var EVIDENCE_DOCUMENTS = [
	"analysis-geography-validation",
	"geography-inventory",
	"measure-compatibility",
	"relationship-candidates",
	"validation-report",
];
var readEvidenceDocuments = (apiRoot2, atlasRelease, dataCatalogHash) => {
	const documents = new Map(
		EVIDENCE_DOCUMENTS.flatMap((id) => {
			const path = `${id}.json`;
			const artifact = atlasRelease?.artifacts.find(
				(candidate) => candidate.path === path,
			);
			if (!artifact) return [];
			const file = resolve2(apiRoot2, "public", path);
			return [
				[
					id,
					{
						path: file,
						bytes: statSync(file).size,
						contentHash: artifact.contentHash,
					},
				],
			];
		}),
	);
	const indexPath = resolve2(apiRoot2, "public", "evidence-documents.json");
	if (existsSync7(indexPath)) {
		const manifest = JSON.parse(readFileSync15(indexPath, "utf8"));
		if (
			manifest.schemaVersion !== 1 ||
			manifest.dataCatalogHash !== dataCatalogHash ||
			!Array.isArray(manifest.documents)
		)
			throw new Error(
				"Evidence documents were not built from this data catalogue.",
			);
		for (const entry of manifest.documents) {
			if (
				!/^[a-z0-9-]+$/.test(entry.id) ||
				entry.artifact !== `documents/${entry.id}.json`
			)
				throw new Error("Invalid evidence document path");
			const path = resolve2(apiRoot2, "public", entry.artifact);
			if (statSync(path).size !== entry.bytes)
				throw new Error(`Evidence document size mismatch at ${path}`);
			documents.set(entry.id, {
				path,
				bytes: entry.bytes,
				contentHash: entry.contentHash,
			});
		}
	}
	return documents;
};
var readApiCatalogues = (apiRoot2, options = {}) => {
	const stage = (name, read) => {
		if (!options.onStage) return read();
		const started2 = performance.now();
		const value = read();
		options.onStage(name, performance.now() - started2);
		return value;
	};
	const boundaryRegistry = stage("boundary-registry", () =>
		readBoundaryRegistry(apiRoot2),
	);
	const geographyInventory = stage("geography-inventory", () =>
		readGeographyInventory(apiRoot2),
	);
	const areaInventory = stage("area-inventory", () =>
		readAreaInventory(apiRoot2),
	);
	const areaLookup = stage("area-lookup", () =>
		readAreaLookup(apiRoot2, areaInventory),
	);
	const namedLocationInventory = stage("named-location-inventory", () =>
		readNamedLocationInventory(apiRoot2),
	);
	const crosswalkInventory = stage("crosswalk-inventory", () =>
		readCrosswalkInventory(apiRoot2),
	);
	const dataCatalog = stage("data-catalog", () => readDataCatalog(apiRoot2));
	const terrainCatalogue = stage("terrain-catalogue", () =>
		readTerrainCatalogue(apiRoot2),
	);
	const atlasRelease = stage("atlas-release", () =>
		readAtlasRelease(apiRoot2),
	);
	const documents = stage("evidence-documents", () =>
		options.loadEvidenceDocuments === false
			? /* @__PURE__ */ new Map()
			: readEvidenceDocuments(
					apiRoot2,
					atlasRelease,
					dataCatalog.contentHash,
				),
	);
	const exportManifest = stage("export-manifest", () =>
		readExportManifest(apiRoot2),
	);
	if (exportManifest.dataCatalogHash !== dataCatalog.contentHash) {
		throw new Error(
			"Export manifest was not built from the current data catalogue.",
		);
	}
	const mapResources = stage("map-resources", () =>
		readMapResources(
			apiRoot2,
			options.mapAssetBaseUrl,
			options.mapTileBaseUrl,
		),
	);
	const mapAssets = stage("map-assets", () =>
		readMapAssets(apiRoot2, mapResources),
	);
	const crosswalkLookup = stage("crosswalk-lookup", () =>
		readCrosswalkLookup(apiRoot2, crosswalkInventory),
	);
	const analysisGeographyInventory = stage(
		"analysis-geography-inventory",
		() =>
			readAnalysisGeographyInventory(
				apiRoot2,
				dataCatalog,
				crosswalkInventory,
			),
	);
	const analysisGeographyValidationInventory = stage(
		"analysis-geography-validation-inventory",
		() =>
			readAnalysisGeographyValidationInventory(
				apiRoot2,
				analysisGeographyInventory,
				dataCatalog,
				crosswalkInventory,
			),
	);
	const relationshipPathInventory = stage("relationship-path-inventory", () =>
		readRelationshipPathInventory(apiRoot2, crosswalkInventory),
	);
	const relationshipCandidateInventory = stage(
		"relationship-candidate-inventory",
		() => readRelationshipCandidateInventory(apiRoot2),
	);
	const namedLocationLookup = stage("named-location-lookup", () =>
		createNamedLocations(namedLocationInventory),
	);
	const locationProjectionInventory = stage(
		"location-projection-inventory",
		() =>
			readLocationProjectionInventory(
				apiRoot2,
				namedLocationInventory,
				crosswalkInventory,
			),
	);
	const locationProjectionStore = stage("location-projection-store", () =>
		createLocationProjectionStore(
			apiRoot2,
			locationProjectionInventory,
			namedLocationInventory,
			crosswalkInventory,
		),
	);
	const postcodeIndex = stage("postcode-index", () =>
		readPostcodeIndex(apiRoot2),
	);
	const geometrySources = stage("geometry-sources", () =>
		readGeometrySources(apiRoot2),
	);
	const postcodeAreaIndex = stage("postcode-area-index", () =>
		readPostcodeAreaIndex(
			apiRoot2,
			postcodeIndex,
			areaInventory,
			geometrySources,
		),
	);
	const postcodeCountsIndex = stage("postcode-counts", () =>
		readPostcodeCounts(apiRoot2, postcodeIndex, postcodeAreaIndex),
	);
	const areaGeometryCache = stage("area-geometry-cache", () =>
		createAreaGeometryCache(
			apiRoot2,
			options.geometryCacheReleases,
			options.onStaleCompiledGeometry,
		),
	);
	const placeIndex = lazyValue(() =>
		stage("place-index", () =>
			readPlaceIndex(apiRoot2, areaInventory, namedLocationInventory),
		),
	);
	const areaSearchIndex = lazyValue(() =>
		stage("area-search-index", () =>
			readAreaSearchIndex(apiRoot2, areaInventory),
		),
	);
	const relationshipPathIndex = stage("relationship-path-index", () =>
		createRelationshipPathIndex(relationshipPathInventory),
	);
	const geographyResolver = stage("geography-resolver", () =>
		createGeographyResolver({
			boundaryRegistry,
			geographyInventory,
			areaInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			areaGeometryCache,
			namedLocationInventory,
			namedLocationLookup,
			get placeIndex() {
				return placeIndex();
			},
			get areaSearchIndex() {
				return areaSearchIndex();
			},
			postcodeIndex,
			postcodeAreaIndex,
			postcodeCountsIndex,
			locationProjectionStore,
			relationshipPathIndex,
			relationshipCandidateInventory,
		}),
	);
	const openapiDocument = stage("openapi-document", () =>
		readFileSync15(resolve2(apiRoot2, "openapi.yaml"), "utf8"),
	);
	const operationMatcher = stage("openapi-operation-matcher", () =>
		createOperationMatcher(
			readOperations(apiRoot2, openapiDocument).operations,
		),
	);
	const validationReport = stage("validation-report", () =>
		readValidationReport(apiRoot2),
	);
	const terrainAsyncProvider = stage("terrain-async-provider", () =>
		createTerrainAsyncProvider(options),
	);
	const lookupManifest = stage("lookup-manifest", () =>
		readLookupManifest(apiRoot2),
	);
	const measureObservations = stage("measure-observations", () =>
		readMeasureObservations(apiRoot2, dataCatalog),
	);
	const measureCompatibilityInventory = stage("measure-compatibility", () =>
		readMeasureCompatibility(apiRoot2),
	);
	return {
		openapiDocument,
		operationMatcher,
		boundaryRegistry,
		geographyInventory,
		areaInventory,
		geographyResolver,
		relationshipPathInventory,
		crosswalkInventory,
		atlasRelease,
		documents,
		relationshipCandidateInventory,
		validationReport,
		namedLocationInventory,
		locationProjectionInventory,
		locationProjectionStore,
		dataCatalog,
		terrainCatalogue,
		terrainProvider: void 0,
		terrainAsyncProvider,
		exportManifest,
		lookupManifest,
		mapResources,
		...mapAssets,
		measureObservations,
		measureCompatibilityInventory,
		analysisGeographyInventory,
		analysisGeographyValidationInventory,
	};
};

// scripts/profile-startup.ts
var apiRoot = resolve3(import.meta.dirname, "..");
var started = performance2.now();
var before = process.memoryUsage();
var stages = [];
var catalogues = readApiCatalogues(apiRoot, {
	onStage: (stage, milliseconds) => {
		stages.push({ stage, milliseconds, memory: process.memoryUsage() });
	},
});
var totalMilliseconds = performance2.now() - started;
var after = process.memoryUsage();
var heapSnapshotPath =
	process.env.ATLAS_HEAP_SNAPSHOT === "off"
		? null
		: writeHeapSnapshot(
				process.env.ATLAS_HEAP_SNAPSHOT_PATH ??
					join10(
						tmpdir(),
						`uk-data-atlas-startup-${process.pid}.heapsnapshot`,
					),
			);
var change = (from, to) => ({
	rssBytes: to.rss - from.rss,
	heapTotalBytes: to.heapTotal - from.heapTotal,
	heapUsedBytes: to.heapUsed - from.heapUsed,
	externalBytes: to.external - from.external,
	arrayBuffersBytes: to.arrayBuffers - from.arrayBuffers,
});
console.log(
	JSON.stringify(
		{
			releaseId: catalogues.atlasRelease.releaseId,
			totalMilliseconds,
			memoryBefore: before,
			memoryAfter: after,
			memoryIncrease: change(before, after),
			stages: stages.map(({ stage, milliseconds, memory }, index) => {
				const previous = stages[index - 1]?.memory ?? before;
				return {
					stage,
					milliseconds,
					memoryIncrease: change(before, memory),
					stageMemoryIncrease: change(previous, memory),
				};
			}),
			heapSnapshotPath,
		},
		null,
		2,
	),
);
//# sourceMappingURL=profile-startup.mjs.map
