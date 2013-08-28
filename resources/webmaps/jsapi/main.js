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

function initMapWithFeatureLayerExtent(endpoint, mapOptions) {
    getExtent(endpoint, function(err, extent) {
        if (err) {
            alert(err);
            return;
        }
        require(["esri/map", "esri/layers/FeatureLayer", 
        		 "esri/dijit/InfoWindowLite", "esri/InfoTemplate", 
        		 "dojo/dom-construct", "dojo/domReady!"], 
        		function(Map, FeatureLayer, InfoWindowLite, InfoTemplate, domConstruct) {
            map = new Map("map", mapOptions);

            var infoWindow = new InfoWindowLite(null, domConstruct.create("div", null, null, map.root));
            infoWindow.startup();
            map.setInfoWindow(infoWindow);

            map.on("load", function() {
                map.setExtent(extent, true);
                var template = new InfoTemplate();
                var featureLayer = new FeatureLayer(endpoint, {
                    infoTemplate: template
                });
                map.addLayer(featureLayer);
            });
        });
    });
}

initMapWithFeatureLayerExtent(url, options);
