var util = require("util"),
    path = require("path"),
    agsdp = require("../../src/agsdataproviderbase"),
    agsurls = require("../../src/agsurls"),
    Geohub = require("geohub"),
    TerraformerArcGIS = require("terraformer-arcgis-parser");

var geohubRepoDescription = "Use the following query parameters to output GeoServices info from a GeoJSON Source:" + "<ul>" + "<li><b>githubUser</b>: The repo owner's username</li>" + "<li><b>repoName</b>: The name of the repo containing the GeoJSON file</li>" + "<li><b>filePath</b>: The path to the GeoJSON file within the repo</li>" + "<li><b>geoJSONType</b> (optional): The geoJSON Geometry Type to extract (since a FeatureLayer may emit a featureset with only a single geometry type). " + "If this is omitted, the first geoJSON Geometry will define the type used to filter on. Note, this is ignored if f=geojson</li>" + "</ul>" + "You can also specify the URL as .../geohub/rest/services/repo/<b>githubUsername</b>/<b>repoName</b>/<b>filePath</b>/FeatureService/0<br/>" + "If you use the URL approach, encode path separators in the <b>filePath</b> portion of the URL";

var geohubGistDescription = "Use the following query parameters to output GeoServices info from a GeoJSON Source:" + "<ul>" + "<li><b>gistId</b>: The unique ID of the Gist</li>" + "<li><b>geoJSONType</b> (optional): The geoJSON Geometry Type to extract (since a FeatureLayer may emit a featureset with only a single geometry type). " + "If this is omitted, the first geoJSON Geometry will define the type used to filter on. Note, this is ignored if f=geojson</li>" + "</ul>" + "A Gist may include many geoJSON files. The Layer Index is used to return the correct file starting with index 0. " + "If the requested format is geojson (f=geojson) then you may use * for the layerId to return all encountered geoJSON in the gist." + "<br/>You can also specify the URL as .../geohub/rest/services/gist/<b>gistId</b>/FeatureService/<b>gistFileIndex</b>" + "<br/>For example, to find the 2nd file in gist 6178185, use this URL:<br/><ul><li>.../geohub/rest/services/gist/6178185/FeatureService/1</li></ul>";

function parseServiceId(serviceId) {
    var parts = serviceId.split("+");
    console.log(parts);
    var r = {
        serviceId: parts[0]
    };
    switch (r.serviceId) {
    case "repo":
        r.githubUser = parts[1];
        r.repoName = parts[2];
        r.filePath = parts[3];
        r.geoJSONType = (parts.length > 4) ? parts[4] : null;
        break;
    case "gist":
        r.gistId = parts[1];
        r.geoJSONType = (parts.length > 2) ? parts[2] : null;
        break;
    };
    console.log(r);
    return r;
};

GeoHubProvider = function(app, agsoutput) {
    GeoHubProvider.super_.call(this);
    // We want routes like this:
    // http://localhost:1337/geohub/rest/services/repo/chelm/grunt-geo/forks/FeatureServer/0
    // and
    // http://localhost:1337/geohub/rest/services/gist/6178185/FeatureServer/0
    //     var tempUrls = new agsurls.AgsUrls();
    //     this._geohub_defaultLayerQueryUrl = tempUrls.getLayerQueryUrl();
    //     this._geohub_repoLayerQueryUrl = this._geohub_defaultLayerQueryUrl.replace(":dataProviderName", "geohub");
    //     this._geohub_gistLayerQueryUrl = this._geohub_defaultLayerQueryUrl;
    // 
    //     this._originalQueryHandler = null;
    //     this._app = app;
    // 
    //     var provider = this;
    // 
    //     this._geohubQueryHandler = function(request, response) {
    //         // By this point, the routing will have parsed out the 
    //         // parameters we're interested in.
    //         var serviceBits = request.param.serviceId.split("+");
    //         console.log(serviceBits);
    //         debugger;
    //         provider._originalQueryHandler[0](request, response);
    //     };
    // 
    //     this._setupGeohubRouting = function() {
    //         if (this._originalQueryHandler == null) {
    //             var getRoutes = this._app.routes.get;
    //             var oqh = null;
    //             for (var i = 0; i < getRoutes.length; i++) {
    //                 var route = getRoutes[i];
    //                 if (route.path === this._geohub_defaultLayerQueryUrl) {
    //                     oqh = route.callbacks;
    //                     break;
    //                 }
    //             }
    //             this._originalQueryHandler = oqh;
    //             app.get(this._geohub_repoLayerQueryUrl, this._geohubQueryHandler);
    //             app.post(this._geohub_repoLayerQueryUrl, this._geohubQueryHandler);
    //             app.get(this._geohub_gistLayerQueryUrl, this._geohubQueryHandler);
    //             app.post(this._geohub_gistLayerQueryUrl, this._geohubQueryHandler);
    //         }
    //     }
    // 
    //     this._setupGeohubRouting();
    this._services = {
        "repo": {
            0: "Not Used"
        },
        "gist": {
            0: "gistFileIndex"
        }
    };

    console.log("Initialized new GeoHub Data Provider");
};


