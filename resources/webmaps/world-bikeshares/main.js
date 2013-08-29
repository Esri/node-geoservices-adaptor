var map = null,
	legend = null,
	worldLayerName = "world",
	bikeshareLayerName = "local",
	urlRoot = location.protocol + "//" + location.host,
	worldLayerURL = "/citybikes/rest/services/world_bikeshares/FeatureServer/1",
	worldLayers = null,
	bikeshareLayer = null,
	lastWorldExtent = null,
	extentHandler = null,
	switchScale = 500000,
	defaultZoom = 3,
	defaultCenter = [-35, 25],
	worldText = "World Bikeshare View",
	colors = ["#55BB55", "#EE4466"];

var mapOptions = {
		basemap: "gray",
		sliderStyle: "small",
		wrapAround180: true,
		center: defaultCenter,
		zoom: defaultZoom
	},
	bikesharePopupTemplate = null;

function pathStrings(pieData) {
	// Modified from http://stackoverflow.com/a/15582018
	var total = pieData.reduce(function (accu, that) { return that + accu; }, 0);
    var sectorAngleArr = pieData.map(function (v) { return 360 * v / total; });

	var radius = 9,
		centerX = 0,
		centerY = 0;
	var paths = [];

    var startAngle = 0;
    var endAngle = 0;
    for (var i=0; i<sectorAngleArr.length; i++){
        startAngle = endAngle;
        endAngle = startAngle + sectorAngleArr[i];

        var x1,x2,y1,y2 ;

        x1 = parseInt(Math.round(centerX + radius*Math.cos(Math.PI*startAngle/180)));
        y1 = parseInt(Math.round(centerY + radius*Math.sin(Math.PI*startAngle/180)));

        x2 = parseInt(Math.round(centerX + radius*Math.cos(Math.PI*endAngle/180)));
        y2 = parseInt(Math.round(centerY + radius*Math.sin(Math.PI*endAngle/180)));

        var d = "M" + centerX + "," + centerY + 
        		"  L" + x1 + "," + y1 + 
        		"  A" + radius + "," + radius + " 0 " + 
                ((endAngle-startAngle > 180) ? 1 : 0) + ",1 " + x2 + "," + y2 + " z";
        paths.push(d);
    }
    return paths;
}

function createSymbol(path, color) {
	var markerSymbol = new esri.symbol.SimpleMarkerSymbol();
	markerSymbol.setPath(path);
	markerSymbol.setColor(new dojo.Color(color));
	markerSymbol.setOutline(null);
	return markerSymbol;
}

var charts = [];

var temptemp = "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";

function createPieChart(f) {
	if (!f.hasOwnProperty("__chart")) {
		// quick way to find max population so pie charts
		// can be sized according to total state population
		require([
			"dojox/charting/Chart", "dojox/charting/themes/CubanShirts", "dojox/charting/plot2d/Pie",
			"dojo/dom", "dojo/dom-construct", "dojo/query", "dojo/on", "dojo/aspect", 
			"dojo/_base/array", "dojo/_base/connect",
			"esri/map", "esri/tasks/query", "esri/dijit/Popup",
			"dojo/domReady!"
			], 
			function(Chart, theme, PiePlot, dom, domConstruct, query, on, aspect, array, connect) {
			  // modify the theme so the chart background is transparent
			  // thanks to:  http://stackoverflow.com/a/8987358/1934
			theme.chart.fill = "transparent";
			var d = {
					bikes: f.attributes.bikes,
					docks: f.attributes.docks,
					network: f.attributes.name,
					point: f.geometry,
					size: f.attributes.stations
				}
	
// 	//     array.forEach(chartData, function(d, idx) {
// 			// size chart (roughly) according to total populatiion
			var size = 30;//d.size;
// 			// console.log("size is: ", size);
// 			// size chart node according to chart size/radius
			var chartNode = domConstruct.create("div", {
				id: d.network,
				class: "featureChart",
				style: {
					width: size * 2.1 + "px",
					height: size * 2.1 + "px"
				}
			}, dom.byId("charts"));
			chartNode.setAttribute("data-x", d.point.x);
			chartNode.setAttribute("data-y", d.point.y);
			chartNode.setAttribute("data-bikes", d.bikes);
			chartNode.setAttribute("data-docks", d.docks);
			chartNode.setAttribute("data-stations", d.stations);
			chartNode.setAttribute("data-size", size);

			var chart = new Chart(chartNode);
			chart.setTheme(theme);
			chart.addPlot("default", {
				type: PiePlot,
				radius: size,
				labels: false
			});
			chart.addSeries("default", [d.bikes,d.docks]);
			chart.render();
// 	//         charts.push(chart);
			debugger;
			var imgSrc = chartNode.firstChild.toDataURL("image/png");
			var imgData = imgSrc.split(",")[1];
			var sym = new esri.symbol.PictureMarkerSymbol({
				"angle": 0,
				"xoffset": 0,
				"yoffset": 0,
				"type": "esriPMS",
				"imageData": imgData, //,
				"contentType": "image/png",
				"width": size,
				"height": size,
			});
			f.__chart = sym;
			console.log(sym);
// 			domConstruct.destroy(chart.node);
		});
	}
	return f.__chart;
}
    // use setTimeout to wait for charts/canvas elements to finish 
    // renderering before accessing them
    // hacky...but explained here:  http://javascriptweblog.wordpress.com/2010/06/28/understanding-javascript-timers/
