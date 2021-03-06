"use strict";

const { adjacent, adjacentZ } = require("../types/point");

function BY_YORI(p, q) {
	return p.y - q.y;
}
var STEPS = 10;
function shortAbsorptionPointByKeys(shortAbsorptions, strategy, pt, keys, inSameRadical, priority) {
	if (pt.touched || pt.donttouch || !pt.on || !strategy.DO_SHORT_ABSORPTION || !inSameRadical)
		return;
	for (var m = 0; m < keys.length; m++) {
		var key = keys[m];
		if (
			key.blued &&
			key.yStrongExtrema &&
			(Math.hypot(pt.y - key.y, pt.x - key.x) <= strategy.ABSORPTION_LIMIT &&
				pt.xStrongExtrema) &&
			key.id !== pt.id
		) {
			while (key.linkedKey)
				key = key.linkedKey;
			shortAbsorptions.push([key.id, pt.id, priority + (pt.yExtrema ? 1 : 0)]);
			pt.touched = true;
			return;
		}
	}
}
function shortAbsorptionByKeys(shortAbsorptions, strategy, pts, keys, inSameRadical, priority) {
	for (var k = 0; k < pts.length; k++) {
		shortAbsorptionPointByKeys(
			shortAbsorptions,
			strategy,
			pts[k],
			keys,
			inSameRadical,
			priority
		);
	}
}

function compareZ(key, pt, f) {
	while (key.linkedKey)
		key = key.linkedKey;
	return f(key, pt);
}
function cLT(key, pt) {
	return key.y < pt.y;
}
function cGT(key, pt) {
	return key.y > pt.y;
}

var COEFF_EXT = 1;
function interpolateByKeys(
	interpolations,
	shortAbsorptions,
	strategy,
	pts,
	keys,
	inSameRadical,
	priority
) {
	for (var k = 0; k < pts.length; k++) {
		var pt = pts[k];
		if (pt.touched || pt.donttouch) continue;

		var upperK = null, upperdist = 0xffff;
		var lowerK = null, lowerdist = 0xffff;
		for (var m = keys.length - 1; m >= 0; m--)
			if (compareZ(keys[m], pt, cLT)) {
				if (
					!lowerK ||
					Math.hypot(keys[m].x - pt.x, COEFF_EXT * (keys[m].y - pt.y)) < lowerdist
				) {
					lowerK = keys[m];
					lowerdist = Math.hypot(keys[m].x - pt.x, COEFF_EXT * (keys[m].y - pt.y));
				}
			}
		for (var m = keys.length - 1; m >= 0; m--)
			if (compareZ(keys[m], pt, cGT)) {
				if (
					!upperK ||
					Math.hypot(keys[m].x - pt.x, COEFF_EXT * (keys[m].y - pt.y)) < upperdist
				) {
					upperK = keys[m];
					upperdist = Math.hypot(keys[m].x - pt.x, COEFF_EXT * (keys[m].y - pt.y));
				}
			}
		if (!lowerK || !upperK) continue;

		while (upperK.linkedKey)
			upperK = upperK.linkedKey;
		while (lowerK.linkedKey)
			lowerK = lowerK.linkedKey;
		if (!upperK.phantom && !lowerK.phantom) {
			if (upperK.y > lowerK.y + strategy.Y_FUZZ) {
				interpolations.push([upperK.id, lowerK.id, pt.id, priority]);
			} else if (upperK.id != pt.id) {
				shortAbsorptions.push([upperK.id, pt.id, priority]);
			}
		}
		pt.touched = true;
	}
}

