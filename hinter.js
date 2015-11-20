// THIS IS XUANXUE


var util = require('util');
var roundings = require('./roundings');

function proportion(p, q){ return p / (p + q) }
function clamp(x){ return Math.min(1, Math.max(0, x)) }
function xclamp(low, x, high){ return x < low ? low : x > high ? high : x }
function mix(a, b, x){ return a + (b - a) * x }
function aggerate(p, gamma){
	if(p <= 0.5){
		return mix(0.5, 0, Math.pow((0.5 - p) * 2, gamma))
	} else {
		return mix(0.5, 1, Math.pow((p - 0.5) * 2, gamma))
	}
}

function hint(glyph, ppem, strategy) {
	var upm							= strategy.UPM || 1000;

	var MIN_STEM_WIDTH         		= strategy.MIN_STEM_WIDTH;
	var MAX_STEM_WIDTH         		= strategy.MAX_STEM_WIDTH;
	var STEM_SIDE_MIN_RISE     		= strategy.STEM_SIDE_MIN_RISE || strategy.MIN_STEM_WIDTH;
	var STEM_CENTER_MIN_RISE   		= strategy.STEM_CENTER_MIN_RISE || STEM_SIDE_MIN_RISE;
	var STEM_SIDE_MIN_DESCENT  		= strategy.STEM_SIDE_MIN_DESCENT || strategy.MIN_STEM_WIDTH;
	var STEM_CENTER_MIN_DESCENT		= strategy.STEM_CENTER_MIN_DESCENT || STEM_SIDE_MIN_DESCENT;

	var POPULATION_LIMIT 			= strategy.POPULATION_LIMIT || 200;
	var CHILDREN_LIMIT   			= strategy.CHILDREN_LIMIT || 100;
	var EVOLUTION_STAGES 			= strategy.EVOLUTION_STAGES || 15;
	var MUTANT_PROBABLITY			= strategy.MUTANT_PROBABLITY || 0.4;
	var ELITE_COUNT      			= strategy.ELITE_COUNT || 10;
	var PPEM_INCREASE_GLYPH_LIMIT	= strategy.PPEM_INCREASE_GLYPH_LIMIT || 20;
	
	
	var REBALANCE_PASSES         	= strategy.REBALANCE_PASSES || 1;
	var WIDTH_ALLOCATION_PASSES  	= strategy.WIDTH_ALLOCATION_PASSES || 5;
	
	var COEFF_DISTORT           	= strategy.COEFF_DISTORT || 10;

	var blueFuzz					= strategy.BLUEZONE_WIDTH || 15;

	var COLLISION_MIN_OVERLAP_RATIO	= strategy.COLLISION_MIN_OVERLAP_RATIO || 0.2;

	var PPEM_STEM_WIDTH_GEARS		= strategy.PPEM_STEM_WIDTH_GEARS || [[0, 1, 1], [13, 1, 2], [21, 2, 2], [27, 2, 3], [32, 3, 3]];
	var WIDTH_GEAR_PROPER, WIDTH_GEAR_MIN;
	for(var j = 0; j < PPEM_STEM_WIDTH_GEARS.length; j++){
		WIDTH_GEAR_PROPER = PPEM_STEM_WIDTH_GEARS[j][1];
		if(j + 1 < PPEM_STEM_WIDTH_GEARS.length && PPEM_STEM_WIDTH_GEARS[j][0] <= ppem && PPEM_STEM_WIDTH_GEARS[j + 1][0] > ppem) {
			WIDTH_GEAR_MIN = PPEM_STEM_WIDTH_GEARS[j][2];
			break;
		};
		if(j === PPEM_STEM_WIDTH_GEARS.length - 1) {
			WIDTH_GEAR_MIN = PPEM_STEM_WIDTH_GEARS[j][2]
		}
	};

	var ABLATION_IN_RADICAL     	= strategy.ABLATION_IN_RADICAL || 1;
	var ABLATION_RADICAL_EDGE   	= strategy.ABLATION_RADICAL_EDGE || 2;
	var ABLATION_GLYPH_EDGE     	= strategy.ABLATION_GLYPH_EDGE || 15;
	var ABLATION_GLYPH_HARD_EDGE	= strategy.ABLATION_GLYPH_HARD_EDGE || 25;
	
	var COEFF_PORPORTION_DISTORTION = strategy.COEFF_PORPORTION_DISTORTION || 4;

	var BLUEZONE_BOTTOM_CENTER		= strategy.BLUEZONE_BOTTOM_CENTER || -75;
	var BLUEZONE_TOP_CENTER   		= strategy.BLUEZONE_TOP_CENTER || 840;
	var BLUEZONE_BOTTOM_LIMIT 		= strategy.BLUEZONE_BOTTOM_LIMIT || -65;
	var BLUEZONE_TOP_LIMIT    		= strategy.BLUEZONE_TOP_LIMIT || 825;
	var BLUEZONE_BOTTOM_BAR 		= strategy.BLUEZONE_BOTTOM_BAR || -65;
	var BLUEZONE_TOP_BAR    		= strategy.BLUEZONE_TOP_BAR || 825;
	
	var MOST_COMMON_STEM_WIDTH		= strategy.MOST_COMMON_STEM_WIDTH || 65;

	var DONT_ADJUST_STEM_WIDTH = strategy.DONT_ADJUST_STEM_WIDTH || false;


	var shouldAddGlyphHeight = strategy.shouldAddGlyphHeight || function(stem, ppem, pixelTop, pixelBottom) {
		return stem.yori - stem.ytouch >= 0.25 * uppx
	}

	function byyori(a, b){
		return a.yori - b.yori
	}
	var stems = glyph.stems.sort(byyori);

	var round = roundings.Rtg(upm, ppem);
	var roundDown = roundings.Rdtg(upm, ppem);
	var roundUp = roundings.Rutg(upm, ppem);

	var uppx = upm / ppem;
	var pixelBottom = round(BLUEZONE_BOTTOM_CENTER);
	var pixelTop = round(BLUEZONE_TOP_CENTER);
	var glyfBottom = pixelBottom;
	var glyfTop = pixelTop;
	
	function roundDownStem(stem){
		stem.roundMethod = -1; // Positive for round up, negative for round down
		stem.ytouch = roundDown(stem.yori);
		stem.deltaY = 0
	}
	function roundUpStem(stem){
		stem.roundMethod = 1;
		stem.ytouch = roundUp(stem.yori);
		stem.deltaY = 0
	}

	function calculateWidth(w){
		return Math.round(Math.max(WIDTH_GEAR_MIN, Math.min(WIDTH_GEAR_PROPER, w / MOST_COMMON_STEM_WIDTH * WIDTH_GEAR_PROPER))) * uppx
	}

	function atRadicalTop(stem){
		return !stem.hasSameRadicalStemAbove
			&& !(stem.hasRadicalPointAbove && stem.radicalCenterRise > STEM_CENTER_MIN_RISE)
			&& !(stem.hasRadicalLeftAdjacentPointAbove && stem.radicalLeftAdjacentRise > STEM_SIDE_MIN_RISE)
			&& !(stem.hasRadicalRightAdjacentPointAbove && stem.radicalRightAdjacentRise > STEM_SIDE_MIN_RISE)
			&& !(stem.hasRadicalLeftDistancedPointAbove && stem.radicalLeftDistancedRise > STEM_SIDE_MIN_RISE)
			&& !(stem.hasRadicalRightDistancedPointAbove && stem.radicalRightDistancedRise > STEM_SIDE_MIN_RISE)
	}
	function atGlyphTop(stem){
		return atRadicalTop(stem) && !stem.hasGlyphStemAbove 
			&& !(stem.hasGlyphPointAbove && stem.glyphCenterRise > STEM_CENTER_MIN_RISE)
			&& !(stem.hasGlyphLeftAdjacentPointAbove && stem.glyphLeftAdjacentRise > STEM_SIDE_MIN_RISE)
			&& !(stem.hasGlyphRightAdjacentPointAbove && stem.glyphRightAdjacentRise > STEM_SIDE_MIN_RISE)
	}
	function atRadicalBottom(stem){
		return !stem.hasSameRadicalStemBelow
			&& !(stem.hasRadicalPointBelow && stem.radicalCenterDescent > STEM_CENTER_MIN_DESCENT)
			&& !(stem.hasRadicalLeftAdjacentPointBelow && stem.radicalLeftAdjacentDescent > STEM_SIDE_MIN_DESCENT)
			&& !(stem.hasRadicalRightAdjacentPointBelow && stem.radicalRightAdjacentDescent > STEM_SIDE_MIN_DESCENT)
			&& !(stem.hasRadicalLeftDistancedPointBelow && stem.radicalLeftDistancedDescent > STEM_SIDE_MIN_DESCENT)
			&& !(stem.hasRadicalRightDistancedPointBelow && stem.radicalRightDistancedDescent > STEM_SIDE_MIN_DESCENT)
	};
	function atGlyphBottom(stem){
		return atRadicalBottom(stem) && !stem.hasGlyphStemBelow 
			&& !(stem.hasGlyphPointBelow && stem.glyphCenterDescent > STEM_CENTER_MIN_DESCENT)
			&& !(stem.hasGlyphLeftAdjacentPointBelow && stem.glyphLeftAdjacentDescent > STEM_SIDE_MIN_DESCENT)
			&& !(stem.hasGlyphRightAdjacentPointBelow && stem.glyphRightAdjacentDescent > STEM_SIDE_MIN_DESCENT)
	};

	var directOverlaps = glyph.directOverlaps;
	var overlaps = glyph.overlaps;
	var triplets = glyph.triplets;
	var flexes = glyph.flexes;
	
	var cyb = pixelBottom + (ppem <= PPEM_INCREASE_GLYPH_LIMIT ? 0 : round(BLUEZONE_BOTTOM_BAR - BLUEZONE_BOTTOM_CENTER))
		+ Math.min(0, ppem <= PPEM_INCREASE_GLYPH_LIMIT ? pixelBottom - BLUEZONE_BOTTOM_BAR : pixelBottom - BLUEZONE_BOTTOM_CENTER);
	var cyt = pixelTop - (ppem <= PPEM_INCREASE_GLYPH_LIMIT ? 0 : round(BLUEZONE_TOP_CENTER - BLUEZONE_TOP_BAR))
		+ Math.max(0, ppem <= PPEM_INCREASE_GLYPH_LIMIT ? pixelTop - BLUEZONE_TOP_BAR : pixelTop - BLUEZONE_TOP_CENTER);
	var cybx = pixelBottom + (ppem <= PPEM_INCREASE_GLYPH_LIMIT ? 0 : roundDown(BLUEZONE_BOTTOM_BAR - BLUEZONE_BOTTOM_CENTER))
		+ Math.min(0, ppem <= PPEM_INCREASE_GLYPH_LIMIT ? pixelBottom - BLUEZONE_BOTTOM_BAR : pixelBottom - BLUEZONE_BOTTOM_CENTER);
	var cytx = pixelTop - (ppem <= PPEM_INCREASE_GLYPH_LIMIT ? 0 : roundDown(BLUEZONE_TOP_CENTER - BLUEZONE_TOP_BAR))
		+ Math.max(0, ppem <= PPEM_INCREASE_GLYPH_LIMIT ? pixelTop - BLUEZONE_TOP_BAR : pixelTop - BLUEZONE_TOP_CENTER);
	
	function cy(y, w0, w, x){
		var p = (y - w0 - BLUEZONE_BOTTOM_BAR) / (BLUEZONE_TOP_BAR - BLUEZONE_BOTTOM_BAR - w0);
		if(x) {
			return w + cybx + (cytx - cybx - w) * p;
		} else {
			return w + cyb + (cyt - cyb - w) * p;
		}
	}
	
	function flexMiddleStem(t, m, b){
		var spaceAboveOri = t.y0 - t.w0 / 2 - m.y0 + m.w0 / 2
		var spaceBelowOri = m.y0 - m.w0 / 2 - b.y0 + b.w0 / 2
		if(spaceAboveOri > 0 && spaceBelowOri > 0) {
			var totalSpaceFlexed = t.center - t.properWidth / 2 - b.center + b.properWidth / 2;
			m.center = xclamp(m.low * uppx,
				m.properWidth / 2 + b.center - b.properWidth / 2 + totalSpaceFlexed * (spaceBelowOri / (spaceBelowOri + spaceAboveOri)),
				m.high * uppx)
		}
	}
	
	function flexCenter(avaliables) {
		// fix top and bottom stems
		for(var j = 0; j < stems.length; j++){
			if(!stems[j].hasGlyphStemBelow) {
				avaliables[j].high = Math.round(Math.max(avaliables[j].center, pixelBottom + avaliables[j].properWidth + (atGlyphBottom(stems[j]) ? 0 : uppx)) / uppx);
			};
			if(!stems[j].hasGlyphStemAbove) {
				avaliables[j].low = Math.round(avaliables[j].center / uppx);
			};
		}
		
		for(var j = 0; j < flexes.length; j++) {
			flexMiddleStem(avaliables[flexes[j][0]], avaliables[flexes[j][1]], avaliables[flexes[j][2]]);
		}
	};
	
	var avaliables = function(stems) {
		var avaliables = []
		for(var j = 0; j < stems.length; j++) {
			var w = calculateWidth(stems[j].width);
			var lowlimit = atGlyphBottom(stems[j]) ? pixelBottom + WIDTH_GEAR_MIN * uppx : pixelBottom + WIDTH_GEAR_MIN * uppx + xclamp(uppx, stems[j].yori - w - BLUEZONE_BOTTOM_CENTER, WIDTH_GEAR_MIN * uppx);
			var highlimit = ppem <= PPEM_INCREASE_GLYPH_LIMIT ? pixelTop - (atGlyphTop(stems[j]) ? 0 : uppx):
				pixelTop - xclamp(
					atGlyphTop(stems[j]) ? 0 : uppx,
					atGlyphTop(stems[j]) ? round(BLUEZONE_TOP_CENTER - BLUEZONE_TOP_BAR) + roundDown(BLUEZONE_TOP_BAR - stems[j].yori) : round(BLUEZONE_TOP_CENTER - stems[j].yori),
					WIDTH_GEAR_MIN * uppx);
			
			var center0 = cy(stems[j].yori, stems[j].width, w, atGlyphTop(stems[j]) || atGlyphBottom(stems[j]))
			var center = xclamp(lowlimit, center0, highlimit);
			var low = xclamp(lowlimit, round(center) - uppx, highlimit);
			var high = xclamp(lowlimit, round(center) + uppx, highlimit);
			
			var ablationCoeff = atGlyphTop(stems[j]) || atGlyphBottom(stems[j]) ? ABLATION_GLYPH_HARD_EDGE
							  : !stems[j].hasGlyphStemAbove || !stems[j].hasGlyphStemBelow ? ABLATION_GLYPH_EDGE
							  : !stems[j].hasSameRadicalStemAbove || !stems[j].hasSameRadicalStemBelow ? ABLATION_RADICAL_EDGE : ABLATION_IN_RADICAL;
			avaliables[j] = {
				low: Math.round(low / uppx),
				high: Math.round(high / uppx),
				properWidth: w,
				center: center,
				ablationCoeff: ablationCoeff / uppx * (1 + 0.5 * (stems[j].xmax - stems[j].xmin) / upm)
			};
		};
		flexCenter(avaliables);
		for(var j = 0; j < stems.length; j++){
			avaliables[j].proportion = (avaliables[j].center - avaliables[0].center) / (avaliables[avaliables.length - 1].center - avaliables[0].center) || 0
		};
		return avaliables;
	}(stems);

	var COLLISION_FUZZ = 1.04;
	var HIGHLY_COLLISION_FUZZ = 0.3;

	function canBeAdjustedUp(stems, k, distance){
		for(var j = k + 1; j < stems.length; j++){
			if(directOverlaps[j][k] && (stems[j].ytouch - stems[k].ytouch) - stems[j].touchwidth <= distance)
				return false
		}
		return true;
	}
	function canBeAdjustedDown(stems, k, distance){
		for(var j = 0; j < k; j++){
			if(directOverlaps[k][j] && (stems[k].ytouch - stems[j].ytouch) - stems[k].touchwidth <= distance)
				return false
		}
		return true;
	}

	// Pass 1. Early Uncollide
	// In this pass we move stems to avoid collisions between them.
	// This pass is deterministic, and its result will be used as the seed in the next
	// pass.
	function earlyAllocate(y, j, allocated){
		var ymax = -999;
		// Find the high point of stems below stem j
		for(var k = 0; k < j; k++) if(directOverlaps[j][k] && y[k] > ymax){
			ymax = y[k];
		};
		var c = round(avaliables[j].center) / uppx
		if(avaliables[j].low >= ymax + 2) {
			y[j] = avaliables[j].low;
		} else if(c >= ymax + 2){
			y[j] = c
		} else if(avaliables[j].high >= ymax + 2) {
			// Place upward
			y[j] = xclamp(avaliables[j].low, ymax + 2, avaliables[j].high)
		} else if(avaliables[j].low <= ymax && avaliables[j].high >= ymax) {
			// merge
			y[j] = ymax;
		} else {
			y[j] = xclamp(avaliables[j].low, c, avaliables[j].high);
		};
		allocated[j] = true;
		for(var k = j + 1; k < stems.length; k++) if(!allocated[k]) earlyAllocate(y, k, allocated);
	}
	function earlyAdjust(stems) {
		var y0 = [];
		var allocated = [];
		earlyAllocate(y0, 0, allocated);
		for(var j = 0; j < stems.length; j++) {
			stems[j].ytouch = y0[j] * uppx;
			stems[j].touchwidth = uppx;
		};
	};
	// Pass 2 : Uncollide
	// In this pass a genetic algorithm take place to optimize stroke placements of the glyph.
	// The optimization target is the "collision potential" evaluated using stroke position
	// state vector |y>. Due to randomized mutations, the result is not deterministic, though
	// reliable under most cases.
	function collidePotential(y, A, C, S, avaliables) {
		var p = 0;
		var n = y.length;
		for(var j = 0; j < n; j++) {
			for(var k = 0; k < j; k++) {
				if(y[j] === y[k]) p += A[j][k];
				else if(y[j] === y[k] + 1 || y[j] + 1 === y[k]) p += C[j][k];
				if(y[j] < y[k] || Math.abs(avaliables[j].center - avaliables[k].center) < 4 && y[j] !== y[k]) p += S[j][k];
			};
		};
		for(var t = 0; t < triplets.length; t++){
			var j = triplets[t][0], k = triplets[t][1], w = triplets[t][2], d = triplets[t][3];
			var spacejk = y[j] - y[k] - avaliables[j].properWidth / uppx;
			var spacekw = y[k] - y[w] - avaliables[k].properWidth / uppx;
			//if(spacejk <= 0 || spacekw <= 0) p += COEFF_DISTORT;
			if(y[j] > y[k] && y[k] > y[w] && (
				   d >= blueFuzz && spacejk < spacekw
				|| d <= -blueFuzz && spacejk > spacekw
				|| d < blueFuzz && d > -blueFuzz && (spacejk - spacekw > 1 || spacejk - spacekw < -1))) {
				p += (C[j][k] + C[k][w]) * COEFF_DISTORT;
			}
		};
		return p;
	};
	function ablationPotential(y, A, C, S, avaliables) {
		var p = 0;
		var n = y.length;
		var ymin = ppem, ymax = -ppem;
		for(var j = 0; j < n; j++) {
			if(y[j] > ymax) ymax = y[j];
			if(y[j] < ymin) ymin = y[j];
		}
		var ymaxt = Math.max(ymax, glyfTop);
		var ymint = Math.min(ymin, glyfBottom);
		for(var j = 0; j < y.length; j++) {
			p += avaliables[j].ablationCoeff * Math.abs(y[j] * uppx - avaliables[j].center)
			p += COEFF_PORPORTION_DISTORTION * Math.abs(y[j] - (ymin + avaliables[j].proportion * (ymax - ymin)))
		};
		return p;
	};

	function Organism(y){
		this.gene = y;
		this.collidePotential = collidePotential(y, glyph.collisionMatrices.alignment, glyph.collisionMatrices.collision, glyph.collisionMatrices.swap, avaliables);
		this.ablationPotential = ablationPotential(y, glyph.collisionMatrices.alignment, glyph.collisionMatrices.collision, glyph.collisionMatrices.swap, avaliables);
		this.fitness = 1 / (1 + Math.max(0, this.collidePotential * 8 + this.ablationPotential / 16))
	};
	function crossover(father, mother) {
		var jm = father.length - 1;
		while(father[jm] === mother[jm] && jm >= 0) jm -= 1;
		if(jm < 0) return new Organism(mutant(father.slice(0)));
		var rj = Math.floor(Math.random() * (jm + 1));
		var y1 = father.slice(0, rj).concat(mother.slice(rj));
		if(Math.random() < MUTANT_PROBABLITY) mutant(y1);
		return new Organism(y1);
	};
	function mutantAt(y1, rj, pos){
		y1[rj] = pos;
	};
	function mutant(y1){
		var rj = Math.floor(Math.random() * y1.length);
		mutantAt(y1, rj, avaliables[rj].low + Math.floor(Math.random() * (avaliables[rj].high - avaliables[rj].low + 0.999)));
		return y1;
	};
	
	function selectPopulation(population){
		var res = [];
		var n = 0;
		while(n < POPULATION_LIMIT) {
			var maxFitness = 0;
			for(var j = 0; j < population.length; j++) if(population[j] && population[j].fitness > maxFitness){ 
				maxFitness = population[j].fitness 
			};
			if(maxFitness <= 0) break;
			for(var j = 0; j < population.length; j++) if(population[j] && Math.random() * maxFitness <= population[j].fitness) {
				n += 1;
				res.push(population[j]);
				population[j] = null;
			}
		};
		return res;
	}

	function evolve(population) {
		// Crossover
		var children = []
		for(var c = 0; c < POPULATION_LIMIT - population.length + CHILDREN_LIMIT; c++) {
			var father = population[0 | Math.random() * population.length].gene;
			var mother = population[0 | Math.random() * population.length].gene;
			var child = crossover(father, mother)
			if(child) children.push(child)
		};
		population = population.concat(children);
		if(population.length <= POPULATION_LIMIT) return population;
		return selectPopulation(population);
	};
	function uncollide(stems){
		if(!stems.length) return;

		var n = stems.length;
		var y0 = stems.map(function(s, j){ return xclamp(avaliables[j].low, Math.round(stems[j].ytouch / uppx), avaliables[j].high) });

		var population = [new Organism(y0)];
		// Generate initial population
		for(var j = 0; j < n; j++) {
			for(var k = avaliables[j].low; k <= avaliables[j].high; k++) if(k !== y0[j]) {
				var y1 = y0.slice(0);
				y1[j] = k;
				population.push(new Organism(y1));
			};
		};
		population.push(new Organism(y0.map(function(y, j){ return xclamp(avaliables[j].low, y - 1, avaliables[j].high) })));
		population.push(new Organism(y0.map(function(y, j){ return xclamp(avaliables[j].low, y + 1, avaliables[j].high) })));

		var elites = [new Organism(y0)];
		for(var s = 0; s < EVOLUTION_STAGES; s++) {
			population = evolve(population);
			var elite = population[0];
			for(var j = 0; j < population.length; j++) if(population[j].fitness > elite.fitness) elite = population[j];
			elites.push(elite);
			if(elite.collidePotential <= 0) break;
		};

		population = elites.concat(population);
		var best = population[0];
		for(var j = 1; j < population.length; j++) if(population[j].fitness > best.fitness) best = population[j];
		// Assign
		for(var j = 0; j < stems.length; j++){
			stems[j].ytouch = best.gene[j] * uppx;
			stems[j].touchwidth = uppx;
			stems[j].roundMethod = stems[j].ytouch >= stems[j].yori ? 1 : -1;
		};
	};

	// Pass 3 : Rebalance
	function rebalance(stems) {
		var m = stems.map(function(s, j){ return [s.xmax - s.xmin, j]}).sort(function(a, b){ return b[0]  - a[0]});
		for(var pass = 0; pass < REBALANCE_PASSES; pass++) for(var jm = 0; jm < m.length; jm++){
			var j = m[jm][1];
			if(!atGlyphTop(stems[j]) && !atGlyphBottom(stems[j])) {
				if(canBeAdjustedDown(stems, j, 1.8 * uppx) && stems[j].ytouch > avaliables[j].low * uppx) {
					if(stems[j].ytouch - avaliables[j].center > 0.6 * uppx) { 
						stems[j].ytouch -= uppx
					} else if(spaceAbove(stems, j, upm * 3) < 0.5 * uppx){
						stems[j].ytouch -= uppx
					}
				} else if(canBeAdjustedUp(stems, j, 1.8 * uppx) && stems[j].ytouch < avaliables[j].high * uppx) {
					if(avaliables[j].center - stems[j].ytouch > 0.6 * uppx) { 
						stems[j].ytouch += uppx;
					}
				};
			};
		}
	};
	function edgetouch(s, t) {
		return (s.xmin < t.xmin && t.xmin < s.xmax && s.xmax < t.xmax && (s.xmax - t.xmin) / (s.xmax - s.xmin) <= 0.26)
			|| (t.xmin < s.xmin && s.xmin < t.xmax && t.xmax < s.xmax && (t.xmax - s.xmin) / (s.xmax - s.xmin) <= 0.26)
	};
	function cover(s, t){
		return (t.xmin > mix(s.xmin, s.xmax, 0.1) && t.xmax < mix(s.xmin, s.xmax, 0.9))
	}
	// Pass 4 : Width allocation
	function spaceBelow(y, w, k, bottom){
		var space = y[k] - w[k] - bottom;
		for(var j = k - 1; j >= 0; j--){
			if(directOverlaps[k][j] && Math.abs(y[k] - y[j]) - w[k] < space)
				space = y[k] - y[j] - w[k]
		}
		return space;
	}
	function spaceAbove(y, w, k, top){
		var space = top - y[k];
		for(var j = k + 1; j < stems.length; j++){
			if(directOverlaps[j][k] && Math.abs(y[j] - y[k]) - w[j] < space)
				space = y[j] - y[k] - w[j]
		}
		return space;
	}
	function allocateWidth(stems) {
		var allocated = [];
		var y = [];
		var w = [];
		var properWidths = [];
		for(var j = 0; j < stems.length; j++) { 
			properWidths[j] = Math.round(calculateWidth(stems[j].width) / uppx)
			y[j] = Math.round(stems[j].ytouch / uppx)
			w[j] = 1
		};
		
		var pixelTopPixels = Math.round(pixelTop / uppx);
		var pixelBottomPixels = Math.round(pixelBottom / uppx);

		function allocateDown(j) {
			var sb = spaceBelow(y, w, j, pixelBottomPixels - 1);
			var wr = properWidths[j];
			var wx = Math.min(wr, w[j] + sb - 1);
			if(wx <= 1) return;
			if(sb + w[j] > wr + 1 && y[j] - wr >= pixelBottomPixels + 1 || atGlyphBottom(stems[j]) && y[j] - wr >= pixelBottomPixels) {
				w[j] = wr;
				allocated[j] = true;
			} else if(y[j] - wx >= pixelBottomPixels + 1 || atGlyphBottom(stems[j]) && y[j] - wx >= pixelBottomPixels) {
				w[j] = wx;
				if(w >= wr) allocated[j] = true;
			}
		};
		function allocateUp(j) {
			var sb = spaceBelow(y, w, j, pixelBottomPixels - 1);
			var sa = spaceAbove(y, w, j, pixelTopPixels + 1);
			var wr = properWidths[j];
			var wx = Math.min(wr, w[j] + sb);
			if(wx <= 1) return;
			if(sa > 1.75 && y[j] < avaliables[j].high) {
				if(sb + w[j] >= wr && y[j] - wr >= pixelBottomPixels || atGlyphBottom(stems[j]) && y[j] - wr + 1 >= pixelBottomPixels) {
					y[j] += 1;
					w[j] = wr;
					allocated[j] = true;
				} else if(y[j] - wx >= pixelBottomPixels || atGlyphBottom(stems[j]) && y[j] - wx + 1 >= pixelBottomPixels) {
					y[j] += 1;
					w[j] = wx;
					if(wx >= wr) allocated[j] = true;
				}
			}
		};
		
		for(var pass = 0; pass < 3; pass++) {
			// Allocate top and bottom stems
			for(var j = 0; j < stems.length; j++) if((atGlyphTop(stems[j]) || atGlyphBottom(stems[j])) && !allocated[j]){ allocateDown(j) };
			for(var j = stems.length - 1; j >= 0; j--) if((atGlyphTop(stems[j]) || atGlyphBottom(stems[j])) && !allocated[j]){ allocateUp(j) };
			// Allocate center stems
			for(var pass = 0; pass < WIDTH_ALLOCATION_PASSES; pass++) {
				for(var j = 0; j < stems.length; j++) if(!allocated[j]) { allocateDown(j) };
				for(var j = stems.length - 1; j >= 0; j--) if(!allocated[j]) { allocateUp(j) };
			}
		}

		// Avoid thin strokes
		for(var pass = 0; pass < 3; pass++) if(WIDTH_GEAR_PROPER >= 2 && WIDTH_GEAR_MIN >= 2) {
			for(var psi = 0; psi < 2; psi++) for(var j = stems.length - 1; j >= 0; j--) if(([false, true][psi] || !stems[j].hasGlyphStemAbove) && w[j] < [properWidths[j], 2][psi]){
				var able = true;
				for(var k = 0; k < j; k++) if(directOverlaps[j][k] && y[j] - w[j] - y[k] <= 1 && w[k] < (cover(stems[j], stems[k]) ? 2 : [2, 3][psi])) able = false;
				if(able){
					w[j] += 1;
					for(var k = 0; k < j; k++) if(directOverlaps[j][k] && y[j] - w[j] - y[k] <= 0) {
						y[k] -= 1;
						w[k] -= 1;
					}
				}
			}
			for(var j = 0; j < stems.length; j++) if(stems[j].hasGlyphStemAbove && w[j] <= 1){
				var able = true;
				for(var k = j + 1; k < stems.length; k++) {
					if(directOverlaps[k][j] && y[k] - y[j] <= w[k] + 1 && w[k] <= 2) able = false;
				}
				if(able){
					for(var k = j + 1; k < stems.length; k++) if(directOverlaps[k][j] && y[k] - y[j] <= w[k] + 1) {
						w[k] -= 1
					}
					y[j] += 1;
					w[j] += 1;
				}
			};
			
			// Triplet balancing
			for(var t = 0; t < triplets.length; t++){
				var j = triplets[t][0], k = triplets[t][1], m = triplets[t][2];
				// [3] 2 [3] 1 [2] -> [3] 1 [3] 1 [3]
				if(w[m] <= properWidths[j] - 1 && y[j] - w[j] - y[k] >= 2 && y[k] - w[k] - y[m] === 1 && y[k] < avaliables[k].high && y[m] < avaliables[k].high){
					y[k] += 1; y[m] += 1; w[m] += 1;
					if(spaceAbove(y, w, k, pixelTopPixels + 1) < 1 || spaceAbove(y, w, m, pixelTopPixels + 1) < 1 || spaceBelow(y, w, k, pixelBottomPixels - 1) < 1) {
						y[k] -= 1;
						y[m] -= 1;
						w[m] -= 1;
					}
				}
				// [1] 1 [2] 2 [2] -> [2] 1 [2] 1 [2]
				else if(w[j] <= properWidths[j] - 1 && y[j] - w[j] - y[k] === 1 && y[k] - w[k] - y[m] === 2 && y[k] > avaliables[k].low){
					w[j] += 1; y[k] -= 1;
					if(spaceBelow(y, w, j, pixelBottomPixels - 1) < 1 || spaceBelow(y, w, k, pixelBottomPixels - 1) < 1 || spaceAbove(y, w, m, pixelTopPixels + 1) < 1){ // reroll when a collision is made
						w[j] -= 1;
						y[k] += 1;
					}
				}
			}
			// Edge touch balancing
			for(var j = 0; j < stems.length; j++) {
				if(w[j] <= 1 && y[j] > pixelBottomPixels + 2) {
					var able = true;
					for(var k = 0; k < j; k++) if(directOverlaps[j][k] && !edgetouch(stems[j], stems[k])) {
						able = false;
					}
					if(able) {
						w[j] += 1;
					}
				}
			}
		};

		for(var j = 0; j < stems.length; j++) { 
			stems[j].touchwidth = w[j] * uppx;
			stems[j].ytouch = y[j] * uppx;
		};
	};
	var instructions = []
	// Touching procedure
	function touchStemPoints(stems) {
		for(var j = 0; j < stems.length; j++){
			var stem = stems[j], w = stem.touchwidth;

			var pos = ['ROUND', stem.posKey.id, stem.posKey.yori, Math.round(stem.posKeyAtTop ? stem.ytouch : stem.ytouch - w)];
			var adv = ['ALIGNW', stem.posKey.id, stem.advKey.id, stem.width / uppx, Math.round(w / uppx)]
			instructions.push({
				pos: pos,
				adv: adv,
				orient: stem.posKeyAtTop
			})
		};
	};
	
	if(!stems.length) return instructions;
	for(var j = 0; j < stems.length; j++){
		stems[j].ytouch = stems[j].yori;
		stems[j].touchwidth = uppx;
	};
	(function(){
		var y0 = [];
		for(var j = 0; j < stems.length; j++){
			y0[j] = Math.round(avaliables[j].center / uppx);
		}
		var og = new Organism(y0);
		if(og.collidePotential <= 0) {
			for(var j = 0; j < stems.length; j++){
				stems[j].ytouch = og.gene[j] * uppx;
				stems[j].touchwidth = uppx;
				stems[j].roundMethod = stems[j].ytouch >= stems[j].yori ? 1 : -1;
			}
		} else {
			earlyAdjust(stems);
			uncollide(stems);
			rebalance(stems);
			uncollide(stems);
			rebalance(stems);
		};
	})();
	allocateWidth(stems);
	touchStemPoints(stems);
	return instructions;
}

exports.hint = hint;