//     setTimeout(function() {
//         query(".featureChart").forEach(function(node) {
//             var imgSrc = node.firstChild.toDataURL("image/png");
//             var sym = new esri.symbol.PictureMarkerSymbol({
//                 "angle": 0,
//                 "xoffset": 0,
//                 "yoffset": 0,
//                 "type": "esriPMS",
//                 "imageData": imgSrc.split(",")[1],
//                 "contentType": "image/png",
//                 "width": node.dataset.size,
//                 "height": node.dataset.size,
//             });
//             var x = node.dataset.x;
//             var y = node.dataset.y
//             var pt = new esri.geometry.Point(x, y, map.spatialReference);
//             var attrs = {
//                 "State": node.id,
//                 "Obama": node.dataset.obama,
//                 "Romney": node.dataset.romney,
//                 "Population": node.dataset.population
//             }
//             var template = new esri.InfoTemplate("${State}", "Obama:  ${Obama}%<br>Romney:  ${Romney}%<br>Population: ${Population}");
//             var graphic = new esri.Graphic(pt, sym, attrs, template);
//             map.graphics.add(graphic);
//         });
        // now that there are picture marker symbols on the map, remove all charts
//         array.forEach(charts, function(ch) {
//             domConstruct.destroy(ch.node);
//         });
//     }, 0);















