var map = null,
	worldLayerName = "world",
	bikeshareLayerName = "local",
	urlRoot = "http://geonode.geeknixta.com",
	worldLayerURL = "/citybikes/rest/services/world_bikeshares/FeatureServer/0",
	worldLayer = null,
	bikeshareLayer = null,
	lastWorldExtent = null,
	extentHandler = null,
	switchScale = 500000,
	defaultZoom = 3,
	defaultCenter = [-35,0];
	worldText = "World Bikeshare View",
	localText = "Local Bikeshare View";

var mapOptions = {
        basemap: "gray",
        sliderStyle: "small",
        wrapAround180: true,
        center: defaultCenter,
        zoom: defaultZoom
    },
    bikesharePopupTemplate = null;

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
			var gotExtent = false;
			if (jsonfile.status == 200) {
				require(["esri/geometry/Extent"], function(Extent) {
					var extent = JSON.parse(jsonfile.responseText).extent;
					extent = new Extent(extent);
					gotExtent = true;
					return callback(null, extent);	
				});
			}
			if (!gotExtent) {
				console.trace();
				callback("Could not get extent", null);
			}
		}
	};
	jsonfile.send(null);
}

function openBikeshareLayer(g) {
	var url = g.attributes.url;
	getExtent(url, function(err, extent) {
		if (!err) {
			if (extentHandler) {
				extentHandler.remove();
			}
		    require(["esri/layers/FeatureLayer"], function(FeatureLayer) {
				if (bikeshareLayer) {
					map.removeLayer(bikeshareLayer);
					delete bikeshareLayer;
				}
				bikeshareLayer = new FeatureLayer(url);
				bikeshareLayer.world_network = g.attributes.name;
				bikeshareLayer.setMinScale(switchScale);
				map.addLayer(bikeshareLayer);
				map.setExtent(extent, true);
		    });
		} else {
			console.log("Error loading layer! " + err);
		}
	});
}

function openWorldLayer() {
	require(["esri/layers/FeatureLayer"], function(FeatureLayer) {
		if (!worldLayer) {
			document.getElementById("titleMessage").innerText = worldText;
			worldLayer = new FeatureLayer(worldLayerURL);
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
				} else {
					document.getElementById("titleMessage").innerText = bikeshareLayer.world_network;
				}
			});
		}
		
		map.centerAndZoom(defaultCenter,defaultZoom);
	
		extentHandler = map.on("extent-change", function(extent) {
			lastWorldExtent = extent;
		});
	});
}

function initApp() {
    require(["esri/map", "esri/geometry/Extent", "esri/layers/FeatureLayer", 
    		 "esri/dijit/InfoWindowLite", "esri/InfoTemplate", 
    		 "dojo/dom-construct", "dojo/domReady!"], 
			function(Map, Extent, FeatureLayer, 
					 InfoWindowLite, InfoTemplate, 
					 domConstruct) {
		map = new Map("map", mapOptions);
		
		var parameterRoot = getParameterByName("urlroot");
		if (parameterRoot) {
			urlRoot = parameterRoot;
		}
		
		worldLayerURL = urlRoot + worldLayerURL;

		var infoWindow = new InfoWindowLite(null, domConstruct.create("div", null, null, map.root));
		infoWindow.startup();
		map.setInfoWindow(infoWindow);

		map.on("load", function() {
			var bikesharePopupTemplate = new InfoTemplate();
			openWorldLayer();
			document.getElementById("btnBackToWorldView").onclick = openWorldLayer;
		});
	});
}

initApp();
