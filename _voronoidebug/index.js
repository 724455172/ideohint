var parseSFD = require('../sfdParser').parseSFD;
var glyphs = document.getElementById('source').value.match(/SplineSet\n[\s\S]*?EndSplineSet/g).map(function(passage, j){
	return parseSFD(passage.slice(9, -12))
});
var strategy = {
	UPM: 1000,
	MIN_STEM_WIDTH: 20,
	MAX_STEM_WIDTH: 100,
	MOST_COMMON_STEM_WIDTH: 65,
	STEM_SIDE_MIN_RISE: 40,
	STEM_SIDE_MIN_DESCENT: 60,
	PPEM_MIN: 10,
	PPEM_MAX: 36,
	POPULATION_LIMIT: 400,
	CHILDREN_LIMIT: 175,
	EVOLUTION_STAGES: 40,
	MUTANT_PROBABLITY: 0.1,
	ELITE_COUNT: 10,
	ABLATION_IN_RADICAL: 1,
	ABLATION_RADICAL_EDGE: 2,
	ABLATION_GLYPH_EDGE: 15,
	ABLATION_GLYPH_HARD_EDGE: 25,
	COEFF_PORPORTION_DISTORTION: 4,
	BLUEZONE_BOTTOM_CENTER: -77,
	BLUEZONE_TOP_CENTER: 836,
	BLUEZONE_BOTTOM_LIMIT: -65,
	BLUEZONE_TOP_LIMIT: 810,
	BLUEZONE_WIDTH: 15,
	COEFF_A_MULTIPLIER: 10,
	COEFF_A_SAME_RADICAL: 4,
	COEFF_A_FEATURE_LOSS: 15,
	COEFF_A_RADICAL_MERGE: 1,
	COEFF_C_MULTIPLIER: 40,
	COEFF_C_SAME_RADICAL: 6,
	COEFF_S: 10000,
	COLLISION_MIN_OVERLAP_RATIO: 0.2,
	DONT_ADJUST_STEM_WIDTH: false,
	PPEM_STEM_WIDTH_GEARS: [[0,1,1],[22,2,1],[23,2,2],[35,3,2]]
};
function cxx_copy_simple_object(o) {
	var p = Object.getPrototypeOf(o);
	var r = {};
	for(var k in p) {
		if (p.hasOwnProperty(k)) {
			r[k] = o[k];
		}
	}
	return r;
}