function getParameterByName(name) {
	name = name.replace(/[\[]/, "\[").replace(/[\]]/, "\]");
	var regex = new RegExp("[\?&]" + name + "=([^&#]*)"),
		results = regex.exec(location.search);
	return results == null ? null : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function getExtent(layerEndpoint, callback) {
    var featureServiceDescriptionUrl = layerEndpoint + "?f=json";
    var jsonfile = new XMLHttpRequest();
    jsonfile.open("GET", featureServiceDescriptionUrl, true);
    jsonfile.onreadystatechange = function() {
        if (jsonfile.readyState == 4) {
            if (jsonfile.status == 200) {
                require(["esri/geometry/Extent"], function(Extent) {
                    var extent = JSON.parse(jsonfile.responseText).extent;
                    extent = new Extent(extent);
                    return callback(null, extent);
                });
            } else {
                return callback("Could not get extent", null);
            }
        }
    };
    jsonfile.send(null);
}

function openBikeshareLayer(g) {
	var url = g.attributes.url;
	lastWorldExtent = map.extent;
	getExtent(url, function(err, extent) {
		if (!err) {
			if (extentHandler) {
				extentHandler.remove();
			}
			require(["esri/layers/FeatureLayer", "esri/InfoTemplate"],
					function(FeatureLayer, InfoTemplate) {
				if (bikeshareLayer) {
					map.removeLayer(bikeshareLayer);
					delete bikeshareLayer;
				}
				bikeshareLayer = new FeatureLayer(url, {
                    infoTemplate: new InfoTemplate("${bikesClass} at ${name}",
                    	"<tr>Bikes: <td>${bikes}</td></tr><br>" + 
                    	"<tr>Docks: <td>${free}</td></tr>")
                });
				bikeshareLayer.world_network_details = g.attributes;
				bikeshareLayer.setMinScale(switchScale);
				bikeshareLayer.on("load", function() {
					require(["esri/dijit/Legend", "dojo/dom-construct"], 
							function(Legend, domConstruct) {
						legend = new Legend({
							map: map,
							layerInfos: [{
								layer: bikeshareLayer
							}],
						}, domConstruct.create("div", {id: "mainLegend", class: "legend"}, map.root));
						legend.startup();
					});
				});
				map.addLayer(bikeshareLayer);
				map.setExtent(extent, true);
			});
		} else {
			console.log("Error loading layer! " + err);
		}
	});
}

function openWorldLayer() {
	require(["esri/layers/FeatureLayer",
			 "esri/renderers/SimpleRenderer", "esri/symbols/SimpleMarkerSymbol"], 
			function(FeatureLayer, SimpleRenderer, SimpleMarkerSymbol) {
		if (!worldLayers) {
			worldLayers = [new FeatureLayer(worldLayerURL), new FeatureLayer(worldLayerURL)];
			document.getElementById("titleMessage").innerText = worldText;
			for (var i=0; i<worldLayers.length; i++) {
				var worldLayer = worldLayers[i];
				worldLayer.setMaxScale(switchScale);
				map.addLayer(worldLayer);
				worldLayer.on("click", function(e) {
					var g = e.graphic;
					if (g) {
						openBikeshareLayer(g);
					}
				});
				worldLayer.on("scale-visibility-change", function(e) {
					if (worldLayer.isVisibleAtScale(map.getScale())) {
						document.getElementById("titleMessage").innerText = worldText;
						document.getElementById("userMessage").innerText = "";
						map.infoWindow.hide();
						if (legend) { legend.destroy() };
					} else {
						var details = bikeshareLayer.world_network_details;
						document.getElementById("titleMessage").innerText = details.name;
						var dStr = " open dock" + (details.docks>1?"s":"");
						var bStr = " available bike" + (details.bikes>1?"s":"");
						document.getElementById("userMessage").innerHTML = details.stations + 
							" stations<br/>(" + details.docks + dStr + ", " + details.bikes + bStr + ")";
					}
				});
				var renderer = new SimpleRenderer(new SimpleMarkerSymbol());
				renderer._bikeLayer = i;
				renderer.getSymbol = createPieChart;
// 				renderer.getSymbol = function(graphic) {
// 					var docks = graphic.attributes.docks,
// 						bikes = graphic.attributes.bikes,
// 						paths = pathStrings([docks, bikes]);
// 					return createSymbol(paths[this._bikeLayer], colors[this._bikeLayer]);
// 				}
				worldLayer.renderer = renderer;
			}
		}

		if (lastWorldExtent) {
			map.setExtent(lastWorldExtent);
		} else {
			map.centerAndZoom(defaultCenter, defaultZoom);
		}
	});
}

function initApp() {
	require(["esri/map", "esri/dijit/InfoWindowLite", "esri/InfoTemplate", 
			 "dojo/dom-construct", "dojo/domReady!"], 
			function(Map, InfoWindowLite, InfoTemplate, domConstruct) {
		map = new Map("map", mapOptions);

		var parameterRoot = getParameterByName("urlroot");
		if (parameterRoot) {
			urlRoot = parameterRoot;
		}

		worldLayerURL = urlRoot + worldLayerURL;

		var infoWindow = new InfoWindowLite(null, domConstruct.create("div", null, null, map.root));
		infoWindow.startup();
		map.setInfoWindow(infoWindow);
		map.infoWindow.resize(350, 75);

		map.on("load", function() {
			openWorldLayer();
			document.getElementById("btnBackToWorldView").onclick = openWorldLayer;
		});
	});
}

initApp();
