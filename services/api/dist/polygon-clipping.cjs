"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
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

// ../../node_modules/.pnpm/splaytree@3.2.3/node_modules/splaytree/dist/splaytree.umd.cjs
var require_splaytree_umd = __commonJS({
	"../../node_modules/.pnpm/splaytree@3.2.3/node_modules/splaytree/dist/splaytree.umd.cjs"(
		exports2,
		module2,
	) {
		(function (h, c) {
			typeof exports2 == "object" && typeof module2 < "u"
				? (module2.exports = c())
				: typeof define == "function" && define.amd
					? define(c)
					: ((h = typeof globalThis < "u" ? globalThis : h || self),
						(h.SplayTree = c()));
		})(exports2, function () {
			"use strict";
			class h {
				constructor(t, e) {
					((this.next = null),
						(this.key = t),
						(this.data = e),
						(this.left = null),
						(this.right = null));
				}
			}
			function c(n, t) {
				return n > t ? 1 : n < t ? -1 : 0;
			}
			function u2(n, t, e) {
				const r = new h(null, null);
				let i = r,
					l = r;
				for (;;) {
					const o = e(n, t.key);
					if (o < 0) {
						if (t.left === null) break;
						if (e(n, t.left.key) < 0) {
							const s = t.left;
							if (
								((t.left = s.right),
								(s.right = t),
								(t = s),
								t.left === null)
							)
								break;
						}
						((l.left = t), (l = t), (t = t.left));
					} else if (o > 0) {
						if (t.right === null) break;
						if (e(n, t.right.key) > 0) {
							const s = t.right;
							if (
								((t.right = s.left),
								(s.left = t),
								(t = s),
								t.right === null)
							)
								break;
						}
						((i.right = t), (i = t), (t = t.right));
					} else break;
				}
				return (
					(i.right = t.left),
					(l.left = t.right),
					(t.left = r.right),
					(t.right = r.left),
					t
				);
			}
			function _(n, t, e, r) {
				const i = new h(n, t);
				if (e === null) return ((i.left = i.right = null), i);
				e = u2(n, e, r);
				const l = r(n, e.key);
				return (
					l < 0
						? ((i.left = e.left), (i.right = e), (e.left = null))
						: l >= 0 &&
							((i.right = e.right),
							(i.left = e),
							(e.right = null)),
					i
				);
			}
			function d(n, t, e) {
				let r = null,
					i = null;
				if (t) {
					t = u2(n, t, e);
					const l = e(t.key, n);
					l === 0
						? ((r = t.left), (i = t.right))
						: l < 0
							? ((i = t.right), (t.right = null), (r = t))
							: ((r = t.left), (t.left = null), (i = t));
				}
				return { left: r, right: i };
			}
			function w(n, t, e) {
				return t === null
					? n
					: (n === null || ((t = u2(n.key, t, e)), (t.left = n)), t);
			}
			function a(n, t, e, r, i) {
				if (n) {
					r(`${t}${e ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 "}${i(n)}
`);
					const l = t + (e ? "    " : "\u2502   ");
					(n.left && a(n.left, l, false, r, i),
						n.right && a(n.right, l, true, r, i));
				}
			}
			class x {
				constructor(t = c) {
					((this._root = null),
						(this._size = 0),
						(this._comparator = t));
				}
				insert(t, e) {
					return (
						this._size++,
						(this._root = _(t, e, this._root, this._comparator))
					);
				}
				add(t, e) {
					const r = new h(t, e);
					this._root === null &&
						((r.left = r.right = null),
						this._size++,
						(this._root = r));
					const i = this._comparator,
						l = u2(t, this._root, i),
						o = i(t, l.key);
					return (
						o === 0
							? (this._root = l)
							: (o < 0
									? ((r.left = l.left),
										(r.right = l),
										(l.left = null))
									: o > 0 &&
										((r.right = l.right),
										(r.left = l),
										(l.right = null)),
								this._size++,
								(this._root = r)),
						this._root
					);
				}
				remove(t) {
					this._root = this._remove(t, this._root, this._comparator);
				}
				_remove(t, e, r) {
					let i;
					return e === null
						? null
						: ((e = u2(t, e, r)),
							r(t, e.key) === 0
								? (e.left === null
										? (i = e.right)
										: ((i = u2(t, e.left, r)),
											(i.right = e.right)),
									this._size--,
									i)
								: e);
				}
				pop() {
					let t = this._root;
					if (t) {
						for (; t.left;) t = t.left;
						return (
							(this._root = u2(
								t.key,
								this._root,
								this._comparator,
							)),
							(this._root = this._remove(
								t.key,
								this._root,
								this._comparator,
							)),
							{ key: t.key, data: t.data }
						);
					}
					return null;
				}
				findStatic(t) {
					let e = this._root;
					const r = this._comparator;
					for (; e;) {
						const i = r(t, e.key);
						if (i === 0) return e;
						i < 0 ? (e = e.left) : (e = e.right);
					}
					return null;
				}
				find(t) {
					return this._root &&
						((this._root = u2(t, this._root, this._comparator)),
						this._comparator(t, this._root.key) !== 0)
						? null
						: this._root;
				}
				contains(t) {
					let e = this._root;
					const r = this._comparator;
					for (; e;) {
						const i = r(t, e.key);
						if (i === 0) return true;
						i < 0 ? (e = e.left) : (e = e.right);
					}
					return false;
				}
				forEach(t, e) {
					let r = this._root;
					const i = [];
					let l = false;
					for (; !l;)
						r !== null
							? (i.push(r), (r = r.left))
							: i.length !== 0
								? ((r = i.pop()), t.call(e, r), (r = r.right))
								: (l = true);
					return this;
				}
				range(t, e, r, i) {
					const l = [],
						o = this._comparator;
					let s = this._root,
						f;
					for (; l.length !== 0 || s;)
						if (s) (l.push(s), (s = s.left));
						else {
							if (((s = l.pop()), (f = o(s.key, e)), f > 0))
								break;
							if (o(s.key, t) >= 0 && r.call(i, s)) return this;
							s = s.right;
						}
					return this;
				}
				keys() {
					const t = [];
					return (
						this.forEach(({ key: e }) => {
							t.push(e);
						}),
						t
					);
				}
				values() {
					const t = [];
					return (
						this.forEach(({ data: e }) => {
							t.push(e);
						}),
						t
					);
				}
				min() {
					return this._root ? this.minNode(this._root).key : null;
				}
				max() {
					return this._root ? this.maxNode(this._root).key : null;
				}
				minNode(t = this._root) {
					if (t) for (; t.left;) t = t.left;
					return t;
				}
				maxNode(t = this._root) {
					if (t) for (; t.right;) t = t.right;
					return t;
				}
				at(t) {
					let e = this._root,
						r = false,
						i = 0;
					const l = [];
					for (; !r;)
						if (e) (l.push(e), (e = e.left));
						else if (l.length > 0) {
							if (((e = l.pop()), i === t)) return e;
							(i++, (e = e.right));
						} else r = true;
					return null;
				}
				next(t) {
					let e = this._root,
						r = null;
					if (t.right) {
						for (r = t.right; r.left;) r = r.left;
						return r;
					}
					const i = this._comparator;
					for (; e;) {
						const l = i(t.key, e.key);
						if (l === 0) break;
						l < 0 ? ((r = e), (e = e.left)) : (e = e.right);
					}
					return r;
				}
				prev(t) {
					let e = this._root,
						r = null;
					if (t.left !== null) {
						for (r = t.left; r.right;) r = r.right;
						return r;
					}
					const i = this._comparator;
					for (; e;) {
						const l = i(t.key, e.key);
						if (l === 0) break;
						l < 0 ? (e = e.left) : ((r = e), (e = e.right));
					}
					return r;
				}
				clear() {
					return ((this._root = null), (this._size = 0), this);
				}
				toList() {
					return y(this._root);
				}
				load(t, e = [], r = false) {
					let i = t.length;
					const l = this._comparator;
					if ((r && m(t, e, 0, i - 1, l), this._root === null))
						((this._root = p(t, e, 0, i)), (this._size = i));
					else {
						const o = z(this.toList(), k(t, e), l);
						((i = this._size + i),
							(this._root = g({ head: o }, 0, i)));
					}
					return this;
				}
				isEmpty() {
					return this._root === null;
				}
				get size() {
					return this._size;
				}
				get root() {
					return this._root;
				}
				toString(t = (e) => String(e.key)) {
					const e = [];
					return (
						a(this._root, "", true, (r) => e.push(r), t),
						e.join("")
					);
				}
				update(t, e, r) {
					const i = this._comparator;
					let { left: l, right: o } = d(t, this._root, i);
					(i(t, e) < 0 ? (o = _(e, r, o, i)) : (l = _(e, r, l, i)),
						(this._root = w(l, o, i)));
				}
				split(t) {
					return d(t, this._root, this._comparator);
				}
				*[Symbol.iterator]() {
					let t = this._root;
					const e = [];
					let r = false;
					for (; !r;)
						t !== null
							? (e.push(t), (t = t.left))
							: e.length !== 0
								? ((t = e.pop()), yield t, (t = t.right))
								: (r = true);
				}
			}
			function p(n, t, e, r) {
				const i = r - e;
				if (i > 0) {
					const l = e + Math.floor(i / 2),
						o = n[l],
						s = t[l],
						f = new h(o, s);
					return (
						(f.left = p(n, t, e, l)),
						(f.right = p(n, t, l + 1, r)),
						f
					);
				}
				return null;
			}
			function k(n, t) {
				const e = new h(null, null);
				let r = e;
				for (let i = 0; i < n.length; i++)
					r = r.next = new h(n[i], t[i]);
				return ((r.next = null), e.next);
			}
			function y(n) {
				let t = n;
				const e = [];
				let r = false;
				const i = new h(null, null);
				let l = i;
				for (; !r;)
					t
						? (e.push(t), (t = t.left))
						: e.length > 0
							? ((t = l = l.next = e.pop()), (t = t.right))
							: (r = true);
				return ((l.next = null), i.next);
			}
			function g(n, t, e) {
				const r = e - t;
				if (r > 0) {
					const i = t + Math.floor(r / 2),
						l = g(n, t, i),
						o = n.head;
					return (
						(o.left = l),
						(n.head = n.head.next),
						(o.right = g(n, i + 1, e)),
						o
					);
				}
				return null;
			}
			function z(n, t, e) {
				const r = new h(null, null);
				let i = r,
					l = n,
					o = t;
				for (; l !== null && o !== null;)
					(e(l.key, o.key) < 0
						? ((i.next = l), (l = l.next))
						: ((i.next = o), (o = o.next)),
						(i = i.next));
				return (
					l !== null ? (i.next = l) : o !== null && (i.next = o),
					r.next
				);
			}
			function m(n, t, e, r, i) {
				if (e >= r) return;
				const l = n[(e + r) >> 1];
				let o = e - 1,
					s = r + 1;
				for (;;) {
					do o++;
					while (i(n[o], l) < 0);
					do s--;
					while (i(n[s], l) > 0);
					if (o >= s) break;
					let f = n[o];
					((n[o] = n[s]),
						(n[s] = f),
						(f = t[o]),
						(t[o] = t[s]),
						(t[s] = f));
				}
				(m(n, t, e, s, i), m(n, t, s + 1, r, i));
			}
			return x;
		});
	},
});