function cxx_vector_map(cxx_vector, cb) {
	var rl = [];
	for(var i=0, l=cxx_vector.size(); i<l; ++i) {
		var cxx_value = cxx_vector.get(i);

		var r = cb.call(null, cxx_value);

		cxx_value.delete();

		rl.push(r);
	}
	return rl;
}
function inPoly (point, vs) {
	// ray-casting algorithm based on
	// http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
	
	var x = point.x, y = point.y;
	
	var inside = false;
	for (var i = 0, j = vs.length - 2; i < vs.length - 1; j = i++) {
		var xi = vs[i].x, yi = vs[i].y;
		var xj = vs[j].x, yj = vs[j].y;

		var intersect = ((yi > y) !== (yj > y))
			&& (yj > yi ? (x - xi) * (yj - yi) < (xj - xi) * (y - yi) : (x - xi) * (yj - yi) > (xj - xi) * (y - yi));
		if (intersect) inside = !inside;
	}
	
	return inside;
};
function containsPoint(contours, x, y){
	var nCW = 0, nCCW = 0;
	for(var j = 0; j < contours.length; j++){
		if(inPoly({x: x, y: y}, contours[j].testpoints)) {
			if(contours[j].ccw) nCCW += 1;
			else nCW += 1;
		}
	};
	return nCCW != nCW
}
function construct_voronoi(glyph) {
	var cxx_vc = new voronoi.voronoi_constructor();

	var pointCache = [];

	var glyphSegments = [];
	var testSegments = [];

	for(var j = 0; j < glyph.contours.length; j++){
		var contour = glyph.contours[j];

		// Layer 1 : Control outline
		var x0 = contour.points[0].xori;
		var y0 = contour.points[0].yori;
		var testpoints = [{x: x0, y: y0}];
		contour.testpoints = testpoints;
		for(var k = 1; k < contour.points.length; k++){
			if(contour.points[k].on) {
				var x1 = contour.points[k].xori
				var y1 = contour.points[k].yori
				var gs = [contour.points[k - 1], contour.points[k]];
				var ts = [gs, x0, y0, x1, y1];
				glyphSegments.push(gs);
				testSegments.push(ts);
				x0 = x1;
				y0 = y1;
				testpoints.push({x: x1, y: y1});
			} else {
				var x1 = contour.points[k].xori
				var y1 = contour.points[k].yori
				var x2 = contour.points[k + 1].xori
				var y2 = contour.points[k + 1].yori
				var SEGMENTS = 4;
				var gs = [contour.points[k - 1], contour.points[k], contour.points[k + 1]];
				glyphSegments.push(gs);
				for(var s = 0; s < SEGMENTS; s++) {
					var t = s / SEGMENTS;
					var ts = [gs, 
						(1 - s / SEGMENTS) * (1 - s / SEGMENTS) * x0 + 2 * (s / SEGMENTS) * (1 - s / SEGMENTS) * x1 + (s / SEGMENTS) * (s / SEGMENTS) * x2,
						(1 - s / SEGMENTS) * (1 - s / SEGMENTS) * y0 + 2 * (s / SEGMENTS) * (1 - s / SEGMENTS) * y1 + (s / SEGMENTS) * (s / SEGMENTS) * y2,
						(1 - (s + 1) / SEGMENTS) * (1 - (s + 1) / SEGMENTS) * x0 + 2 * ((s + 1) / SEGMENTS) * (1 - (s + 1) / SEGMENTS) * x1 + ((s + 1) / SEGMENTS) * ((s + 1) / SEGMENTS) * x2,
						(1 - (s + 1) / SEGMENTS) * (1 - (s + 1) / SEGMENTS) * y0 + 2 * ((s + 1) / SEGMENTS) * (1 - (s + 1) / SEGMENTS) * y1 + ((s + 1) / SEGMENTS) * ((s + 1) / SEGMENTS) * y2]
					testSegments.push(ts);
					testpoints.push({x: ts[1], y: ts[2]});
				}
				x0 = x2;
				y0 = y2;
				k += 1;
				testpoints.push({x: x2, y: y2});
			}
		};
	};

	for(var i=0, l=testSegments.length; i<l; ++i) {
		var x0 = Math.round(testSegments[i][1]);
		var y0 = Math.round(testSegments[i][2]);
		var x1 = Math.round(testSegments[i][3]);
		var y1 = Math.round(testSegments[i][4]);
		if(!pointCache[x0]) pointCache[x0] = []; pointCache[x0][y0] = true;
		if(!pointCache[x1]) pointCache[x1] = []; pointCache[x0][y0] = true;
		cxx_vc.insert_segment(x0, y0, x1, y1);
	}

	var cxx_result = cxx_vc.construct();
	cxx_vc['delete']();

	var cxx_vertexes = cxx_result.vertexes;
	var cxx_edges = cxx_result.edges;
	var cxx_cells = cxx_result.cells;

	cxx_result['delete']();

	var vertexes = cxx_vector_map(cxx_vertexes, cxx_copy_simple_object);
	var edges = cxx_vector_map(cxx_edges, cxx_copy_simple_object);
	var cells = cxx_vector_map(cxx_cells, cxx_copy_simple_object);

	cxx_vertexes['delete']();
	cxx_edges['delete']();
	cxx_cells['delete']();

	for(var j = 0; j < vertexes.length; j++){
		var p = vertexes[j];
		if(pointCache[p.x] && pointCache[p.x][p.y]) {
			p.inside = p.border = true
		} else if(containsPoint(glyph.contours, p.x, p.y)) {
			p.inside = true;
		}
	};

	return {
		vertexes: vertexes,
		edges: edges,
		cells: cells,
		testSegments: testSegments
	}
}



