var util = require("util"),
    dataproviderbase = require("../../src/dataproviderbase"),
    Geohub = require("geohub"),
    TerraformerArcGIS = require("terraformer-arcgis-parser");

var geohubRepoDescription = "Use the following query parameters to output GeoServices info from a GeoJSON Source:" + "<ul>" + "<li><b>githubUser</b>: The repo owner's username</li>" + "<li><b>repoName</b>: The name of the repo containing the GeoJSON file</li>" + "<li><b>filePath</b>: The path to the GeoJSON file within the repo</li>" + "<li><b>geoJSONType</b> (optional): The geoJSON Geometry Type to extract (since a FeatureLayer may emit a featureset with only a single geometry type). " + "If this is omitted, the first geoJSON Geometry will define the type used to filter on. Note, this is ignored if f=geojson. It should be a valid geoJSON type as defined in the geoJSON specification (including case-sensitivity). GeometryCollection is not supported.</li>" + "</ul>" + "You can also specify the URL as .../geohub/rest/services/repo+<b>githubUsername</b>+<b>repoName</b>+<b>filePath</b>+<b>geoJSONType</b>/FeatureService/0<br/>" + "If you use the URL approach, encode path separators in the <b>filePath</b> portion of the URL";

var geohubGistDescription = "Use the following query parameters to output GeoServices info from a GeoJSON Source:" + "<ul>" + "<li><b>gistId</b>: The unique ID of the Gist</li>" + "<li><b>geoJSONType</b> (optional): The geoJSON Geometry Type to extract (since a FeatureLayer may emit a featureset with only a single geometry type). " + "If this is omitted, the first geoJSON Geometry will define the type used to filter on. Note, this is ignored if f=geojson. It should be a valid geoJSON type as defined in the geoJSON specification (including case-sensitivity). GeometryCollection is not supported.</li>" + "</ul>" + "A Gist may include many geoJSON files. The Layer Index is used to return the correct file starting with index 0. " + "If the requested format is geojson (f=geojson) then you may use * for the layerId to return all encountered geoJSON in the gist." + "<br/>You can also specify the URL as .../geohub/rest/services/gist+<b>gistId</b>+<b>geoJSONType</b>/FeatureService/<b>gistFileIndex</b>" + "<br/>For example, to find the 2nd file in gist 6178185, use this URL:<br/><ul><li>.../geohub/rest/services/gist+6178185/FeatureService/1</li></ul>";

function parseServiceId(serviceId) {
    var r = {
    	fullServiceId: serviceId
    };
    var parts = serviceId.split("+");
    console.log(parts);
    r.serviceId = parts[0];
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
    return r;
};

GeoHubProvider = function(app) {
    GeoHubProvider.super_.call(this);
    // We want routes like this:
    // http://localhost:1337/geohub/rest/services/repo+chelm+grunt-geo+forks/FeatureServer/0
    // and
    // http://localhost:1337/geohub/rest/services/gist+6178185/FeatureServer/0
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
	var geomTypes = [];
	switch (geometryType) {
		case "LineString":
		case "MultiLineString":
			geomTypes = ["LineString","MultiLineString"];
			break;
		case "Polygon":
		case "MultiPolygon":
			geomTypes = ["Polygon","MultiPolygon"];
			break;
		default:
			geomTypes = [geometryType];
	}
	
    if (geoJSONItem.type === "FeatureCollection") {
        geoJSONItem.features = geoJSONItem.features.filter(function(item) {
            return geomTypes.indexOf(item.geometry.type) > -1;
        });
        return geoJSONItem;
    }
    else if (geoJSONItem.type === geometryType) {
        return geoJSONItem;
    }
    return null;
};

function getEsriGeometryType(geoJSONType) {
	var r = null;
    switch (geoJSONType) {
    case "Point":
    case "MultiPoint":
        r = "esriGeometryPoint";
        break;
    case "LineString":
    case "MultiLineString":
        r = "esriGeometryPolyline";
        break;
    case "Polygon":
    case "MultiPolygon":
        r = "esriGeometryPolygon";
        break;
    }
    return r;
}