function linkRadicalSoleStemPoints(shortAbsorptions, strategy, radical, radicalStems, priority) {
	var radicalParts = [radical.outline].concat(radical.holes);
	var radicalPoints = [].concat.apply(
		[],
		radicalParts.map(function(c) {
			return c.points.slice(0, -1);
		})
	);
	for (var k = 0; k < radicalPoints.length; k++) {
		const z = radicalPoints[k];
		if (z.keypoint || z.touched || z.donttouch) continue;
		if (!z.xExtrema && !z.yExtrema) continue;
		let candidate = null;
		for (const stem of radicalStems) {
			let reject = false;
			let sc = null;
			const highpts = [].concat.apply([], stem.high);
			const lowpts = [].concat.apply([], stem.low);
			const keyPoints = highpts.concat(lowpts);
			for (var j = 0; j < keyPoints.length; j++) {
				var zkey = keyPoints[j];
				if (zkey.id === z.id || !(zkey.id >= 0) || zkey.donttouch) continue;
				if (adjacent(zkey, z) || adjacentZ(zkey, z)) {
					reject = true;
					continue;
				}
				if (
					Math.abs(z.y - zkey.y) <= strategy.Y_FUZZ &&
					Math.abs(z.x - zkey.x) <= strategy.Y_FUZZ
				) {
					continue;
				}
				if (stem.atLeft && z.x > zkey.x) continue;
				if (stem.atRight && z.x < zkey.x) continue;

				// detect whether this sole point is attached to the stem edge.
				// in most cases, absorbing a lower point should be stricter due to the topology of ideographs
				// so we use asymmetric condition for "above" and "below" cases.
				var yDifference = z.y - (zkey.y + (z.x - zkey.x) * (zkey.slope || 0));
				if (
					!(yDifference > 0
						? yDifference < strategy.Y_FUZZ * 2
						: -yDifference < strategy.Y_FUZZ)
				)
					continue;
				if (
					sc &&
					Math.hypot(z.y - sc.y, z.x - sc.x) <= Math.hypot(z.y - zkey.y, z.x - zkey.x)
				)
					continue;
				if (!radical.includesSegmentEdge(z, zkey, 1, strategy.SLOPE_FUZZ_K, 1, 1)) continue;
				sc = zkey;
			}
			if (
				!reject &&
				sc &&
				(!candidate ||
					Math.hypot(z.y - candidate.y, z.x - candidate.x) >=
						Math.hypot(z.y - sc.y, z.x - sc.x))
			) {
				candidate = sc;
			}
		}
		// And it should have at least one segment in the glyph's outline.'
		if (candidate) {
			let key = candidate;
			while (key.linkedKey)
				key = key.linkedKey;
			shortAbsorptions.push([key.id, z.id, priority + (z.yExtrema ? 1 : 0)]);
			z.touched = true;
		}
	}
}
function linkSoleStemPoints(shortAbsorptions, strategy, glyph, priority) {
	for (var j = 0; j < glyph.radicals.length; j++) {
		var radical = glyph.radicals[j];
		var radicalStems = glyph.stems.filter(function(s) {
			return s.belongRadical === j;
		});
		linkRadicalSoleStemPoints(shortAbsorptions, strategy, radical, radicalStems, priority);
	}
}
module.exports = function(glyph, strategy) {
	let interpolations = [];
	let shortAbsorptions = [];
	let diagAligns = [];

	const contours = glyph.contours;
	let glyphKeypoints = [];
	for (var j = 0; j < contours.length; j++)
		for (var k = 0; k < contours[j].points.length; k++) {
			var z = contours[j].points[k];
			if ((z.touched && z.keypoint) || z.linkedKey) {
				glyphKeypoints.push(z);
			}
		}

	for (let s of glyph.stems) {
		if (s.linkedIPsHigh) {
			diagAligns.push({
				l: s.linkedIPsHigh.l.id,
				r: s.linkedIPsHigh.r.id,
				zs: s.linkedIPsHigh.zs.map(z => z.id)
			});
		}
		if (s.linkedIPsLow) {
			diagAligns.push({
				l: s.linkedIPsLow.l.id,
				r: s.linkedIPsLow.r.id,
				zs: s.linkedIPsLow.zs.map(z => z.id)
			});
		}
	}

	// phantom points
	for (var s = 0; s < glyph.stems.length; s++) {
		var stem = glyph.stems[s];
		for (var j = 0; j < stem.high.length; j++) {
			var l = stem.high[j][0];
			var r = stem.high[j][stem.high[j].length - 1];
			for (var step = 1; step < STEPS; step++) {
				glyphKeypoints.push({
					x: l.x + step / STEPS * (r.x - l.x),
					y: l.y + step / STEPS * (r.y - l.y),
					linkedKey: l.linkedKey || r.linkedKey,
					phantom: true
				});
			}
		}
		for (var j = 0; j < stem.low.length; j++) {
			var l = stem.low[j][0];
			var r = stem.low[j][stem.low[j].length - 1];
			for (var step = 1; step < STEPS; step++) {
				glyphKeypoints.push({
					x: l.x + step / STEPS * (r.x - l.x),
					y: l.y + step / STEPS * (r.y - l.y),
					linkedKey: l.linkedKey || r.linkedKey,
					phantom: true
				});
			}
		}
	}
	glyphKeypoints = glyphKeypoints.sort(BY_YORI);
	var records = [];

	for (var j = 0; j < contours.length; j++) {
		var contourpoints = contours[j].points.slice(0, -1);
		var contourAlignPoints = contourpoints
			.filter(function(p) {
				return p.touched;
			})
			.sort(BY_YORI);
		var contourExtrema = contourpoints
			.filter(function(p) {
				return p.xExtrema || p.yExtrema;
			})
			.sort(BY_YORI);

		var pmin = null, pmax = null;
		for (let z of contourpoints) {
			if (!pmin || z.y < pmin.y) pmin = z;
			if (!pmax || z.y > pmax.y) pmax = z;
		}

		if (contourExtrema.length > 1) {
			var extrema = contourExtrema.slice(1, -1).filter(function(z) {
				return !z.touched && !z.donttouch && (z.yExtrema || (z.xStrongExtrema && z.turn));
			});
			var midex = [];
			for (var m = 0; m < extrema.length; m++) {
				if (extrema[m].y === pmin.y && extrema[m].id !== pmin.id) {
					if (!adjacent(pmin, extrema[m])) {
						shortAbsorptions.push([pmin.id, extrema[m].id, 1]);
					}
					extrema[m].touched = true;
					extrema[m].donttouch = true;
				} else if (extrema[m].y === pmax.y && extrema[m].id !== pmax.id) {
					if (!adjacent(pmax, extrema[m])) {
						shortAbsorptions.push([pmax.id, extrema[m].id, 1]);
					}
					extrema[m].touched = true;
					extrema[m].donttouch = true;
				} else if (extrema[m].id !== pmin.id && extrema[m].id !== pmax.id) {
					midex.push(extrema[m]);
				}
			}
			var blues = contourpoints.filter(function(p) {
				return p.blued;
			});
			var midexl = contourExtrema.slice(1, -1).filter(function(p) {
				return p.xExtrema || p.yExtrema;
			});
			records.push({
				topbot: [pmin, pmax],
				midex: midex,
				midexl: midexl,
				blues: blues,
				cka: contourAlignPoints
			});
		} else {
			records.push({
				topbot: [pmin, pmax],
				midex: [],
				midexl: [],
				blues: [],
				cka: contourAlignPoints
			});
		}
	}
	for (var j = 0; j < contours.length; j++) {
		shortAbsorptionByKeys(
			shortAbsorptions,
			strategy,
			records[j].topbot,
			records[j].cka,
			true,
			9,
			false
		);
		shortAbsorptionByKeys(
			shortAbsorptions,
			strategy,
			records[j].midexl,
			records[j].blues,
			true,
			1,
			false
		);
	}
	linkSoleStemPoints(shortAbsorptions, strategy, glyph, 7);
	var b = [];
	for (var j = 0; j < contours.length; j++) {
		interpolateByKeys(
			interpolations,
			shortAbsorptions,
			strategy,
			records[j].topbot,
			glyphKeypoints,
			false,
			5
		);
		b = b.concat(
			records[j].topbot.filter(function() {
				return z.touched;
			})
		);
	}
	glyphKeypoints = glyphKeypoints.concat(b).sort(BY_YORI);
	for (var j = 0; j < contours.length; j++) {
		interpolateByKeys(
			interpolations,
			shortAbsorptions,
			strategy,
			records[j].midex,
			glyphKeypoints,
			false,
			3
		);
	}
	interpolations = interpolations.sort(function(u, v) {
		return glyph.indexedPoints[u[2]].x - glyph.indexedPoints[v[2]].x;
	});
	// cleanup
	for (var j = 0; j < interpolations.length; j++) {
		if (!interpolations[j]) continue;
		for (var k = j + 1; k < interpolations.length; k++) {
			if (
				interpolations[k] &&
				interpolations[j][0] === interpolations[k][0] &&
				interpolations[j][1] === interpolations[k][1] &&
				interpolations[j][3] === interpolations[k][3] &&
				interpolations[j][3] !== 9 &&
				Math.abs(
					glyph.indexedPoints[interpolations[j][2]].y -
						glyph.indexedPoints[interpolations[k][2]].y
				) <= strategy.Y_FUZZ
			) {
				shortAbsorptions.push([
					interpolations[j][2],
					interpolations[k][2],
					interpolations[j][3] - 1
				]);
				interpolations[k] = null;
			}
		}
	}
	return {
		interpolations: interpolations.filter(x => x),
		shortAbsorptions: shortAbsorptions.filter(a => a[0] !== a[1]),
		diagAligns: diagAligns
	};
};
