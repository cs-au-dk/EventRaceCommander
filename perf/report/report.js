var app = angular.module('reportApp', ['ngRoute']);

app.config(function($routeProvider) {
    $routeProvider
    .when('/', {
        templateUrl: 'templates/summary.html',
        controller: 'SummaryController'
    })
    .when('/:siteId', {
        templateUrl: 'templates/site.html',
        controller: 'SiteController'
    })
    .otherwise('/');
});

app.controller('SummaryController', ['$rootScope', '$scope', '$http', function ($rootScope, $scope, $http) {
	$scope.baseline = null;
	$scope.columns = [];
	$scope.columnNames = [];
	$scope.metric = 'EventDispatch(DOMContentLoaded)';
	$scope.metrics = [
		{ name: 'EventDispatch(DOMContentLoaded)', active: true },
		{ name: 'Layout' },
		{ name: 'Metric(asyncScripts)' },
		{ name: 'Metric(postponedAsyncScripts)' },
		{ name: 'Metric(postponed)' }
	];
	$scope.reports = [];

	$http({ method: 'GET', url: '../../fortune20.json' }).then(function (response) {
		response.data.forEach(function (site) {
			$http({ method: 'GET', url: '../data/' + site.name + '/perf-report.json' }).then(function (response) {
				var report = response.data;
				$scope.reports.push(report);

                $rootScope.cache = ($rootScope.cache || {})[report.name] = report;

				// Create columns, if any new
				for (var j = 0; j < report.ids.length; ++j) {
					var id = report.ids[j];
					if ($scope.columnNames.indexOf(id.name) < 0) {
						$scope.columnNames.push(id.name);
						$scope.columns.push({ name: id.name, type: 'ms' });
						$scope.columns.push({ name: id.name, type: '+' });
						$scope.columns.push({ name: id.name, type: 'x' });

						if (!$scope.baseline || id.name === 'original') {
							$scope.baseline = id.name;
						}
					}
				}
			});
		});
	});

	$scope.setBaseline = function (baseline) {
		$scope.baseline = baseline;
	};

	$scope.setMetric = function (metric) {
		$scope.metric = metric.name;
	};

	$scope.cell = function (report, id, factor) {
		for (var i = 0; i < report.summary.rows.length; ++i) {
			var row = report.summary.rows[i];
			if (row.name === $scope.metric) {
				if (!row[id]) return;
				var avg = row[id].avg;
				if (!factor) return avg;
				if (!row[$scope.baseline]) return;
				var baseline = row[$scope.baseline].avg;
				if (factor === 'diff') {
					var diff = avg - baseline;
					return (diff > 0 ? '+' : '') + diff + 'ms';
				} else if (factor === 'factor') {
					var factor = Math.round(avg/baseline*100)/100;
					if (!isNaN(factor) && factor !== Infinity) {
						return factor + 'x';
					}
				}
				break;
			}
		}
	};

	$scope.getSummaryFactor = function (site, id, row) {
		try {
			var current = row[id].avg;
			var other = row[site.summary.baseline].avg;
			var factor = Math.round(current/other*100)/100;
			if (!isNaN(factor) && factor !== Infinity) {
				return factor + 'x';
			}
		} catch (e) {
		}
	};

	$scope.tab = function (o) {
		for (var i = 1; i < arguments.length; ++i) {
			var argument = arguments[i];
			if (argument instanceof Array) {
				for (var j = 0; j < argument.length; ++j) {
					argument[j].active = false;
				}
			} else {
				argument.active = false;
			}
		}
		o.active = true;
	};
}]);


