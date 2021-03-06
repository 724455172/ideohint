"use strict"

var fs = require("fs");
var roundings = require("../roundings");
const { mix } = require('../support/common');
function pushWhenAbsent(a, x) {
	a.push(x);
}

function createCvt(src, strategy, padding) {
	var MAX_SW = 5;
	var cvt = (src || []).slice(0);
	padding = padding || 0;
	if (padding) cvt = cvt.slice(0, padding);
	while (cvt.length < padding) cvt.push(0);
	pushWhenAbsent(cvt, 0);
	var upm = strategy.UPM;
	pushWhenAbsent(cvt, strategy.BLUEZONE_TOP_CENTER);
	pushWhenAbsent(cvt, strategy.BLUEZONE_BOTTOM_CENTER);
	pushWhenAbsent(cvt, 0);
	for (var ppem = 1; ppem <= strategy.PPEM_MAX; ppem++) {
		var rtg = roundings.Rtg(strategy.UPM, ppem);
		var vtop = Math.round(rtg(strategy.BLUEZONE_BOTTOM_CENTER) + rtg(strategy.BLUEZONE_TOP_CENTER - strategy.BLUEZONE_BOTTOM_CENTER));
		pushWhenAbsent(cvt, vtop);
	}
	for (var w = 1; w <= MAX_SW; w++) {
		for (var ppem = strategy.PPEM_MIN; ppem <= strategy.PPEM_MAX; ppem++) {
			pushWhenAbsent(cvt, -Math.round(strategy.UPM / ppem * w));
		}
	}
	for (var w = 1; w <= MAX_SW; w++) {
		for (var ppem = strategy.PPEM_MIN; ppem <= strategy.PPEM_MAX; ppem++) {
			pushWhenAbsent(cvt, Math.round(strategy.UPM / ppem * w));
		}
	}
	return cvt;
}

exports.getPadding = function (argv, parameterFile) {
	if (parameterFile && parameterFile.cvt) {
		return (parameterFile.cvt.padding - 0) || 0;
	} else if (argv.CVT_PADDING) {
		return (argv.CVT_PADDING - 0) || 0;
	} else {
		return 0;
	}
};
exports.createCvt = createCvt;
exports.getVTTAux = function (bot, top) {
	const p = 1 / 20;
	const pd = 1 / 40;
	return {
		yBotBar: Math.round(mix(bot, top, p)),
		yBotD: Math.round(mix(bot, top, pd)),
		yTopBar: Math.round(mix(top, bot, p)),
		yTopD: Math.round(mix(top, bot, pd)),
	}
}