// ../../node_modules/.pnpm/polygon-clipping@0.15.7/node_modules/polygon-clipping/dist/polygon-clipping.cjs.js
var SplayTree = require_splaytree_umd();
function _interopDefaultLegacy(e) {
	return e && typeof e === "object" && "default" in e ? e : { default: e };
}
var SplayTree__default = /* @__PURE__ */ _interopDefaultLegacy(SplayTree);
var isInBbox = (bbox, point) => {
	return (
		bbox.ll.x <= point.x &&
		point.x <= bbox.ur.x &&
		bbox.ll.y <= point.y &&
		point.y <= bbox.ur.y
	);
};
var getBboxOverlap = (b1, b2) => {
	if (
		b2.ur.x < b1.ll.x ||
		b1.ur.x < b2.ll.x ||
		b2.ur.y < b1.ll.y ||
		b1.ur.y < b2.ll.y
	)
		return null;
	const lowerX = b1.ll.x < b2.ll.x ? b2.ll.x : b1.ll.x;
	const upperX = b1.ur.x < b2.ur.x ? b1.ur.x : b2.ur.x;
	const lowerY = b1.ll.y < b2.ll.y ? b2.ll.y : b1.ll.y;
	const upperY = b1.ur.y < b2.ur.y ? b1.ur.y : b2.ur.y;
	return {
		ll: {
			x: lowerX,
			y: lowerY,
		},
		ur: {
			x: upperX,
			y: upperY,
		},
	};
};
var epsilon$1 = Number.EPSILON;
if (epsilon$1 === void 0) epsilon$1 = Math.pow(2, -52);
var EPSILON_SQ = epsilon$1 * epsilon$1;
var cmp = (a, b) => {
	if (-epsilon$1 < a && a < epsilon$1) {
		if (-epsilon$1 < b && b < epsilon$1) {
			return 0;
		}
	}
	const ab = a - b;
	if (ab * ab < EPSILON_SQ * a * b) {
		return 0;
	}
	return a < b ? -1 : 1;
};
var PtRounder = class {
	constructor() {
		this.reset();
	}
	reset() {
		this.xRounder = new CoordRounder();
		this.yRounder = new CoordRounder();
	}
	round(x, y) {
		return {
			x: this.xRounder.round(x),
			y: this.yRounder.round(y),
		};
	}
};
var CoordRounder = class {
	constructor() {
		this.tree = new SplayTree__default["default"]();
		this.round(0);
	}
	// Note: this can rounds input values backwards or forwards.
	//       You might ask, why not restrict this to just rounding
	//       forwards? Wouldn't that allow left endpoints to always
	//       remain left endpoints during splitting (never change to
	//       right). No - it wouldn't, because we snap intersections
	//       to endpoints (to establish independence from the segment
	//       angle for t-intersections).
	round(coord) {
		const node = this.tree.add(coord);
		const prevNode = this.tree.prev(node);
		if (prevNode !== null && cmp(node.key, prevNode.key) === 0) {
			this.tree.remove(coord);
			return prevNode.key;
		}
		const nextNode = this.tree.next(node);
		if (nextNode !== null && cmp(node.key, nextNode.key) === 0) {
			this.tree.remove(coord);
			return nextNode.key;
		}
		return coord;
	}
};
var rounder = new PtRounder();
var epsilon = 11102230246251565e-32;
var splitter = 134217729;
var resulterrbound = (3 + 8 * epsilon) * epsilon;
function sum(elen, e, flen, f, h) {
	let Q, Qnew, hh, bvirt;
	let enow = e[0];
	let fnow = f[0];
	let eindex = 0;
	let findex = 0;
	if (fnow > enow === fnow > -enow) {
		Q = enow;
		enow = e[++eindex];
	} else {
		Q = fnow;
		fnow = f[++findex];
	}
	let hindex = 0;
	if (eindex < elen && findex < flen) {
		if (fnow > enow === fnow > -enow) {
			Qnew = enow + Q;
			hh = Q - (Qnew - enow);
			enow = e[++eindex];
		} else {
			Qnew = fnow + Q;
			hh = Q - (Qnew - fnow);
			fnow = f[++findex];
		}
		Q = Qnew;
		if (hh !== 0) {
			h[hindex++] = hh;
		}
		while (eindex < elen && findex < flen) {
			if (fnow > enow === fnow > -enow) {
				Qnew = Q + enow;
				bvirt = Qnew - Q;
				hh = Q - (Qnew - bvirt) + (enow - bvirt);
				enow = e[++eindex];
			} else {
				Qnew = Q + fnow;
				bvirt = Qnew - Q;
				hh = Q - (Qnew - bvirt) + (fnow - bvirt);
				fnow = f[++findex];
			}
			Q = Qnew;
			if (hh !== 0) {
				h[hindex++] = hh;
			}
		}
	}
	while (eindex < elen) {
		Qnew = Q + enow;
		bvirt = Qnew - Q;
		hh = Q - (Qnew - bvirt) + (enow - bvirt);
		enow = e[++eindex];
		Q = Qnew;
		if (hh !== 0) {
			h[hindex++] = hh;
		}
	}
	while (findex < flen) {
		Qnew = Q + fnow;
		bvirt = Qnew - Q;
		hh = Q - (Qnew - bvirt) + (fnow - bvirt);
		fnow = f[++findex];
		Q = Qnew;
		if (hh !== 0) {
			h[hindex++] = hh;
		}
	}
	if (Q !== 0 || hindex === 0) {
		h[hindex++] = Q;
	}
	return hindex;
}
function estimate(elen, e) {
	let Q = e[0];
	for (let i = 1; i < elen; i++) Q += e[i];
	return Q;
}
function vec(n) {
	return new Float64Array(n);
}
var ccwerrboundA = (3 + 16 * epsilon) * epsilon;
var ccwerrboundB = (2 + 12 * epsilon) * epsilon;
var ccwerrboundC = (9 + 64 * epsilon) * epsilon * epsilon;
var B = vec(4);
var C1 = vec(8);
var C2 = vec(12);
var D = vec(16);
var u = vec(4);
function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
	let acxtail, acytail, bcxtail, bcytail;
	let bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u3;
	const acx = ax - cx;
	const bcx = bx - cx;
	const acy = ay - cy;
	const bcy = by - cy;
	s1 = acx * bcy;
	c = splitter * acx;
	ahi = c - (c - acx);
	alo = acx - ahi;
	c = splitter * bcy;
	bhi = c - (c - bcy);
	blo = bcy - bhi;
	s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
	t1 = acy * bcx;
	c = splitter * acy;
	ahi = c - (c - acy);
	alo = acy - ahi;
	c = splitter * bcx;
	bhi = c - (c - bcx);
	blo = bcx - bhi;
	t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
	_i = s0 - t0;
	bvirt = s0 - _i;
	B[0] = s0 - (_i + bvirt) + (bvirt - t0);
	_j = s1 + _i;
	bvirt = _j - s1;
	_0 = s1 - (_j - bvirt) + (_i - bvirt);
	_i = _0 - t1;
	bvirt = _0 - _i;
	B[1] = _0 - (_i + bvirt) + (bvirt - t1);
	u3 = _j + _i;
	bvirt = u3 - _j;
	B[2] = _j - (u3 - bvirt) + (_i - bvirt);
	B[3] = u3;
	let det = estimate(4, B);
	let errbound = ccwerrboundB * detsum;
	if (det >= errbound || -det >= errbound) {
		return det;
	}
	bvirt = ax - acx;
	acxtail = ax - (acx + bvirt) + (bvirt - cx);
	bvirt = bx - bcx;
	bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
	bvirt = ay - acy;
	acytail = ay - (acy + bvirt) + (bvirt - cy);
	bvirt = by - bcy;
	bcytail = by - (bcy + bvirt) + (bvirt - cy);
	if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) {
		return det;
	}
	errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
	det += acx * bcytail + bcy * acxtail - (acy * bcxtail + bcx * acytail);
	if (det >= errbound || -det >= errbound) return det;
	s1 = acxtail * bcy;
	c = splitter * acxtail;
	ahi = c - (c - acxtail);
	alo = acxtail - ahi;
	c = splitter * bcy;
	bhi = c - (c - bcy);
	blo = bcy - bhi;
	s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
	t1 = acytail * bcx;
	c = splitter * acytail;
	ahi = c - (c - acytail);
	alo = acytail - ahi;
	c = splitter * bcx;
	bhi = c - (c - bcx);
	blo = bcx - bhi;
	t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
	_i = s0 - t0;
	bvirt = s0 - _i;
	u[0] = s0 - (_i + bvirt) + (bvirt - t0);
	_j = s1 + _i;
	bvirt = _j - s1;
	_0 = s1 - (_j - bvirt) + (_i - bvirt);
	_i = _0 - t1;
	bvirt = _0 - _i;
	u[1] = _0 - (_i + bvirt) + (bvirt - t1);
	u3 = _j + _i;
	bvirt = u3 - _j;
	u[2] = _j - (u3 - bvirt) + (_i - bvirt);
	u[3] = u3;
	const C1len = sum(4, B, 4, u, C1);
	s1 = acx * bcytail;
	c = splitter * acx;
	ahi = c - (c - acx);
	alo = acx - ahi;
	c = splitter * bcytail;
	bhi = c - (c - bcytail);
	blo = bcytail - bhi;
	s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
	t1 = acy * bcxtail;
	c = splitter * acy;
	ahi = c - (c - acy);
	alo = acy - ahi;
	c = splitter * bcxtail;
	bhi = c - (c - bcxtail);
	blo = bcxtail - bhi;
	t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
	_i = s0 - t0;
	bvirt = s0 - _i;
	u[0] = s0 - (_i + bvirt) + (bvirt - t0);
	_j = s1 + _i;
	bvirt = _j - s1;
	_0 = s1 - (_j - bvirt) + (_i - bvirt);
	_i = _0 - t1;
	bvirt = _0 - _i;
	u[1] = _0 - (_i + bvirt) + (bvirt - t1);
	u3 = _j + _i;
	bvirt = u3 - _j;
	u[2] = _j - (u3 - bvirt) + (_i - bvirt);
	u[3] = u3;
	const C2len = sum(C1len, C1, 4, u, C2);
	s1 = acxtail * bcytail;
	c = splitter * acxtail;
	ahi = c - (c - acxtail);
	alo = acxtail - ahi;
	c = splitter * bcytail;
	bhi = c - (c - bcytail);
	blo = bcytail - bhi;
	s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
	t1 = acytail * bcxtail;
	c = splitter * acytail;
	ahi = c - (c - acytail);
	alo = acytail - ahi;
	c = splitter * bcxtail;
	bhi = c - (c - bcxtail);
	blo = bcxtail - bhi;
	t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
	_i = s0 - t0;
	bvirt = s0 - _i;
	u[0] = s0 - (_i + bvirt) + (bvirt - t0);
	_j = s1 + _i;
	bvirt = _j - s1;
	_0 = s1 - (_j - bvirt) + (_i - bvirt);
	_i = _0 - t1;
	bvirt = _0 - _i;
	u[1] = _0 - (_i + bvirt) + (bvirt - t1);
	u3 = _j + _i;
	bvirt = u3 - _j;
	u[2] = _j - (u3 - bvirt) + (_i - bvirt);
	u[3] = u3;
	const Dlen = sum(C2len, C2, 4, u, D);
	return D[Dlen - 1];
}
function orient2d(ax, ay, bx, by, cx, cy) {
	const detleft = (ay - cy) * (bx - cx);
	const detright = (ax - cx) * (by - cy);
	const det = detleft - detright;
	const detsum = Math.abs(detleft + detright);
	if (Math.abs(det) >= ccwerrboundA * detsum) return det;
	return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
}
var crossProduct = (a, b) => a.x * b.y - a.y * b.x;
var dotProduct = (a, b) => a.x * b.x + a.y * b.y;
var compareVectorAngles = (basePt, endPt1, endPt2) => {
	const res = orient2d(
		basePt.x,
		basePt.y,
		endPt1.x,
		endPt1.y,
		endPt2.x,
		endPt2.y,
	);
	if (res > 0) return -1;
	if (res < 0) return 1;
	return 0;
};
var length = (v) => Math.sqrt(dotProduct(v, v));
var sineOfAngle = (pShared, pBase, pAngle) => {
	const vBase = {
		x: pBase.x - pShared.x,
		y: pBase.y - pShared.y,
	};
	const vAngle = {
		x: pAngle.x - pShared.x,
		y: pAngle.y - pShared.y,
	};
	return crossProduct(vAngle, vBase) / length(vAngle) / length(vBase);
};
var cosineOfAngle = (pShared, pBase, pAngle) => {
	const vBase = {
		x: pBase.x - pShared.x,
		y: pBase.y - pShared.y,
	};
	const vAngle = {
		x: pAngle.x - pShared.x,
		y: pAngle.y - pShared.y,
	};
	return dotProduct(vAngle, vBase) / length(vAngle) / length(vBase);
};
var horizontalIntersection = (pt, v, y) => {
	if (v.y === 0) return null;
	return {
		x: pt.x + (v.x / v.y) * (y - pt.y),
		y,
	};
};
var verticalIntersection = (pt, v, x) => {
	if (v.x === 0) return null;
	return {
		x,
		y: pt.y + (v.y / v.x) * (x - pt.x),
	};
};
var intersection$1 = (pt1, v1, pt2, v2) => {
	if (v1.x === 0) return verticalIntersection(pt2, v2, pt1.x);
	if (v2.x === 0) return verticalIntersection(pt1, v1, pt2.x);
	if (v1.y === 0) return horizontalIntersection(pt2, v2, pt1.y);
	if (v2.y === 0) return horizontalIntersection(pt1, v1, pt2.y);
	const kross = crossProduct(v1, v2);
	if (kross == 0) return null;
	const ve = {
		x: pt2.x - pt1.x,
		y: pt2.y - pt1.y,
	};
	const d1 = crossProduct(ve, v1) / kross;
	const d2 = crossProduct(ve, v2) / kross;
	const x1 = pt1.x + d2 * v1.x,
		x2 = pt2.x + d1 * v2.x;
	const y1 = pt1.y + d2 * v1.y,
		y2 = pt2.y + d1 * v2.y;
	const x = (x1 + x2) / 2;
	const y = (y1 + y2) / 2;
	return {
		x,
		y,
	};
};
var SweepEvent = class _SweepEvent {
	// for ordering sweep events in the sweep event queue
	static compare(a, b) {
		const ptCmp = _SweepEvent.comparePoints(a.point, b.point);
		if (ptCmp !== 0) return ptCmp;
		if (a.point !== b.point) a.link(b);
		if (a.isLeft !== b.isLeft) return a.isLeft ? 1 : -1;
		return Segment.compare(a.segment, b.segment);
	}
	// for ordering points in sweep line order
	static comparePoints(aPt, bPt) {
		if (aPt.x < bPt.x) return -1;
		if (aPt.x > bPt.x) return 1;
		if (aPt.y < bPt.y) return -1;
		if (aPt.y > bPt.y) return 1;
		return 0;
	}
	// Warning: 'point' input will be modified and re-used (for performance)
	constructor(point, isLeft) {
		if (point.events === void 0) point.events = [this];
		else point.events.push(this);
		this.point = point;
		this.isLeft = isLeft;
	}
	link(other) {
		if (other.point === this.point) {
			throw new Error("Tried to link already linked events");
		}
		const otherEvents = other.point.events;
		for (let i = 0, iMax = otherEvents.length; i < iMax; i++) {
			const evt = otherEvents[i];
			this.point.events.push(evt);
			evt.point = this.point;
		}
		this.checkForConsuming();
	}
	/* Do a pass over our linked events and check to see if any pair
	 * of segments match, and should be consumed. */
	checkForConsuming() {
		const numEvents = this.point.events.length;
		for (let i = 0; i < numEvents; i++) {
			const evt1 = this.point.events[i];
			if (evt1.segment.consumedBy !== void 0) continue;
			for (let j = i + 1; j < numEvents; j++) {
				const evt2 = this.point.events[j];
				if (evt2.consumedBy !== void 0) continue;
				if (evt1.otherSE.point.events !== evt2.otherSE.point.events)
					continue;
				evt1.segment.consume(evt2.segment);
			}
		}
	}
	getAvailableLinkedEvents() {
		const events = [];
		for (let i = 0, iMax = this.point.events.length; i < iMax; i++) {
			const evt = this.point.events[i];
			if (
				evt !== this &&
				!evt.segment.ringOut &&
				evt.segment.isInResult()
			) {
				events.push(evt);
			}
		}
		return events;
	}
	/**
	 * Returns a comparator function for sorting linked events that will
	 * favor the event that will give us the smallest left-side angle.
	 * All ring construction starts as low as possible heading to the right,
	 * so by always turning left as sharp as possible we'll get polygons
	 * without uncessary loops & holes.
	 *
	 * The comparator function has a compute cache such that it avoids
	 * re-computing already-computed values.
	 */
	getLeftmostComparator(baseEvent) {
		const cache = /* @__PURE__ */ new Map();
		const fillCache = (linkedEvent) => {
			const nextEvent = linkedEvent.otherSE;
			cache.set(linkedEvent, {
				sine: sineOfAngle(this.point, baseEvent.point, nextEvent.point),
				cosine: cosineOfAngle(
					this.point,
					baseEvent.point,
					nextEvent.point,
				),
			});
		};
		return (a, b) => {
			if (!cache.has(a)) fillCache(a);
			if (!cache.has(b)) fillCache(b);
			const { sine: asine, cosine: acosine } = cache.get(a);
			const { sine: bsine, cosine: bcosine } = cache.get(b);
			if (asine >= 0 && bsine >= 0) {
				if (acosine < bcosine) return 1;
				if (acosine > bcosine) return -1;
				return 0;
			}
			if (asine < 0 && bsine < 0) {
				if (acosine < bcosine) return -1;
				if (acosine > bcosine) return 1;
				return 0;
			}
			if (bsine < asine) return -1;
			if (bsine > asine) return 1;
			return 0;
		};
	}
};
var segmentId = 0;
var Segment = class _Segment {
	/* This compare() function is for ordering segments in the sweep
	 * line tree, and does so according to the following criteria:
	 *
	 * Consider the vertical line that lies an infinestimal step to the
	 * right of the right-more of the two left endpoints of the input
	 * segments. Imagine slowly moving a point up from negative infinity
	 * in the increasing y direction. Which of the two segments will that
	 * point intersect first? That segment comes 'before' the other one.
	 *
	 * If neither segment would be intersected by such a line, (if one
	 * or more of the segments are vertical) then the line to be considered
	 * is directly on the right-more of the two left inputs.
	 */
	static compare(a, b) {
		const alx = a.leftSE.point.x;
		const blx = b.leftSE.point.x;
		const arx = a.rightSE.point.x;
		const brx = b.rightSE.point.x;
		if (brx < alx) return 1;
		if (arx < blx) return -1;
		const aly = a.leftSE.point.y;
		const bly = b.leftSE.point.y;
		const ary = a.rightSE.point.y;
		const bry = b.rightSE.point.y;
		if (alx < blx) {
			if (bly < aly && bly < ary) return 1;
			if (bly > aly && bly > ary) return -1;
			const aCmpBLeft = a.comparePoint(b.leftSE.point);
			if (aCmpBLeft < 0) return 1;
			if (aCmpBLeft > 0) return -1;
			const bCmpARight = b.comparePoint(a.rightSE.point);
			if (bCmpARight !== 0) return bCmpARight;
			return -1;
		}
		if (alx > blx) {
			if (aly < bly && aly < bry) return -1;
			if (aly > bly && aly > bry) return 1;
			const bCmpALeft = b.comparePoint(a.leftSE.point);
			if (bCmpALeft !== 0) return bCmpALeft;
			const aCmpBRight = a.comparePoint(b.rightSE.point);
			if (aCmpBRight < 0) return 1;
			if (aCmpBRight > 0) return -1;
			return 1;
		}
		if (aly < bly) return -1;
		if (aly > bly) return 1;
		if (arx < brx) {
			const bCmpARight = b.comparePoint(a.rightSE.point);
			if (bCmpARight !== 0) return bCmpARight;
		}
		if (arx > brx) {
			const aCmpBRight = a.comparePoint(b.rightSE.point);
			if (aCmpBRight < 0) return 1;
			if (aCmpBRight > 0) return -1;
		}
		if (arx !== brx) {
			const ay = ary - aly;
			const ax = arx - alx;
			const by = bry - bly;
			const bx = brx - blx;
			if (ay > ax && by < bx) return 1;
			if (ay < ax && by > bx) return -1;
		}
		if (arx > brx) return 1;
		if (arx < brx) return -1;
		if (ary < bry) return -1;
		if (ary > bry) return 1;
		if (a.id < b.id) return -1;
		if (a.id > b.id) return 1;
		return 0;
	}
	/* Warning: a reference to ringWindings input will be stored,
	 *  and possibly will be later modified */
	constructor(leftSE, rightSE, rings, windings) {
		this.id = ++segmentId;
		this.leftSE = leftSE;
		leftSE.segment = this;
		leftSE.otherSE = rightSE;
		this.rightSE = rightSE;
		rightSE.segment = this;
		rightSE.otherSE = leftSE;
		this.rings = rings;
		this.windings = windings;
	}
	static fromRing(pt1, pt2, ring) {
		let leftPt, rightPt, winding;
		const cmpPts = SweepEvent.comparePoints(pt1, pt2);
		if (cmpPts < 0) {
			leftPt = pt1;
			rightPt = pt2;
			winding = 1;
		} else if (cmpPts > 0) {
			leftPt = pt2;
			rightPt = pt1;
			winding = -1;
		} else
			throw new Error(
				`Tried to create degenerate segment at [${pt1.x}, ${pt1.y}]`,
			);
		const leftSE = new SweepEvent(leftPt, true);
		const rightSE = new SweepEvent(rightPt, false);
		return new _Segment(leftSE, rightSE, [ring], [winding]);
	}
	/* When a segment is split, the rightSE is replaced with a new sweep event */
	replaceRightSE(newRightSE) {
		this.rightSE = newRightSE;
		this.rightSE.segment = this;
		this.rightSE.otherSE = this.leftSE;
		this.leftSE.otherSE = this.rightSE;
	}
	bbox() {
		const y1 = this.leftSE.point.y;
		const y2 = this.rightSE.point.y;
		return {
			ll: {
				x: this.leftSE.point.x,
				y: y1 < y2 ? y1 : y2,
			},
			ur: {
				x: this.rightSE.point.x,
				y: y1 > y2 ? y1 : y2,
			},
		};
	}
	/* A vector from the left point to the right */
	vector() {
		return {
			x: this.rightSE.point.x - this.leftSE.point.x,
			y: this.rightSE.point.y - this.leftSE.point.y,
		};
	}
	isAnEndpoint(pt) {
		return (
			(pt.x === this.leftSE.point.x && pt.y === this.leftSE.point.y) ||
			(pt.x === this.rightSE.point.x && pt.y === this.rightSE.point.y)
		);
	}
	/* Compare this segment with a point.
	 *
	 * A point P is considered to be colinear to a segment if there
	 * exists a distance D such that if we travel along the segment
	 * from one * endpoint towards the other a distance D, we find
	 * ourselves at point P.
	 *
	 * Return value indicates:
	 *
	 *   1: point lies above the segment (to the left of vertical)
	 *   0: point is colinear to segment
	 *  -1: point lies below the segment (to the right of vertical)
	 */
	comparePoint(point) {
		if (this.isAnEndpoint(point)) return 0;
		const lPt = this.leftSE.point;
		const rPt = this.rightSE.point;
		const v = this.vector();
		if (lPt.x === rPt.x) {
			if (point.x === lPt.x) return 0;
			return point.x < lPt.x ? 1 : -1;
		}
		const yDist = (point.y - lPt.y) / v.y;
		const xFromYDist = lPt.x + yDist * v.x;
		if (point.x === xFromYDist) return 0;
		const xDist = (point.x - lPt.x) / v.x;
		const yFromXDist = lPt.y + xDist * v.y;
		if (point.y === yFromXDist) return 0;
		return point.y < yFromXDist ? -1 : 1;
	}
	/**
	 * Given another segment, returns the first non-trivial intersection
	 * between the two segments (in terms of sweep line ordering), if it exists.
	 *
	 * A 'non-trivial' intersection is one that will cause one or both of the
	 * segments to be split(). As such, 'trivial' vs. 'non-trivial' intersection:
	 *
	 *   * endpoint of segA with endpoint of segB --> trivial
	 *   * endpoint of segA with point along segB --> non-trivial
	 *   * endpoint of segB with point along segA --> non-trivial
	 *   * point along segA with point along segB --> non-trivial
	 *
	 * If no non-trivial intersection exists, return null
	 * Else, return null.
	 */
	getIntersection(other) {
		const tBbox = this.bbox();
		const oBbox = other.bbox();
		const bboxOverlap = getBboxOverlap(tBbox, oBbox);
		if (bboxOverlap === null) return null;
		const tlp = this.leftSE.point;
		const trp = this.rightSE.point;
		const olp = other.leftSE.point;
		const orp = other.rightSE.point;
		const touchesOtherLSE =
			isInBbox(tBbox, olp) && this.comparePoint(olp) === 0;
		const touchesThisLSE =
			isInBbox(oBbox, tlp) && other.comparePoint(tlp) === 0;
		const touchesOtherRSE =
			isInBbox(tBbox, orp) && this.comparePoint(orp) === 0;
		const touchesThisRSE =
			isInBbox(oBbox, trp) && other.comparePoint(trp) === 0;
		if (touchesThisLSE && touchesOtherLSE) {
			if (touchesThisRSE && !touchesOtherRSE) return trp;
			if (!touchesThisRSE && touchesOtherRSE) return orp;
			return null;
		}
		if (touchesThisLSE) {
			if (touchesOtherRSE) {
				if (tlp.x === orp.x && tlp.y === orp.y) return null;
			}
			return tlp;
		}
		if (touchesOtherLSE) {
			if (touchesThisRSE) {
				if (trp.x === olp.x && trp.y === olp.y) return null;
			}
			return olp;
		}
		if (touchesThisRSE && touchesOtherRSE) return null;
		if (touchesThisRSE) return trp;
		if (touchesOtherRSE) return orp;
		const pt = intersection$1(tlp, this.vector(), olp, other.vector());
		if (pt === null) return null;
		if (!isInBbox(bboxOverlap, pt)) return null;
		return rounder.round(pt.x, pt.y);
	}
	/**
	 * Split the given segment into multiple segments on the given points.
	 *  * Each existing segment will retain its leftSE and a new rightSE will be
	 *    generated for it.
	 *  * A new segment will be generated which will adopt the original segment's
	 *    rightSE, and a new leftSE will be generated for it.
	 *  * If there are more than two points given to split on, new segments
	 *    in the middle will be generated with new leftSE and rightSE's.
	 *  * An array of the newly generated SweepEvents will be returned.
	 *
	 * Warning: input array of points is modified
	 */
	split(point) {
		const newEvents = [];
		const alreadyLinked = point.events !== void 0;
		const newLeftSE = new SweepEvent(point, true);
		const newRightSE = new SweepEvent(point, false);
		const oldRightSE = this.rightSE;
		this.replaceRightSE(newRightSE);
		newEvents.push(newRightSE);
		newEvents.push(newLeftSE);
		const newSeg = new _Segment(
			newLeftSE,
			oldRightSE,
			this.rings.slice(),
			this.windings.slice(),
		);
		if (
			SweepEvent.comparePoints(
				newSeg.leftSE.point,
				newSeg.rightSE.point,
			) > 0
		) {
			newSeg.swapEvents();
		}
		if (
			SweepEvent.comparePoints(this.leftSE.point, this.rightSE.point) > 0
		) {
			this.swapEvents();
		}
		if (alreadyLinked) {
			newLeftSE.checkForConsuming();
			newRightSE.checkForConsuming();
		}
		return newEvents;
	}
	/* Swap which event is left and right */
	swapEvents() {
		const tmpEvt = this.rightSE;
		this.rightSE = this.leftSE;
		this.leftSE = tmpEvt;
		this.leftSE.isLeft = true;
		this.rightSE.isLeft = false;
		for (let i = 0, iMax = this.windings.length; i < iMax; i++) {
			this.windings[i] *= -1;
		}
	}
	/* Consume another segment. We take their rings under our wing
	 * and mark them as consumed. Use for perfectly overlapping segments */
	consume(other) {
		let consumer = this;
		let consumee = other;
		while (consumer.consumedBy) consumer = consumer.consumedBy;
		while (consumee.consumedBy) consumee = consumee.consumedBy;
		const cmp2 = _Segment.compare(consumer, consumee);
		if (cmp2 === 0) return;
		if (cmp2 > 0) {
			const tmp = consumer;
			consumer = consumee;
			consumee = tmp;
		}
		if (consumer.prev === consumee) {
			const tmp = consumer;
			consumer = consumee;
			consumee = tmp;
		}
		for (let i = 0, iMax = consumee.rings.length; i < iMax; i++) {
			const ring = consumee.rings[i];
			const winding = consumee.windings[i];
			const index2 = consumer.rings.indexOf(ring);
			if (index2 === -1) {
				consumer.rings.push(ring);
				consumer.windings.push(winding);
			} else consumer.windings[index2] += winding;
		}
		consumee.rings = null;
		consumee.windings = null;
		consumee.consumedBy = consumer;
		consumee.leftSE.consumedBy = consumer.leftSE;
		consumee.rightSE.consumedBy = consumer.rightSE;
	}
	/* The first segment previous segment chain that is in the result */
	prevInResult() {
		if (this._prevInResult !== void 0) return this._prevInResult;
		if (!this.prev) this._prevInResult = null;
		else if (this.prev.isInResult()) this._prevInResult = this.prev;
		else this._prevInResult = this.prev.prevInResult();
		return this._prevInResult;
	}
	beforeState() {
		if (this._beforeState !== void 0) return this._beforeState;
		if (!this.prev)
			this._beforeState = {
				rings: [],
				windings: [],
				multiPolys: [],
			};
		else {
			const seg = this.prev.consumedBy || this.prev;
			this._beforeState = seg.afterState();
		}
		return this._beforeState;
	}
	afterState() {
		if (this._afterState !== void 0) return this._afterState;
		const beforeState = this.beforeState();
		this._afterState = {
			rings: beforeState.rings.slice(0),
			windings: beforeState.windings.slice(0),
			multiPolys: [],
		};
		const ringsAfter = this._afterState.rings;
		const windingsAfter = this._afterState.windings;
		const mpsAfter = this._afterState.multiPolys;
		for (let i = 0, iMax = this.rings.length; i < iMax; i++) {
			const ring = this.rings[i];
			const winding = this.windings[i];
			const index2 = ringsAfter.indexOf(ring);
			if (index2 === -1) {
				ringsAfter.push(ring);
				windingsAfter.push(winding);
			} else windingsAfter[index2] += winding;
		}
		const polysAfter = [];
		const polysExclude = [];
		for (let i = 0, iMax = ringsAfter.length; i < iMax; i++) {
			if (windingsAfter[i] === 0) continue;
			const ring = ringsAfter[i];
			const poly = ring.poly;
			if (polysExclude.indexOf(poly) !== -1) continue;
			if (ring.isExterior) polysAfter.push(poly);
			else {
				if (polysExclude.indexOf(poly) === -1) polysExclude.push(poly);
				const index2 = polysAfter.indexOf(ring.poly);
				if (index2 !== -1) polysAfter.splice(index2, 1);
			}
		}
		for (let i = 0, iMax = polysAfter.length; i < iMax; i++) {
			const mp = polysAfter[i].multiPoly;
			if (mpsAfter.indexOf(mp) === -1) mpsAfter.push(mp);
		}
		return this._afterState;
	}
	/* Is this segment part of the final result? */
	isInResult() {
		if (this.consumedBy) return false;
		if (this._isInResult !== void 0) return this._isInResult;
		const mpsBefore = this.beforeState().multiPolys;
		const mpsAfter = this.afterState().multiPolys;
		switch (operation.type) {
			case "union": {
				const noBefores = mpsBefore.length === 0;
				const noAfters = mpsAfter.length === 0;
				this._isInResult = noBefores !== noAfters;
				break;
			}
			case "intersection": {
				let least;
				let most;
				if (mpsBefore.length < mpsAfter.length) {
					least = mpsBefore.length;
					most = mpsAfter.length;
				} else {
					least = mpsAfter.length;
					most = mpsBefore.length;
				}
				this._isInResult =
					most === operation.numMultiPolys && least < most;
				break;
			}
			case "xor": {
				const diff = Math.abs(mpsBefore.length - mpsAfter.length);
				this._isInResult = diff % 2 === 1;
				break;
			}
			case "difference": {
				const isJustSubject = (mps) =>
					mps.length === 1 && mps[0].isSubject;
				this._isInResult =
					isJustSubject(mpsBefore) !== isJustSubject(mpsAfter);
				break;
			}
			default:
				throw new Error(
					`Unrecognized operation type found ${operation.type}`,
				);
		}
		return this._isInResult;
	}
};
var RingIn = class {
	constructor(geomRing, poly, isExterior) {
		if (!Array.isArray(geomRing) || geomRing.length === 0) {
			throw new Error(
				"Input geometry is not a valid Polygon or MultiPolygon",
			);
		}
		this.poly = poly;
		this.isExterior = isExterior;
		this.segments = [];
		if (
			typeof geomRing[0][0] !== "number" ||
			typeof geomRing[0][1] !== "number"
		) {
			throw new Error(
				"Input geometry is not a valid Polygon or MultiPolygon",
			);
		}
		const firstPoint = rounder.round(geomRing[0][0], geomRing[0][1]);
		this.bbox = {
			ll: {
				x: firstPoint.x,
				y: firstPoint.y,
			},
			ur: {
				x: firstPoint.x,
				y: firstPoint.y,
			},
		};
		let prevPoint = firstPoint;
		for (let i = 1, iMax = geomRing.length; i < iMax; i++) {
			if (
				typeof geomRing[i][0] !== "number" ||
				typeof geomRing[i][1] !== "number"
			) {
				throw new Error(
					"Input geometry is not a valid Polygon or MultiPolygon",
				);
			}
			let point = rounder.round(geomRing[i][0], geomRing[i][1]);
			if (point.x === prevPoint.x && point.y === prevPoint.y) continue;
			this.segments.push(Segment.fromRing(prevPoint, point, this));
			if (point.x < this.bbox.ll.x) this.bbox.ll.x = point.x;
			if (point.y < this.bbox.ll.y) this.bbox.ll.y = point.y;
			if (point.x > this.bbox.ur.x) this.bbox.ur.x = point.x;
			if (point.y > this.bbox.ur.y) this.bbox.ur.y = point.y;
			prevPoint = point;
		}
		if (firstPoint.x !== prevPoint.x || firstPoint.y !== prevPoint.y) {
			this.segments.push(Segment.fromRing(prevPoint, firstPoint, this));
		}
	}
	getSweepEvents() {
		const sweepEvents = [];
		for (let i = 0, iMax = this.segments.length; i < iMax; i++) {
			const segment = this.segments[i];
			sweepEvents.push(segment.leftSE);
			sweepEvents.push(segment.rightSE);
		}
		return sweepEvents;
	}
};
var PolyIn = class {
	constructor(geomPoly, multiPoly) {
		if (!Array.isArray(geomPoly)) {
			throw new Error(
				"Input geometry is not a valid Polygon or MultiPolygon",
			);
		}
		this.exteriorRing = new RingIn(geomPoly[0], this, true);
		this.bbox = {
			ll: {
				x: this.exteriorRing.bbox.ll.x,
				y: this.exteriorRing.bbox.ll.y,
			},
			ur: {
				x: this.exteriorRing.bbox.ur.x,
				y: this.exteriorRing.bbox.ur.y,
			},
		};
		this.interiorRings = [];
		for (let i = 1, iMax = geomPoly.length; i < iMax; i++) {
			const ring = new RingIn(geomPoly[i], this, false);
			if (ring.bbox.ll.x < this.bbox.ll.x)
				this.bbox.ll.x = ring.bbox.ll.x;
			if (ring.bbox.ll.y < this.bbox.ll.y)
				this.bbox.ll.y = ring.bbox.ll.y;
			if (ring.bbox.ur.x > this.bbox.ur.x)
				this.bbox.ur.x = ring.bbox.ur.x;
			if (ring.bbox.ur.y > this.bbox.ur.y)
				this.bbox.ur.y = ring.bbox.ur.y;
			this.interiorRings.push(ring);
		}
		this.multiPoly = multiPoly;
	}
	getSweepEvents() {
		const sweepEvents = this.exteriorRing.getSweepEvents();
		for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
			const ringSweepEvents = this.interiorRings[i].getSweepEvents();
			for (let j = 0, jMax = ringSweepEvents.length; j < jMax; j++) {
				sweepEvents.push(ringSweepEvents[j]);
			}
		}
		return sweepEvents;
	}
};
var MultiPolyIn = class {
	constructor(geom, isSubject) {
		if (!Array.isArray(geom)) {
			throw new Error(
				"Input geometry is not a valid Polygon or MultiPolygon",
			);
		}
		try {
			if (typeof geom[0][0][0] === "number") geom = [geom];
		} catch (ex) {}
		this.polys = [];
		this.bbox = {
			ll: {
				x: Number.POSITIVE_INFINITY,
				y: Number.POSITIVE_INFINITY,
			},
			ur: {
				x: Number.NEGATIVE_INFINITY,
				y: Number.NEGATIVE_INFINITY,
			},
		};
		for (let i = 0, iMax = geom.length; i < iMax; i++) {
			const poly = new PolyIn(geom[i], this);
			if (poly.bbox.ll.x < this.bbox.ll.x)
				this.bbox.ll.x = poly.bbox.ll.x;
			if (poly.bbox.ll.y < this.bbox.ll.y)
				this.bbox.ll.y = poly.bbox.ll.y;
			if (poly.bbox.ur.x > this.bbox.ur.x)
				this.bbox.ur.x = poly.bbox.ur.x;
			if (poly.bbox.ur.y > this.bbox.ur.y)
				this.bbox.ur.y = poly.bbox.ur.y;
			this.polys.push(poly);
		}
		this.isSubject = isSubject;
	}
	getSweepEvents() {
		const sweepEvents = [];
		for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
			const polySweepEvents = this.polys[i].getSweepEvents();
			for (let j = 0, jMax = polySweepEvents.length; j < jMax; j++) {
				sweepEvents.push(polySweepEvents[j]);
			}
		}
		return sweepEvents;
	}
};
var RingOut = class _RingOut {
	/* Given the segments from the sweep line pass, compute & return a series
	 * of closed rings from all the segments marked to be part of the result */
	static factory(allSegments) {
		const ringsOut = [];
		for (let i = 0, iMax = allSegments.length; i < iMax; i++) {
			const segment = allSegments[i];
			if (!segment.isInResult() || segment.ringOut) continue;
			let prevEvent = null;
			let event = segment.leftSE;
			let nextEvent = segment.rightSE;
			const events = [event];
			const startingPoint = event.point;
			const intersectionLEs = [];
			while (true) {
				prevEvent = event;
				event = nextEvent;
				events.push(event);
				if (event.point === startingPoint) break;
				while (true) {
					const availableLEs = event.getAvailableLinkedEvents();
					if (availableLEs.length === 0) {
						const firstPt = events[0].point;
						const lastPt = events[events.length - 1].point;
						throw new Error(
							`Unable to complete output ring starting at [${firstPt.x}, ${firstPt.y}]. Last matching segment found ends at [${lastPt.x}, ${lastPt.y}].`,
						);
					}
					if (availableLEs.length === 1) {
						nextEvent = availableLEs[0].otherSE;
						break;
					}
					let indexLE = null;
					for (
						let j = 0, jMax = intersectionLEs.length;
						j < jMax;
						j++
					) {
						if (intersectionLEs[j].point === event.point) {
							indexLE = j;
							break;
						}
					}
					if (indexLE !== null) {
						const intersectionLE =
							intersectionLEs.splice(indexLE)[0];
						const ringEvents = events.splice(intersectionLE.index);
						ringEvents.unshift(ringEvents[0].otherSE);
						ringsOut.push(new _RingOut(ringEvents.reverse()));
						continue;
					}
					intersectionLEs.push({
						index: events.length,
						point: event.point,
					});
					const comparator = event.getLeftmostComparator(prevEvent);
					nextEvent = availableLEs.sort(comparator)[0].otherSE;
					break;
				}
			}
			ringsOut.push(new _RingOut(events));
		}
		return ringsOut;
	}
	constructor(events) {
		this.events = events;
		for (let i = 0, iMax = events.length; i < iMax; i++) {
			events[i].segment.ringOut = this;
		}
		this.poly = null;
	}
	getGeom() {
		let prevPt = this.events[0].point;
		const points = [prevPt];
		for (let i = 1, iMax = this.events.length - 1; i < iMax; i++) {
			const pt2 = this.events[i].point;
			const nextPt2 = this.events[i + 1].point;
			if (compareVectorAngles(pt2, prevPt, nextPt2) === 0) continue;
			points.push(pt2);
			prevPt = pt2;
		}
		if (points.length === 1) return null;
		const pt = points[0];
		const nextPt = points[1];
		if (compareVectorAngles(pt, prevPt, nextPt) === 0) points.shift();
		points.push(points[0]);
		const step = this.isExteriorRing() ? 1 : -1;
		const iStart = this.isExteriorRing() ? 0 : points.length - 1;
		const iEnd = this.isExteriorRing() ? points.length : -1;
		const orderedPoints = [];
		for (let i = iStart; i != iEnd; i += step)
			orderedPoints.push([points[i].x, points[i].y]);
		return orderedPoints;
	}
	isExteriorRing() {
		if (this._isExteriorRing === void 0) {
			const enclosing = this.enclosingRing();
			this._isExteriorRing = enclosing
				? !enclosing.isExteriorRing()
				: true;
		}
		return this._isExteriorRing;
	}
	enclosingRing() {
		if (this._enclosingRing === void 0) {
			this._enclosingRing = this._calcEnclosingRing();
		}
		return this._enclosingRing;
	}
	/* Returns the ring that encloses this one, if any */
	_calcEnclosingRing() {
		let leftMostEvt = this.events[0];
		for (let i = 1, iMax = this.events.length; i < iMax; i++) {
			const evt = this.events[i];
			if (SweepEvent.compare(leftMostEvt, evt) > 0) leftMostEvt = evt;
		}
		let prevSeg = leftMostEvt.segment.prevInResult();
		let prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
		while (true) {
			if (!prevSeg) return null;
			if (!prevPrevSeg) return prevSeg.ringOut;
			if (prevPrevSeg.ringOut !== prevSeg.ringOut) {
				if (prevPrevSeg.ringOut.enclosingRing() !== prevSeg.ringOut) {
					return prevSeg.ringOut;
				} else return prevSeg.ringOut.enclosingRing();
			}
			prevSeg = prevPrevSeg.prevInResult();
			prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
		}
	}
};
var PolyOut = class {
	constructor(exteriorRing) {
		this.exteriorRing = exteriorRing;
		exteriorRing.poly = this;
		this.interiorRings = [];
	}
	addInterior(ring) {
		this.interiorRings.push(ring);
		ring.poly = this;
	}
	getGeom() {
		const geom = [this.exteriorRing.getGeom()];
		if (geom[0] === null) return null;
		for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
			const ringGeom = this.interiorRings[i].getGeom();
			if (ringGeom === null) continue;
			geom.push(ringGeom);
		}
		return geom;
	}
};
var MultiPolyOut = class {
	constructor(rings) {
		this.rings = rings;
		this.polys = this._composePolys(rings);
	}
	getGeom() {
		const geom = [];
		for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
			const polyGeom = this.polys[i].getGeom();
			if (polyGeom === null) continue;
			geom.push(polyGeom);
		}
		return geom;
	}
	_composePolys(rings) {
		const polys = [];
		for (let i = 0, iMax = rings.length; i < iMax; i++) {
			const ring = rings[i];
			if (ring.poly) continue;
			if (ring.isExteriorRing()) polys.push(new PolyOut(ring));
			else {
				const enclosingRing = ring.enclosingRing();
				if (!enclosingRing.poly) polys.push(new PolyOut(enclosingRing));
				enclosingRing.poly.addInterior(ring);
			}
		}
		return polys;
	}
};
var SweepLine = class {
	constructor(queue) {
		let comparator =
			arguments.length > 1 && arguments[1] !== void 0
				? arguments[1]
				: Segment.compare;
		this.queue = queue;
		this.tree = new SplayTree__default["default"](comparator);
		this.segments = [];
	}
	process(event) {
		const segment = event.segment;
		const newEvents = [];
		if (event.consumedBy) {
			if (event.isLeft) this.queue.remove(event.otherSE);
			else this.tree.remove(segment);
			return newEvents;
		}
		const node = event.isLeft
			? this.tree.add(segment)
			: this.tree.find(segment);
		if (!node)
			throw new Error(
				`Unable to find segment #${segment.id} [${segment.leftSE.point.x}, ${segment.leftSE.point.y}] -> [${segment.rightSE.point.x}, ${segment.rightSE.point.y}] in SweepLine tree.`,
			);
		let prevNode = node;
		let nextNode = node;
		let prevSeg = void 0;
		let nextSeg = void 0;
		while (prevSeg === void 0) {
			prevNode = this.tree.prev(prevNode);
			if (prevNode === null) prevSeg = null;
			else if (prevNode.key.consumedBy === void 0) prevSeg = prevNode.key;
		}
		while (nextSeg === void 0) {
			nextNode = this.tree.next(nextNode);
			if (nextNode === null) nextSeg = null;
			else if (nextNode.key.consumedBy === void 0) nextSeg = nextNode.key;
		}
		if (event.isLeft) {
			let prevMySplitter = null;
			if (prevSeg) {
				const prevInter = prevSeg.getIntersection(segment);
				if (prevInter !== null) {
					if (!segment.isAnEndpoint(prevInter))
						prevMySplitter = prevInter;
					if (!prevSeg.isAnEndpoint(prevInter)) {
						const newEventsFromSplit = this._splitSafely(
							prevSeg,
							prevInter,
						);
						for (
							let i = 0, iMax = newEventsFromSplit.length;
							i < iMax;
							i++
						) {
							newEvents.push(newEventsFromSplit[i]);
						}
					}
				}
			}
			let nextMySplitter = null;
			if (nextSeg) {
				const nextInter = nextSeg.getIntersection(segment);
				if (nextInter !== null) {
					if (!segment.isAnEndpoint(nextInter))
						nextMySplitter = nextInter;
					if (!nextSeg.isAnEndpoint(nextInter)) {
						const newEventsFromSplit = this._splitSafely(
							nextSeg,
							nextInter,
						);
						for (
							let i = 0, iMax = newEventsFromSplit.length;
							i < iMax;
							i++
						) {
							newEvents.push(newEventsFromSplit[i]);
						}
					}
				}
			}
			if (prevMySplitter !== null || nextMySplitter !== null) {
				let mySplitter = null;
				if (prevMySplitter === null) mySplitter = nextMySplitter;
				else if (nextMySplitter === null) mySplitter = prevMySplitter;
				else {
					const cmpSplitters = SweepEvent.comparePoints(
						prevMySplitter,
						nextMySplitter,
					);
					mySplitter =
						cmpSplitters <= 0 ? prevMySplitter : nextMySplitter;
				}
				this.queue.remove(segment.rightSE);
				newEvents.push(segment.rightSE);
				const newEventsFromSplit = segment.split(mySplitter);
				for (
					let i = 0, iMax = newEventsFromSplit.length;
					i < iMax;
					i++
				) {
					newEvents.push(newEventsFromSplit[i]);
				}
			}
			if (newEvents.length > 0) {
				this.tree.remove(segment);
				newEvents.push(event);
			} else {
				this.segments.push(segment);
				segment.prev = prevSeg;
			}
		} else {
			if (prevSeg && nextSeg) {
				const inter = prevSeg.getIntersection(nextSeg);
				if (inter !== null) {
					if (!prevSeg.isAnEndpoint(inter)) {
						const newEventsFromSplit = this._splitSafely(
							prevSeg,
							inter,
						);
						for (
							let i = 0, iMax = newEventsFromSplit.length;
							i < iMax;
							i++
						) {
							newEvents.push(newEventsFromSplit[i]);
						}
					}
					if (!nextSeg.isAnEndpoint(inter)) {
						const newEventsFromSplit = this._splitSafely(
							nextSeg,
							inter,
						);
						for (
							let i = 0, iMax = newEventsFromSplit.length;
							i < iMax;
							i++
						) {
							newEvents.push(newEventsFromSplit[i]);
						}
					}
				}
			}
			this.tree.remove(segment);
		}
		return newEvents;
	}
	/* Safely split a segment that is currently in the datastructures
	 * IE - a segment other than the one that is currently being processed. */
	_splitSafely(seg, pt) {
		this.tree.remove(seg);
		const rightSE = seg.rightSE;
		this.queue.remove(rightSE);
		const newEvents = seg.split(pt);
		newEvents.push(rightSE);
		if (seg.consumedBy === void 0) this.tree.add(seg);
		return newEvents;
	}
};
var POLYGON_CLIPPING_MAX_QUEUE_SIZE =
	(typeof process !== "undefined" &&
		process.env.POLYGON_CLIPPING_MAX_QUEUE_SIZE) ||
	1e6;
var POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS =
	(typeof process !== "undefined" &&
		process.env.POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS) ||
	1e6;
var Operation = class {
	run(type, geom, moreGeoms) {
		operation.type = type;
		rounder.reset();
		const multipolys = [new MultiPolyIn(geom, true)];
		for (let i = 0, iMax = moreGeoms.length; i < iMax; i++) {
			multipolys.push(new MultiPolyIn(moreGeoms[i], false));
		}
		operation.numMultiPolys = multipolys.length;
		if (operation.type === "difference") {
			const subject = multipolys[0];
			let i = 1;
			while (i < multipolys.length) {
				if (getBboxOverlap(multipolys[i].bbox, subject.bbox) !== null)
					i++;
				else multipolys.splice(i, 1);
			}
		}
		if (operation.type === "intersection") {
			for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
				const mpA = multipolys[i];
				for (let j = i + 1, jMax = multipolys.length; j < jMax; j++) {
					if (getBboxOverlap(mpA.bbox, multipolys[j].bbox) === null)
						return [];
				}
			}
		}
		const queue = new SplayTree__default["default"](SweepEvent.compare);
		for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
			const sweepEvents = multipolys[i].getSweepEvents();
			for (let j = 0, jMax = sweepEvents.length; j < jMax; j++) {
				queue.insert(sweepEvents[j]);
				if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
					throw new Error(
						"Infinite loop when putting segment endpoints in a priority queue (queue size too big).",
					);
				}
			}
		}
		const sweepLine = new SweepLine(queue);
		let prevQueueSize = queue.size;
		let node = queue.pop();
		while (node) {
			const evt = node.key;
			if (queue.size === prevQueueSize) {
				const seg = evt.segment;
				throw new Error(
					`Unable to pop() ${evt.isLeft ? "left" : "right"} SweepEvent [${evt.point.x}, ${evt.point.y}] from segment #${seg.id} [${seg.leftSE.point.x}, ${seg.leftSE.point.y}] -> [${seg.rightSE.point.x}, ${seg.rightSE.point.y}] from queue.`,
				);
			}
			if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
				throw new Error(
					"Infinite loop when passing sweep line over endpoints (queue size too big).",
				);
			}
			if (
				sweepLine.segments.length >
				POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS
			) {
				throw new Error(
					"Infinite loop when passing sweep line over endpoints (too many sweep line segments).",
				);
			}
			const newEvents = sweepLine.process(evt);
			for (let i = 0, iMax = newEvents.length; i < iMax; i++) {
				const evt2 = newEvents[i];
				if (evt2.consumedBy === void 0) queue.insert(evt2);
			}
			prevQueueSize = queue.size;
			node = queue.pop();
		}
		rounder.reset();
		const ringsOut = RingOut.factory(sweepLine.segments);
		const result = new MultiPolyOut(ringsOut);
		return result.getGeom();
	}
};
var operation = new Operation();
var union = function (geom) {
	for (
		var _len = arguments.length,
			moreGeoms = new Array(_len > 1 ? _len - 1 : 0),
			_key = 1;
		_key < _len;
		_key++
	) {
		moreGeoms[_key - 1] = arguments[_key];
	}
	return operation.run("union", geom, moreGeoms);
};
var intersection = function (geom) {
	for (
		var _len2 = arguments.length,
			moreGeoms = new Array(_len2 > 1 ? _len2 - 1 : 0),
			_key2 = 1;
		_key2 < _len2;
		_key2++
	) {
		moreGeoms[_key2 - 1] = arguments[_key2];
	}
	return operation.run("intersection", geom, moreGeoms);
};
var xor = function (geom) {
	for (
		var _len3 = arguments.length,
			moreGeoms = new Array(_len3 > 1 ? _len3 - 1 : 0),
			_key3 = 1;
		_key3 < _len3;
		_key3++
	) {
		moreGeoms[_key3 - 1] = arguments[_key3];
	}
	return operation.run("xor", geom, moreGeoms);
};
var difference = function (subjectGeom) {
	for (
		var _len4 = arguments.length,
			clippingGeoms = new Array(_len4 > 1 ? _len4 - 1 : 0),
			_key4 = 1;
		_key4 < _len4;
		_key4++
	) {
		clippingGeoms[_key4 - 1] = arguments[_key4];
	}
	return operation.run("difference", subjectGeom, clippingGeoms);
};
var index = {
	union,
	intersection,
	xor,
	difference,
};
module.exports = index;