app.controller('SiteController', ['$rootScope', '$routeParams', '$scope', '$http', '$timeout', function($rootScope, $routeParams, $scope, $http, $timeout) {
    $scope.site = null;
    $scope.selectedMetric = 'EventDispatch(DOMContentLoaded)';
    
    if ($rootScope.cache && $routeParams.siteId in $rootScope.cache) {
        $scope.site = $rootScope.cache[$routeParams.siteId];
        $scope.tab($scope.site.summary);

        $timeout(function () {
            $scope.selectMetric('EventDispatch(DOMContentLoaded)');
        }, 500);
    } else {
        $http({ method: 'GET', url: '../data/' + $routeParams.siteId + '/perf-report.json' }).then(function (response) {
            $scope.site = response.data;
            $scope.tab($scope.site.summary);

            $timeout(function () {
                $scope.selectMetric('EventDispatch(DOMContentLoaded)');
            }, 500);
        });
    }

    $scope.setSummaryBaseline = function (site, baseline) {
        site.summary.baseline = baseline;
    };

    $scope.getSummaryCols = function (site) {
        if (!site._summaryCols) {
            var cols = [];
            for (var i = 0; i < site.ids.length; ++i) {
                var id = site.ids[i];
                cols.push({ name: id.name, type: 'ms' });
                cols.push({ name: id.name, type: '+' });
                cols.push({ name: id.name, type: 'x' });
            }
            site._summaryCols = cols;
        }
        return site._summaryCols;
    };

    $scope.getCell = function (site, id, row, type) {
        try {
            var current = row[id].avg;
            var other = row[site.summary.baseline].avg;
            if (type === '+') {
                var diff = current-other;
                return (diff > 0 ? '+' : '') + diff + 'ms'
            } else if (type === 'x') {
                var factor = Math.round(current/other*100)/100;
                if (!isNaN(factor) && factor !== Infinity) {
                    return factor + 'x';
                }
            }
        } catch (e) {
        }
    };

    $scope.selectMetric = function (metric) {
        $scope.selectedMetric = metric;
        makeBoxPlot($scope.site, metric);
    };

    $scope.tab = function (o) {
        for (var i = 1; i < arguments.length; ++i) {
            var argument = arguments[i];
            if (argument instanceof Array) {
                for (var j = 0; j < argument.length; ++j) {
                    argument[j].active = false;
                }
            } else {
                argument.active = false;
            }
        }
        o.active = true;

        if (o.iterations && o.iterations.length) {
            $scope.tab(o.iterations[0], o.iterations);
        }

        if (o === $scope.site.summary) {
            $timeout(function () {
                $scope.selectMetric($scope.selectedMetric);
            }, 500);
        }
    };

    $scope.nameAsNumber = function (o) {
        return o.name === 'Avg.' ? 0 : parseInt(o.name);
    };

    $scope.showRow = function (row) {
        return [
            'EventDispatch(DOMContentLoaded)', 'Layout', 'Network',
            'Paint', 'ParseHTML', 'UpdateLayoutTree'
        ].indexOf(row.name) >= 0;
    };
}]);

function makeBoxPlot(site, selectedMetric) {
    var experiments = [];

    for (var i = 0; i < site.summary.rows.length; ++i) {
        var metric = site.summary.rows[i];
        if (metric.name !== selectedMetric) {
            continue;
        }
        for (var j = 0; j < site.ids.length; ++j) {
            var id = site.ids[j];
            var dataset = metric[id.name].dataset;
            for (var k = 0; k < dataset.length; ++k) {
                experiments.push({ expId: id.name, id: k, value: dataset[k] });
            }
        }
    }

    var chart = dc.boxPlot("#boxplot");
    var ndx                 = crossfilter(experiments);
    var runDimension        = ndx.dimension(function(d) { return d.id; });
    var runGroup            = runDimension.group();
    var experimentDimension = ndx.dimension(function(d) { return d.expId; });
    var speedArrayGroup     = experimentDimension.group().reduce(
        function(p,v) {
            p.push(v.value);
            return p;
        },
        function(p,v) {
            p.splice(p.indexOf(v.value), 1);
            return p;
        },
        function() {
            return [];
        });

    chart
        .width(document.querySelector('.tab-content').offsetWidth)
        .height(700)
        .margins({ top: 10, right: 50, bottom: 30, left: 50 })
        .dimension(experimentDimension)
        .group(speedArrayGroup)
        .elasticY(true)
        .elasticX(true);

    var ids = site.ids.length;
    var colorScale = d3.scale.category10();
    var colors = [];
    for (var j = 0; j < site.ids.length; ++j) {
        colors.push(colorScale(i));
    }
    chart.ordinalColors(colors);

    dc.renderAll();
}

function range(to) {
    var result = [];
    for (var i = 0; i < to; ++i) {
        result.push(i);
    }
    return result;
}