function GeoJSONGeometryTypes(geoJSONItem) {
    var r = [];
    if (geoJSONItem.type === "FeatureCollection") {
        for (var i = 0; i < geoJSONItem.features.length; i++) {
            var t = geoJSONItem.features[i].geometry.type;
            if (r.indexOf(t) < 0) {
                r.push(t);
            }
        }
    } else if (r.indexOf(geoJSONItem.type) < 0) {
        r.push(geoJSONItem.type);
    }
    return r;
};

function FilterGeoJSONByType(geoJSONItem, geometryType) {
    if (geoJSONItem.type === "FeatureCollection") {
        geoJSONItem.features = geoJSONItem.features.filter(function(item) {
            return item.geometry.type === geometryType;
        });
        return geoJSONItem;
    }
    // todo - properly handle GeometryCollection - we could filter down/promote to multipoint, polyline, polygon
    //        but it could involve recursion and nastiness so for now let's just banhammer it.
    // 	else if (geoJSONItem.type === "GeometryCollection") {
    // 		geoJSONItem.geometries = geoJSONItem.geometries.filter(function(item) {
    // 			return item.geometry.type === geometryType;
    // 		});
    // 	}
    else if (geoJSONItem.type === geometryType) {
        return geoJSONItem;
    }
    return null;
};

function outputArcGISJSON(geoJSONOutput, query, callback) {
    console.log("OutputtingArcGISJSON");

    // GeoJSON FeatureCollections can contain anything. We'll
    // limit the output to the type of just the first item.
    var types = GeoJSONGeometryTypes(geoJSONOutput);
    if (types.indexOf("GeometryCollection") > -1) {
        console.log("WARNING!!!!! The geoJSON contains at least one GeometryCollection object which Esri GeoServices JSON cannot represent.");
    }

    var type = query.geohubParams.geoJSONType ? query.geohubParams.geoJSONType : types[0];
    if (type === "GeometryCollection") {
        var eString = "The requested or calculated geoJSON type to be returned is GeometryCollection. This is unsupported by Esri GeosServices JSON. Use the optional geoJSONType query parameter to override."
        console.log("ERROR!!!!!" + eString);
        callback([], eString);
        return;
    }

    console.log(types);
    console.log("Filtering by geoJSON type: " + type);
    var filteredGeoJSON = FilterGeoJSONByType(geoJSONOutput, type);

    var arcgisOutput = TerraformerArcGIS.convert(filteredGeoJSON);

    for (var i = 0; i < arcgisOutput.length; i++) {
        arcgisOutput[i].attributes = {
            id: i,
            name: "Item " + i
        };
    }

    callback(arcgisOutput, null);
}



// This node.js helper function allows us to inherit from agsdataproviderbase.
util.inherits(GeoHubProvider, agsdp.AgsDataProviderBase);

