var url = getParameterByName("url"),
	layerFS = null;

function getParameterByName(name) {
	name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
	var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
	results = regex.exec(location.search);
	return results == null ? null : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function setExtentToFeatureLayer(endpoint) {
    var featureServiceDescriptionUrl = endpoint + "?f=json";
    var jsonfile = new XMLHttpRequest();
    jsonfile.open("GET", featureServiceDescriptionUrl, true);
    jsonfile.onreadystatechange = function() {
        if (jsonfile.readyState == 4) {
            if (jsonfile.status == 200) {
                var extent = JSON.parse(jsonfile.responseText).extent;
                console.log(extent);
                var bounds = {
                    "type": "MultiPoint",
                    "coordinates": [
                        [extent.ymin, extent.xmin],
                        [extent.ymax, extent.xmax]
                    ]
                };
                if (extent.spatialReference.wkid === 102100) {
                    var bc = bounds.coordinates;
                    bounds.coordinates = [
                        [bc[0][1], bc[0][0]],
                        [bc[1][1], bc[1][0]]
                    ];
                    bounds = Terraformer.toGeographic(bounds);
                    bc = bounds.coordinates;
                    bounds.coordinates = [
                        [bc[0][1], bc[0][0]],
                        [bc[1][1], bc[1][0]]
                    ];
                }
                map.fitBounds(bounds.coordinates);
            }
        }
    };
    jsonfile.send(null);
}

function addFeatureLayer(featureServiceUrl) {
    // Add ArcGIS Online feature service
    setExtentToFeatureLayer(featureServiceUrl);
    L.esri.featureLayer(featureServiceUrl, {
        onEachFeature: createPopup
    }).addTo(map);
}

function createPopup(geojson, layer) {
    // Show all data
    if (geojson.properties) {
        var popupText = "<div style='overflow-y:scroll; max-height:200px;'>";
        for (prop in geojson.properties) {
            var val = geojson.properties[prop];
            if (val) {
                popupText += "<b>" + prop + "</b>: " + val + "<br>";
            }
        }
        popupText += "</div>";
        layer.bindPopup(popupText);
    }
}

if (url) {
	addFeatureLayer(url);
}
