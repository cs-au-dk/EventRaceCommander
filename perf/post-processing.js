var fs = require('fs');
var path = require('path');
var url = require('url');

function postProcess(site, perfdir, callback) {
	var idsComplete = 0;

	for (var j = 0; j < site.ids.length; ++j) {
		(function (id) {
			var iterationsComplete = 0;

			for (var k = 0; k < id.iterations.length; ++k) {
				(function (iteration) {
					getHeapMaps(site, perfdir, id.name, iteration.name, function (heatMaps) {
						iteration.heatMaps = heatMaps;

						if (++iterationsComplete === id.iterations.length) {
							iterationsDone();
						}
					});
				})(id.iterations[k]);
			}

			function iterationsDone() {
				for (var l = id.iterations.length-1; l >= 0; --l) {
					if (!id.iterations[l].heatMaps) {
						id.iterations.splice(l, 1);
					}
				}

				id.iterations.unshift({
					name: 'Avg.',
					heatMaps: computeAvgHeatMaps(id.iterations)
				});

				if (++idsComplete === site.ids.length) {
					idsDone();
				}
			}
		})(site.ids[j]);
	}

	function idsDone() {
		site.summary = computeSiteSummary(site);
		callback();
	}
}

function getHeapMaps(site, perfdir, id, iteration, cb) {
	loadRawData(site, perfdir, id, iteration, function (networkMessages, tracingMessages) {
		cb(computeHeatMaps(site.info.url, id, iteration, networkMessages, tracingMessages));
	});
}

function loadRawData(site, perfdir, id, iteration, cb) {
	var other;
	['network.json', 'tracing.json'].forEach(function (file) {
		fs.readFile(path.join(perfdir, id, iteration, file), function (err, content) {
			var data = JSON.parse(content.toString());
			if (other) {
				file === 'network.json' ? cb(data, other) : cb(other, data);
			} else {
				other = data;
			}
		});
	});
}

function computeHeatMaps(_url, id, iteration, networkMessages, tracingMessages) {
	var heatMaps = [];
	var urlNoHash = _url.indexOf('#') >= 0 ? _url.substring(0, _url.indexOf('#')) : _url;

	var _initialNetworkMessage, initialNetworkMessage, _initialTracingMessage, initialTracingMessage;

	for (var i = 0, n = networkMessages.length; i < n; ++i) {
		var m = networkMessages[i];
		if (_initialNetworkMessage) {
			if (m.name === 'loadingFinished' && m.message.requestId === _initialNetworkMessage.message.requestId) {
				initialNetworkMessage = m;
				break;
			}
		} else if (m.name === 'requestWillBeSent' && (m.message.request.url === _url || m.message.request.url === urlNoHash)) {
			_initialNetworkMessage = m;
		}
	}

	var tracingMessagesByCategory = {};

	for (var i = 0, n = tracingMessages.length; i < n; ++i) {
		var e = tracingMessages[i];
		var name = e.name === 'EventDispatch' ? ('EventDispatch(' + e.args.data.type + ')') : e.name;
		if (_initialTracingMessage) {
			if (name === 'ResourceReceiveResponse' && e.args.data.requestId === _initialTracingMessage.args.data.requestId) {
				initialTracingMessage = e;
			}
		} else if (name === 'ResourceSendRequest' && (e.args.data.url === _url || e.args.data.url === urlNoHash)) {
			_initialTracingMessage = e;
		}
		if (!tracingMessagesByCategory[name]) {
			tracingMessagesByCategory[name] = [];
		}
		tracingMessagesByCategory[name].push(e);
	}

	if (!initialNetworkMessage) {
		console.error('Could not locate initial network message, id:', id + ', iteration:', iteration + ', url:', _url);
		return;
	}
	if (!initialTracingMessage) {
		console.error('Could not locate initial tracing message, id:', id + ', iteration:', iteration + ', url:', _url);
		return;
	}

	var max = 0;
	for (var i = 0, n = networkMessages.length; i < n; ++i) {
		var m = networkMessages[i];
		var time = Math.round((m.message.timestamp - initialNetworkMessage.message.timestamp)*1000);
		max = Math.max(max, time);

		if (m.name === 'requestWillBeSent' && m.message.request.url.indexOf('http://www.metrics.com/?') === 0) {
			var query = url.parse(m.message.request.url, true).query;
			for (var key in query) {
				if (query.hasOwnProperty(key) && key !== 'instr') {
					var name = 'Metric(' + key + ')';
					if (!tracingMessagesByCategory[name]) {
						tracingMessagesByCategory[name] = [];
					}
					tracingMessagesByCategory[name].push({ name: name, ts: initialTracingMessage.ts + parseFloat(query[key]) * 1000 });
				}
			}
		}
	}

	var tracingMax = initialTracingMessage.dur || 0;
	for (var i = 0, n = tracingMessages.length; i < n; ++i) {
		var m = tracingMessages[i];
		var time = Math.round((m.ts + (m.dur || 0) - initialTracingMessage.ts)/1000);
		max = Math.max(max, time);
	}

	heatMaps.push(computeHeatMapForMetric('Network', max, networkMessages, function (m) {
			return Math.round((m.message.timestamp-initialNetworkMessage.message.timestamp)*1000);
	}));
	for (var metric in tracingMessagesByCategory) {
		if (tracingMessagesByCategory.hasOwnProperty(metric)) {
			heatMaps.push(computeHeatMapForMetric(metric, max, tracingMessagesByCategory[metric], function (m) {
				return Math.round((m.ts + (m.dur || 0) - initialTracingMessage.ts)/1000);
			}));
		}
	}

	return heatMaps;
}

