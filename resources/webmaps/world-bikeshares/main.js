var map = null,
	legend = null,
	worldLayerName = "world",
	bikeshareLayerName = "local",
	urlRoot = location.protocol + "//" + location.host,
	worldLayerURL = "/citybikes/rest/services/world_bikeshares/FeatureServer/1",
	worldLayer = null,
	bikeshareLayer = null,
	lastWorldExtent = null,
	extentHandler = null,
	switchScale = 500000,
	defaultZoom = 3,
	defaultCenter = [-35, 25],
	worldText = "World Bikeshare View";

var mapOptions = {
		basemap: "gray",
		sliderStyle: "small",
		wrapAround180: true,
		center: defaultCenter,
		zoom: defaultZoom
	},
	bikesharePopupTemplate = null;

// We'll use Dojo Charting to create the symbols for the World Bikeshare Map
// Thanks to Derek Swingley for the sample:
// http://dl.dropboxusercontent.com/u/2654618/election-results.html

// Declare our own charting theme.
require(["dojox/charting/Theme"], function(Theme) {
	dojo.provide("geeknixta.charting.themes.WorldBikemap");
    geeknixta.charting.themes.WorldBikemap = new Theme({
        colors: [
            "#C69F00",
            "#2C902C",
            "#7fc25d",
            "#60b32b",
            "#277085",
            "#333"
        ]
    });
});

// Because of the way requests are tiled, and the setTimeout workaround hack we
// have to employ to read the canvas output into a PNG image, we'll use a tracking
// system to know when a specific Bike Share graphic is in process or generated.
var charts = {};

// This will be the renderer getSymbol() method. Given a feature (f), it will
// create an off-screen chart using Dojo Charting, and then render it to a PNG.
// Unfortunately, the actual canvas rendering happens after this call completes
// so we actually return a null response until our "charts" symbol cache has a valid
// entry, which happens on setTimeout. When we get the symbol in setTimeout we also 
// call setSymbol(), since the renderer's getSymbol() will already have happened. on
// subsequent requests for getSymbol(), we'll have it cached so we just return it.
function createPieChart(f) {
	if (!charts.hasOwnProperty(f.attributes.name)) {
		charts[f.attributes.name] = null;
		// quick way to find max population so pie charts
		// can be sized according to total state population
		require([
			"dojox/charting/Chart", "geeknixta/charting/themes/WorldBikemap", "dojox/charting/plot2d/Pie",
			"dojo/dom", "dojo/dom-construct", "dojo/query", "dojo/on", "dojo/aspect", 
			"dojo/_base/array", "dojo/_base/connect",
			"esri/map", "esri/tasks/query", "esri/dijit/Popup",
			"dojo/domReady!"
			], 
			function(Chart, theme, PiePlot, dom, domConstruct, query, on, aspect, array, connect) {

			// Stash a placeholder symbol while we work out what this really is.
			charts[f.attributes.name] = new esri.symbol.SimpleMarkerSymbol();
			// modify the theme so the chart background is transparent
			// thanks to:  http://stackoverflow.com/a/8987358/1934
			theme.chart.fill = "transparent";

			// Some data for the chart
			var d = {
					bikes: f.attributes.bikes,
					docks: f.attributes.docks,
					network: f.attributes.name,
					point: f.geometry,
					stations: f.attributes.stations
				};
			// Make a div to hold the chart.
			var size = (d.stations > 300) ? 24 :
                (d.stations > 150) ? 18 :
                12;
			var chartNode = domConstruct.create("div", {
				id: d.network,
				class: "featureChart",
				style: {
					width: size * 2.1 + "px",
					height: size * 2.1 + "px"
				}
			}, dom.byId("charts"));
			// Set some attribute that will get read by Dojo Charting.
			chartNode.setAttribute("data-x", d.point.x);
			chartNode.setAttribute("data-y", d.point.y);
			chartNode.setAttribute("data-bikes", d.bikes);
			chartNode.setAttribute("data-docks", d.docks);
			chartNode.setAttribute("data-stations", d.stations);
			chartNode.setAttribute("data-size", size);

			// Create and render the chart.
			var chart = new Chart(chartNode);
			chart.setTheme(theme);
			chart.addPlot("default", {
				type: PiePlot,
				radius: size,
				labels: false
			});
			chart.addSeries("default", [d.docks,d.bikes]);
			chart.render();

			// The chart won't be ready for canvas rendering to a PNG until
			// the thread has dequeued some stuff. So, we'll chuck this onto the
			// and of that queue and get it as soon as we can.
			setTimeout(function() {
				// Render to PNG data.
				var imgSrc = chartNode.firstChild.toDataURL("image/png");
				var imgData = imgSrc.split(",")[1];
				// Create that symbol we couldn't return directly from getRenderer()
				var sym = new esri.symbol.PictureMarkerSymbol({
					"angle": 0,
					"xoffset": 0,
					"yoffset": 0,
					"type": "esriPMS",
					"imageData": imgData,
					"contentType": "image/png",
					"width": size,
					"height": size,
				});
				// Replace our cached symbol with this one.
				charts[f.attributes.name] = sym;
				// Set the symbol on the graphic we generated it for.
				f.setSymbol(sym);
				// Log that we created it.
				console.log("Created Symbol");
				// And remove the canvas element we created above to hold the chart.
	 			domConstruct.destroy(chartNode);
			}, 0);
		});
	}
	// We'll have something cached, whether it's the default symbol or the generated
	// chart symbol, so just return that.
	return charts[f.attributes.name];
}

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
		if (!worldLayer) {
			worldLayer = new FeatureLayer(worldLayerURL);
			document.getElementById("titleMessage").innerText = worldText;
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
			renderer.getSymbol = createPieChart;
			worldLayer.renderer = renderer;
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