// And now we'll override only what we need to (see also /src/agsdataproviderbase.js).
Object.defineProperties(GeoHubProvider.prototype, {
    name: {
        get: function() {
            // Override the service name - every data provider should override this.
            return "geohub";
        }
    },
    serviceIds: {
        get: function() {
            // Override the service name - every data provider should override this.
            return Object.keys(this._services);
        }
    },
    layerIds: {
        value: function(serviceId) {
            var c = parseServiceId(serviceId);
            serviceId = c.serviceId;
            return Object.keys(this._services[serviceId]);
        }
    },
    featureServiceLayerName: {
        value: function(serviceId, layerId) {
            var c = parseServiceId(serviceId);
            serviceId = c.serviceId;
            return this._services[serviceId][layerId];
        }
    },
    featureServiceDetails: {
        value: function(detailsTemplate, serviceId) {
            var c = parseServiceId(serviceId);
            serviceId = c.serviceId;

            if (serviceId === "repo") {
                detailsTemplate.serviceDescription = geohubRepoDescription;
            } else if (serviceId === "gist") {
                detailsTemplate.serviceDescription = geohubGistDescription;
            } else {
                detailsTemplate.serviceDescription = "Whoops - unrecognized GeoHub type. Run Away! " + serviceId;
                console.log("Unrecognized GeoHub type: " + serviceId);
            }
            return detailsTemplate;
        }
    },
    _readGeoHubGeoJSON: {
        value: function(serviceId, layerId, callback) {
            var c = parseServiceId(serviceId);
            serviceId = c.serviceId;
            
            console.log("READING GEOHUB");
            console.log(c);

            if (serviceId === "repo") {
                if (!(c.hasOwnProperty("githubUser") && c.hasOwnProperty("repoName") && c.hasOwnProperty("filePath"))) {
                    callback([], "You must specify githubUser, repoName, and filePath!");
                    return;
                }

                var user = c.githubUser;
                var repo = c.repoName;
                var file = c.filePath;

                Geohub.repo(user, repo, file, function(err, geoJSONData) {
                    if (err) {
                        callback([], err);
                    } else {
                        callback(geoJSONData, null);
                    }
                });
            } else if (serviceId == "gist") {
                if (!c.hasOwnProperty("gistId")) {
                    callback([], "You must specify a gistId query parameter.");
                    return;
                }
                var gistId = c.gistId;
                Geohub.gist({
                    id: gistId
                }, function(err, geoJSONData) {
                    if (err) {
                        console.log(err);
                        callback([], err);
                    } else {
                        callback(geoJSONData, null);
                    }
                });
            } else {
                callback([], "Unknown GeoHub Type: " + serviceId);
            }
        }
    },
    featureServiceLayerDetails: {
        value: function(detailsTemplate, serviceId, layerId) {
            var c = parseServiceId(serviceId);
            serviceId = c.serviceId;

            if (serviceId === "repo") {
                detailsTemplate.description = geohubRepoDescription;
            } else if (serviceId === "gist") {
                detailsTemplate.description = geohubGistDescription;
            } else {
                detailsTemplate.description = "Whoops - unrecognized GeoHub type. Run Away! " + serviceId;;
                console.log("Unrecognized GeoHub type: " + serviceId);
            }

            return detailsTemplate;
        }
    },
    featuresForQuery: {
        value: function(serviceId, layerId, query, callback) {
            this._readGeoHubGeoJSON(serviceId, layerId, function(geoJSONData, err) {
				var c = parseServiceId(serviceId);
				serviceId = c.serviceId;

				query.geohubParams = c;

            	console.log("READ GEOHUB");
                if (serviceId === "gist") {
                    if (layerId === "*") {
                        // If the user specified the unorthodox * layer descriptor AND
                        // they asked for a geoJSON response, we can give them the
                        // entire raw output from GeoHub. It's not technically valid
                        // geoJSON, but that's on GeoHub :)
                        if (query.format === "geojson") {
                            query.generatedFormat = "geojson";
                            callback(geoJSONData, null);
                        } else {
                            // Note that you can only use * with f=geojson
                            callback([], "You can only specify a layerId of '*' if using f=geojson");
                        }
                    } else {
                        // In the case of a gist, it could be many files being returned.
                        if (layerId > geoJSONData.length - 1) {
                            // An out of range file was specified.
                            callback([], "layerId " + layerId + " out range 0-" + (geoJSONData.length - 1));
                        } else if (query.format === "geojson") {
                            // OK, we can just return the geoJSON for that file.
                            query.generatedFormat = "geojson";
                            callback(geoJSONData[layerId], null);
                        } else if (query.format === "json") {
                            // Otherwise we return the Esri JSON for that file.
                            outputArcGISJSON(geoJSONData[layerId], query, callback);
                        }
                    }
                }

                if (query.format === "json") {
                    // Return the geoJSON as Esri JSON
                    console.log("Outputting JSON");
                    outputArcGISJSON(geoJSONData, query, callback);
                } else {
                    // Just pass the geoJSON on through!
                    console.log("Outputting geoJSON");
                    query.generatedFormat = "geojson";
                    callback(geoJSONData, null);
                }
            });
		}
	}
});

exports.GeoHubProvider = GeoHubProvider;
