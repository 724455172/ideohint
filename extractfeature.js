exports.extractFeature = function(glyph, strategy) {

	// Stem Keypoints
	for(var js = 0; js < glyph.stems.length; js++) {
		var s = glyph.stems[js];
		var b = !s.hasSameRadicalStemBelow
			&& !(s.hasRadicalPointBelow && s.radicalCenterDescent > strategy.STEM_CENTER_MIN_DESCENT)
			&& !(s.hasRadicalLeftAdjacentPointBelow && s.radicalLeftAdjacentDescent > strategy.STEM_SIDE_MIN_DESCENT)
			&& !(s.hasRadicalRightAdjacentPointBelow && s.radicalRightAdjacentDescent > strategy.STEM_SIDE_MIN_DESCENT)
			&& !s.hasGlyphStemBelow
		// calculate slope
		var sy = 0, sx = 0, n = 0;
		for(var j = 0; j < s.high.length; j++) for(var k = 0; k < s.high[j].length; k++) {
			sy += s.high[j][k].yori;
			sx += s.high[j][k].xori;
			n += 1;
		};
		for(var j = 0; j < s.low.length; j++) for(var k = 0; k < s.low[j].length; k++) {
			sy += s.low[j][k].yori;
			sx += s.low[j][k].xori;
			n += 1;
		};
		var ax = sx / n, ay = sy / n;
		var b1num = 0, b1den = 0;
		for(var j = 0; j < s.high.length; j++) for(var k = 0; k < s.high[j].length; k++) {
			b1num += (s.high[j][k].xori - ax) * (s.high[j][k].yori - ay);
			b1den += (s.high[j][k].xori - ax) * (s.high[j][k].xori - ax);
		};
		for(var j = 0; j < s.low.length; j++) for(var k = 0; k < s.low[j].length; k++) {
			b1num += (s.low[j][k].xori - ax) * (s.low[j][k].yori - ay);
			b1den += (s.low[j][k].xori - ax) * (s.low[j][k].xori - ax);
		};
		var slope = b1num / b1den;
		function intercept(point){
			return point.yori - point.xori * slope;
		}
		// get highkey and lowkey
		var highkey = s.high[0][0], lowkey = s.low[0][0], highnonkey = [], lownonkey = [];
		var jHigh = 0, jLow = 0;
		for(var j = 0; j < s.high.length; j++) for(var k = 0; k < s.high[j].length; k++) if(s.high[j][k].id >= 0 && intercept(s.high[j][k]) < intercept(highkey)) {
			highkey = s.high[j][k];
			jHigh = j;
		}
		for(var j = 0; j < s.low.length; j++) for(var k = 0; k < s.low[j].length; k++) if(s.low[j][k].id >= 0 && intercept(s.low[j][k])> intercept(lowkey)) {
			lowkey = s.low[j][k];
			jLow = j;
		}
		highkey.touched = lowkey.touched = true;
		for(var j = 0; j < s.high.length; j++) for(var k = 0; k < s.high[j].length; k++) {
			if(j !== jHigh) {
				if(k === 0) {
					highnonkey.push(s.high[j][k])
					s.high[j][k].touched = true;
				} else {
					s.high[j][k].donttouch = true;
				}
			} else if(s.high[j][k] !== highkey){
				s.high[j][k].donttouch = true;
			}
		}
		for(var j = 0; j < s.low.length; j++) for(var k = 0; k < s.low[j].length; k++) {
			if(j !== jLow) {
				if(k === s.low[j].length - 1) {
					lownonkey.push(s.low[j][k])
					s.low[j][k].touched = true
				} else {
					s.low[j][k].donttouch = true
				}
			} else if(s.low[j][k] !== lowkey) {
				s.low[j][k].donttouch = true
			}
		};
		s.yori = highkey.yori;
		s.width = highkey.yori - lowkey.yori;
		s.posKey = b ? lowkey : highkey;
		s.advKey = b ? highkey : lowkey;
		s.posAlign = b ? lownonkey : highnonkey;
		s.advAlign = b ? highnonkey : lownonkey;
		s.posKeyAtTop = !b;
		s.posKey.keypoint = true;
	}
	
	// Blue zone points
	var topBluePoints = [];
	var bottomBluePoints = [];
	for(var j = 0; j < glyph.contours.length; j++) {
		for(var k = 0; k < glyph.contours[j].points.length - 1; k++){
			var point = glyph.contours[j].points[k];
			if(point.ytouch >= strategy.BLUEZONE_TOP_LIMIT && point.yExtrema && !point.touched && !point.donttouch){
				point.touched = true;
				point.keypoint = true;
				topBluePoints.push(point);
			}
			if(point.ytouch <= strategy.BLUEZONE_BOTTOM_LIMIT && point.yExtrema && !point.touched && !point.donttouch){
				point.touched = true;
				point.keypoint = true;
				bottomBluePoints.push(point);
			}

		}
	}

	// Interpolations
	var interpolations = [];
	function BY_YORI(p, q){ return p.yori - q.yori }

	function interpolateByKeys(pts, keys){
		for(var k = 0; k < pts.length; k++) if(!pts[k].touched) {
			for(var m = 1; m < keys.length; m++) {
				if(keys[m].yori > pts[k].yori && keys[m - 1].yori <= pts[k].yori) {
					interpolations.push([keys[m - 1].id, keys[m].id, pts[k].id]);
					break;
				}
			}
		}
	}
	function findInterpolates(contours) {
		var glyphKeypoints = [];
		for(var j = 0; j < contours.length; j++) for(var k = 0; k < contours[j].points.length; k++) {
			if(contours[j].points[k].touched && contours[j].points[k].keypoint) {
				glyphKeypoints.push(contours[j].points[k]);
			}
		}
		glyphKeypoints = glyphKeypoints.sort(BY_YORI);

		for(var j = 0; j < contours.length; j++) {
			var contourpoints = contours[j].points
			var contourKeypoints = contourpoints.filter(function(p){ return p.touched});
			if(contourKeypoints.length >= 2) {
				var k0 = contourpoints.indexOf(contourKeypoints[0]);
				var keyk = 0;
				for(var k_ = k0; k_ < contourpoints.length + k0; k_++){
					var k = k_ % contourpoints.length;
					if(contourpoints[k] === contourKeypoints[keyk + 1]) {
						keyk += 1;
					} else if(contourpoints[k].yori >= contourKeypoints[keyk].yori && contourpoints[k].yori <= contourKeypoints[(keyk + 1) % contourKeypoints.length].yori || contourpoints[k].yori <= contourKeypoints[keyk].yori && contourpoints[k].yori >= contourKeypoints[(keyk + 1) % contourKeypoints.length].yori) {
						contourpoints[k].donttouch = true;
					}
				}
			}

			var contourExtrema = [];
			for(var k = 0; k < contours[j].points.length; k++) {
				var point = contours[j].points[k]
				if(point.yExtrema && !point.touched && !point.donttouch) {
					contourExtrema.push(point);
				}
			};
			if(contourKeypoints.length > 1) { interpolateByKeys(contourExtrema, contourKeypoints.sort(BY_YORI)) }
			interpolateByKeys(contourExtrema, glyphKeypoints)
		}
	};
	findInterpolates(glyph.contours);
	var directOverlaps = (function(){
		var d = [];
		for(var j = 0; j < glyph.stemOverlaps.length; j++){
			d[j] = [];
			for(var k = 0; k < j; k++) {
				d[j][k] = glyph.stemOverlaps[j][k] > strategy.COLLISION_MIN_OVERLAP_RATIO
			}
		};
		for(var x = 0; x < d.length; x++) for(var y = 0; y < d.length; y++) for(var z = 0; z < d.length; z++) {
			if(d[x][y] && d[y][z]) d[x][z] = false;
		};
		return d;
	})();
	return {
		stats: glyph.stats,
		stems: glyph.stems.map(function(s){
			return {
				xmin: s.xmin,
				xmax: s.xmax,
				yori: s.yori,
				width: s.width,
				atGlyphTop: s.atGlyphTop,
				atGlyphBottom: s.atGlyphBottom,
				
				hasGlyphStemAbove: s.hasGlyphStemAbove,
				hasSameRadicalStemAbove: s.hasSameRadicalStemAbove,
				hasRadicalPointAbove: s.hasRadicalPointAbove,
				hasRadicalLeftAdjacentPointAbove: s.hasRadicalLeftAdjacentPointAbove,
				hasRadicalRightAdjacentPointAbove: s.hasRadicalRightAdjacentPointAbove,
				radicalCenterRise: s.radicalCenterRise,
				radicalRightAdjacentRise: s.radicalRightAdjacentRise,
				radicalLeftAdjacentRise: s.radicalLeftAdjacentRise,
				hasGlyphPointAbove: s.hasGlyphPointAbove,
				hasGlyphLeftAdjacentPointAbove: s.hasGlyphLeftAdjacentPointAbove,
				hasGlyphRightAdjacentPointAbove: s.hasGlyphRightAdjacentPointAbove,
				glyphCenterRise: s.glyphCenterRise,
				glyphRightAdjacentRise: s.glyphRightAdjacentRise,
				glyphLeftAdjacentRise: s.glyphLeftAdjacentRise,
				
				hasGlyphStemBelow: s.hasGlyphStemBelow,
				hasSameRadicalStemBelow: s.hasSameRadicalStemBelow,
				hasRadicalPointBelow: s.hasRadicalPointBelow,
				hasRadicalLeftAdjacentPointBelow: s.hasRadicalLeftAdjacentPointBelow,
				hasRadicalRightAdjacentPointBelow: s.hasRadicalRightAdjacentPointBelow,
				radicalCenterDescent: s.radicalCenterDescent,
				radicalLeftAdjacentDescent: s.radicalLeftAdjacentDescent,
				radicalRightAdjacentDescent: s.radicalRightAdjacentDescent,
				hasGlyphPointBelow: s.hasGlyphPointBelow,
				hasGlyphLeftAdjacentPointBelow: s.hasGlyphLeftAdjacentPointBelow,
				hasGlyphRightAdjacentPointBelow: s.hasGlyphRightAdjacentPointBelow,
				glyphCenterDescent: s.glyphCenterDescent,
				glyphLeftAdjacentDescent: s.glyphLeftAdjacentDescent,
				glyphRightAdjacentDescent: s.glyphRightAdjacentDescent,

				posKey: {id: s.posKey.id, yori: s.posKey.yori},
				advKey: {id: s.advKey.id, yori: s.advKey.yori},
				posAlign: s.posAlign.map(function(x){ return x.id }),
				advAlign: s.advAlign.map(function(x){ return x.id }),
				posKeyAtTop: s.posKeyAtTop
			}
		}),
		stemOverlaps: glyph.stemOverlaps,
		directOverlaps: directOverlaps,
		collisionMatrices: glyph.collisionMatrices,
		topBluePoints: topBluePoints.map(function(x){ return x.id }),
		bottomBluePoints: bottomBluePoints.map(function(x){ return x.id }),
		interpolations: interpolations
	}
}