function outputArcGISJSON(geoJSONOutput, query, callback) {
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

    console.log("geoJSON Files contains " + types);
    console.log("Filtering by geoJSON type: " + type);
    var filteredGeoJSON = FilterGeoJSONByType(geoJSONOutput, type);

    var arcgisOutput = TerraformerArcGIS.convert(filteredGeoJSON);
	
	if (query.geohubParams.geoJSONType) {
		query.outputGeometryType = getEsriGeometryType(query.geohubParams.geoJSONType);
	}
	
    for (var i = 0; i < arcgisOutput.length; i++) {
        arcgisOutput[i].attributes = {
            id: i,
            name: "Item " + i
        };
    }

    callback(arcgisOutput, null);
}



// This node.js helper function allows us to inherit from dataproviderbase.
util.inherits(GeoHubProvider, dataproviderbase.DataProviderBase);

// And now we'll override only what we need to (see also /src/dataproviderbase.js).
Object.defineProperties(GeoHubProvider.prototype, {
    name: {
        get: function() {
            // Override the service name - every data provider should override this.
            return "geohub";
        }
    },
    getServiceIds: {
        value: function(callback) {
            // Override the service name - every data provider should override this.
            callback(Object.keys(this._services), null);
        }
    },
    getLayerIds: {
        value: function(serviceId, callback) {
            var c = parseServiceId(serviceId);
            serviceId = c.serviceId;
            switch (serviceId) {
            	case "repo":
            		callback([0], null);
            		break;
            	case "gist":
            		if (c.gistId) {
						Geohub.gist({ id: c.gistId }, function(err, geoJSONData) {
							if (err) {
								console.log(err);
								callback([0], err);
							} else {
								var ids = [];
								for (var i=0; i<geoJSONData.length; i++) {
									ids.push(i);
								}
								callback(ids, null);
							}
						});
					} else {
						callback([0], null);
					}
            	break;
            }
        }
    },
    getLayerName: {
        value: function(serviceId, layerId) {
            var c = parseServiceId(serviceId);
            serviceId = c.serviceId;
            switch (serviceId) {
            	case "repo":
            		return "Repo Layer " + layerId;
            	case "gist":
            		return "Gist " + c.gistId + " File " + layerId;
            }
        }
    },
    getFeatureServiceDetails: {
        value: function(detailsTemplate, serviceId, callback) {
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
            var provider = this;
            this.getLayerIds(c.fullServiceId, function(layerIds, err) {
            	callback(layerIds, provider.getLayerNamesForIds(c.fullServiceId, layerIds), err);
            });
        }
    },
    _readGeoHubGeoJSON: {
        value: function(serviceId, layerId, callback) {
            var c = parseServiceId(serviceId);
            serviceId = c.serviceId;
            
            console.log("READING GEOHUB");

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
    geometryType: {
    	value: function(serviceId, layerId) {
            var c = parseServiceId(serviceId);
            var r = "esriGeometryPoint";
            if (c.geoJSONType) {
            	r = getEsriGeometryType(c.geoJSONType);
            }
            return r;
    	}
    },
    getFeatureServiceLayerDetails: {
        value: function(detailsTemplate, serviceId, layerId, callback) {
            var c = parseServiceId(serviceId);
            geohubServiceId = c.serviceId;

            if (geohubServiceId === "repo") {
                detailsTemplate.description = geohubRepoDescription;
            } else if (geohubServiceId === "gist") {
                detailsTemplate.description = geohubGistDescription;
            } else {
                detailsTemplate.description = "Whoops - unrecognized GeoHub type. Run Away! " + geohubServiceId;
                console.log("Unrecognized GeoHub type: " + geohubServiceId);
            }
            
			callback({
				layerName: this.getLayerName(serviceId, layerId), 
				idField: this.idField(serviceId, layerId),
				nameField: this.nameField(serviceId, layerId),
				fields: this.fields(serviceId, layerId),
				geometryType: this.geometryType(serviceId, layerId)
			}, null);
        }
    },
    featuresForQuery: {
        value: function(serviceId, layerId, query, callback) {
            this._readGeoHubGeoJSON(serviceId, layerId, function(geoJSONData, err) {
            	if (err) { return callback([], err); }
            	
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
                            return outputArcGISJSON(geoJSONData[layerId], query, callback);
                        }
                    }
                } else if (serviceId === "repo") {
                	if (query.format === "geojson") {
                		query.generatedFormat = "geojson";
                		callback(geoJSONData, null);
                	} else {
                		outputArcGISJSON(geoJSONData, query, callback);
                	}
                }
            });
		}
	}
});

exports.GeoHubProvider = GeoHubProvider;