function render() {
	var INDEX = 6;
	var ppem = 1350;
	var hPreview = document.getElementById('preview').getContext('2d');
	function txp(x){ return ((x + 50) / strategy.UPM * ppem) };
	function typ(y){ return Math.round((- y + strategy.BLUEZONE_TOP_CENTER + 100) / strategy.UPM * ppem) };

	// Voronoi diagram constructor
	var diagram = construct_voronoi(glyphs[INDEX]);
	var edges = diagram.edges;

	for(var j = 0; j < edges.length; j++) if(edges[j].vertex0_index >= 0 && edges[j].vertex1_index >= 0) {
		hPreview.lineWidth = 1;
		var v0 = diagram.vertexes[edges[j].vertex0_index], v1 = diagram.vertexes[edges[j].vertex1_index]
		if(v0.inside && v1.inside) {
			if(v0.border || v1.border){
				hPreview.strokeStyle = 'transparent';
			} else {
				hPreview.lineWidth = 3;
				hPreview.strokeStyle = 'blue';
			}
		} else {
			hPreview.strokeStyle = 'transparent';
		}
		hPreview.beginPath();
		hPreview.moveTo(txp(v0.x), typ(v0.y))
		hPreview.lineTo(txp(v1.x), typ(v1.y))
		hPreview.stroke();

		if(v0.inside && v1.inside && !(v0.border || v1.border)) {
			// Inner edge
			var cell = diagram.cells[edges[j].cell_index];
			hPreview.lineWidth = 1;
			var xm = (v0.x + v1.x) / 2;
			var ym = (v0.y + v1.y) / 2;
			var doit = false;
			if(cell.source_category === 8 || cell.source_category === 9) {
				var s = diagram.testSegments[cell.source_index];
				var a = s[4] - s[2];
				var b = s[1] - s[3];
				var c = s[3] * s[2] - s[1] * s[4];
				var xh = (b * b * xm - a * b * ym - a * c) / (a * a + b * b);
				var yh = (-a * b * xm + a * a * ym - b * c) / (a * a + b * b);
				doit = true;
			} else if(cell.source_category === 1) {
				var s = diagram.testSegments[cell.source_index];
				var xh = s[1]
				var yh = s[2]
				doit = true;
			} else if(cell.source_category === 2) {
				var s = diagram.testSegments[cell.source_index];
				var xh = s[3]
				var yh = s[4]
				doit = true;
			}
			if(doit){
				hPreview.beginPath();
				hPreview.moveTo(txp(xm), typ(ym));
				hPreview.lineTo(txp(xh), typ(yh));
				hPreview.stroke();				
			}

		}
	}

	hPreview.beginPath();
	for(var j = 0; j < glyphs[INDEX].contours.length; j++){
		var contour = glyphs[INDEX].contours[j];
		// Layer 1 : Control outline
		var x0 = contour.points[0].xori
		var y0 = contour.points[0].yori
		hPreview.moveTo(txp(x0), typ(y0));
		for(var k = 1; k < contour.points.length; k++){
			if(contour.points[k].on) {
				var x1 = contour.points[k].xori
				var y1 = contour.points[k].yori
				hPreview.lineTo(txp(x1), typ(y1));
				x0 = x1;
				y0 = y1;
			} else {
				var x1 = contour.points[k].xori
				var y1 = contour.points[k].yori
				var x2 = contour.points[k + 1].xori
				var y2 = contour.points[k + 1].yori
				hPreview.quadraticCurveTo(txp(x1), typ(y1), txp(x2), typ(y2))
				x0 = x2;
				y0 = y2;
				k += 1;
			}
		}
		hPreview.closePath();
	};
	hPreview.lineWidth = 3;
	hPreview.strokeStyle = 'black';
	hPreview.stroke();

	for(var j = 0; j < diagram.vertexes.length; j++) {
		var v = diagram.vertexes[j];
		hPreview.beginPath();
		hPreview.fillStyle = v.border ? 'black' : v.inside ? 'blue' : 'transparent';
		hPreview.arc(txp(v.x), typ(v.y), 4, 0, 2 * Math.PI);
		hPreview.fill();
	}

};

render()