var map = null;

var url = getParameterByName("url"),
    options = {
        basemap: "gray",
        sliderStyle: "small"
    };

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\[").replace(/[\]]/, "\]");
    var regex = new RegExp("[\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results == null ? null : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function initMapWithFeatureLayerExtent(endpoint, mapOptions) {
    require(["esri/map", "esri/geometry/Extent", "esri/layers/FeatureLayer", "esri/dijit/InfoWindowLite", "esri/InfoTemplate", "dojo/dom-construct", "dojo/domReady!"], 
    function(Map, Extent, FeatureLayer, InfoWindowLite, InfoTemplate, domConstruct) {
        var featureServiceDescriptionUrl = endpoint + "?f=json";
        var jsonfile = new XMLHttpRequest();
        jsonfile.open("GET", featureServiceDescriptionUrl, true);
        jsonfile.onreadystatechange = function() {
            if (jsonfile.readyState == 4) {
                if (jsonfile.status == 200) {
                    var extent = JSON.parse(jsonfile.responseText).extent;
                    console.log(extent);
                    mapOptions.extent = new Extent(extent, false);
                    mapOptions.fitExtent = true;

                    map = new Map("map", mapOptions);

					var infoWindow = new InfoWindowLite(null, domConstruct.create("div", null, null, map.root));
					infoWindow.startup();
					map.setInfoWindow(infoWindow);

                    map.on("load", function() {
						var template = new InfoTemplate();
// 						template.setTitle("<b>TITLE</b>");
// 						template.setContent("CONTENT goes here says I");

                        var featureLayer = new FeatureLayer(endpoint, {infoTemplate:template});
                        map.addLayer(featureLayer);
//                         map.infoWindow.resize(200, 75);
                    });
                }
            }
        };
		jsonfile.send(null);
	});
}

initMapWithFeatureLayerExtent(url, options);