function computeHeatMapForMetric(metric, max, messages, getTime) {
	var numRows = 100;
	var gapSize = max/numRows;
	var gaps = [];
	var maxGapSize = 0;
	var finished = 0;
	for (var i = 0, n = messages.length; i < n; ++i) {
		finished = Math.max(finished, getTime(messages[i]));
	}
	var metricHeatMap = { name: metric, finished: finished, last: finished === max };
	for (var i = 0; i < numRows; ++i) {
		var gap = [];
		var left = gapSize*i;
		var right = gapSize*(i+1);
		for (var j = 0, n = messages.length; j < n; ++j) {
			var m = messages[j];
			var time = getTime(m);
			if (time >= left && time < right) {
				gap.push(m);
			}
		}
		maxGapSize = Math.max(maxGapSize, gap.length);
		gaps.push(gap);
	}
	for (var i = 0; i < numRows; ++i) {
		var gap = gaps[i];
		var minColor = 0, maxColor = 255;
		var c = 255-(minColor+Math.round(gap.length/maxGapSize*(maxColor-minColor)));
	}
	return metricHeatMap;
}

function computeAvgHeatMaps(iterations) {
	var heatMapsByName = {};
	var maxFinished = 0;
	for (var i = 0; i < iterations.length; ++i) {
		var iteration = iterations[i];
		if (iteration.heatMaps) {
			for (var j = 0; j < iteration.heatMaps.length; ++j) {
				var heatMap = iteration.heatMaps[j];
				if (heatMapsByName[heatMap.name]) {
					heatMapsByName[heatMap.name].finished += heatMap.finished;
					heatMapsByName[heatMap.name].dataset.push(heatMap.finished);
				} else {
					heatMapsByName[heatMap.name] = { name: heatMap.name, dataset: [heatMap.finished], finished: heatMap.finished };
				}
				maxFinished = Math.max(maxFinished, heatMapsByName[heatMap.name].finished);
			}
		}
	}
	var heatMaps = [];
	for (var name in heatMapsByName) {
		if (heatMapsByName.hasOwnProperty(name)) {
			var heatMap = heatMapsByName[name];
			if (heatMap.finished === maxFinished) {
				heatMap.last = true;
			}
			heatMap.finished = Math.round(heatMap.finished / iterations.length);
			heatMaps.push(heatMap);
		}
	}
	return heatMaps;
}

function computeSiteSummary(site) {
	var rowsByName = {};
	for (var i = 0; i < site.ids.length; ++i) {
		var id = site.ids[i];
		var avg = id.iterations[0];
		for (var j = 0; j < avg.heatMaps.length; ++j) {
			var heatMap = avg.heatMaps[j], row;
			if (rowsByName[heatMap.name]) {
				row = rowsByName[heatMap.name];
			} else {
				row = rowsByName[heatMap.name] = { name: heatMap.name };
			}
			row[id.name] = { avg: heatMap.finished, dataset: heatMap.dataset };
		}
	}
	var baseline = site.ids[0].name;
	for (var i = 0; i < baseline.length; ++i) {
		if (site.ids[0].name === 'original') {
			baseline = 'original';
			break;
		}
	}
	var rows = [];
	for (var name in rowsByName) {
		if (rowsByName.hasOwnProperty(name)) {
			var row = rowsByName[name];
			rows.push(row);
		}
	}
	return { baseline: baseline, rows: rows };
}

module.exports = postProcess;
