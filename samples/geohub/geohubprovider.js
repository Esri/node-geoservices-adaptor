var util = require("util"),
	path = require("path"),
	agsdp = require("../../src/agsdataproviderbase"),
	agsurls = require("../../src/agsurls"),
	Geohub = require("geohub"),
	TerraformerArcGIS = require("terraformer-arcgis-parser");

GeoHubProvider = function (app, agsoutput) {
	GeoHubProvider.super_.call(this);
	this._services = {
		"GeoHub": {
			0: "repo",
			1: "gist"
		}
	};			
	
	console.log("Initialized new GeoHub Data Provider");
};

function GeoJSONGeometryTypes(geoJSONItem) {
	var r = [];
	if (geoJSONItem.type === "FeatureCollection") {
		for (var i=0; i<geoJSONItem.features.length; i++) {
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
	else if (geoJSONItem.type === geometryType)
	{
		return geoJSONItem;
	}
	return null;
};

function outputArcGISJSON(geoJSONOutput, query, callback) {
	// GeoJSON FeatureCollections can contain anything. We'll
	// limit the output to the type of just the first item.

	var types = GeoJSONGeometryTypes(geoJSONOutput);
	if (types.indexOf("GeometryCollection") > -1) {
		console.log("WARNING!!!!! The geoJSON contains at least one GeometryCollection object which Esri GeoServices JSON cannot represent.");
	}

	var type = query.rawParams.geoJSONType || types[0];
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
			if (!this._devMode) console.log("Implement layerIds() to return an array of layer ID references for the service ID");
			return Object.keys(this._services[serviceId]);
		}
	},
	featureServiceLayerName: {
		value: function(serviceId, layerId) {
			return this._services[serviceId][layerId];
		}
	},
	featureServiceDetails: {
		value: function(detailsTemplate, serviceId) {
			detailsTemplate.serviceDescription = "These services provide access to GeoJSON files translated to Esri GeosServices specification.";
			return detailsTemplate;
		}
	},
	featureServiceLayerDetails: {
		value: function(detailsTemplate, serviceId, layerId) {
			detailsTemplate.description = "Use the following query parameters to output GeoServices info from a GeoJSON Source:";
			if (layerId == 0) {
				detailsTemplate.description += "<ul>" + 
					"<li>githubUser: The repo owner's username</li>" + 
					"<li>repoName: The name of the repo containing the GeoJSON file</li>" +
					"<li>filePath: The path to the GeoJSON file within the repo</li>" +
					"<li>(optional) geoJSONType: The geoJSON Geometry Type to extract (since a FeatureLayer may emit a featureset with a single geometry type)." +
					"If this is omitted, the first geoJSON Geometry will define the type used to filter on.</li>" +
					"<li>(optional) f: Setting this to <em>geojson</em> returns the GeoHub output unprocessed as geoJSON.</li>" +
					"</ul>";
			} else if (layerId == 1) {
				detailsTemplate.description += "<ul><li>gistId: The unique ID of the Gist</li>" +
					"<li>(optional) gistFileIndex: If the gist has multiple .geojson files, specify which one should be returned (zero-based index, default value 0)." +
					"<li>(optional) geoJSONType: The geoJSON Geometry Type to extract (since a FeatureLayer may emit a featureset with a single geometry type)." +
					"If this is omitted, the first geoJSON Geometry will define the type used to filter on.</li>" +
					"<li>(optional) f: Setting this to <em>geojson</em> returns the GeoHub output unprocessed as geoJSON.</li>" +
					"</ul>";
			} else {
				detailsTemplate.description += "Whoops - unrecognized GeoHub type. Run Away!";
				console.log("Unrecognized GeoHub type: " + layerId);
			}
			return detailsTemplate;
		}
	},
	featuresForQuery: {
		value: function(serviceId, layerId, query, callback) {
			if (serviceId === "GeoHub") 
			{
				if (layerId == 0) 
				{
					console.log("GeoHub repo");
					var user = query.rawParams.githubUser;
					var repo = query.rawParams.repoName;
					var file = query.rawParams.filePath;

					// Get the bike networks (which map to FeatyreServices). They may be cached,
					// or may need to be fetched. So they are returned with a callback.
			
					console.log(user + "." + repo + "." + file);
					Geohub.repo(user, repo, file, function(err, geoJSONData) {
								console.log(callback);
// 						console.log(geoJSONData);
// 						console.log(err);
// 						console.trace();
						if (err) {
							console.log("Uh oh: " + err);
							callback([], err);
						} else {
							if (query.format === "json") {
								outputArcGISJSON(geoJSONData, query, callback);
							} else {
								query.generatedFormat = "geojson";
								callback(geoJSONData, null);
							}
						}
					});
				} else if (layerId == 1) {
					console.log("GeoHub gist");
					var gistId = query.rawParams.gistId;
					Geohub.gist(gistId, function(err, geoJSONData) {
						if (err) {
							console.log(err);
							callback([], err);
						} else {
							if (query.format === "json") {
								// In the case of a gist, it could be many files being returned.
								if (geoJSONData.length) {
									var i = query.rawParams.gistFileIndex || 0;
									if (i > geoJSONData.length-1) {
										callback([], "gistFileIndex " + i + " out range 0-" + geoJSONData.length-1);
									} else {
										outputArcGISJSON(geoJSONData[i], query, callback);
									}
								}
							} else {
								query.generatedFormat = "geojson";
								callback(geoJSONData, null);
							}
						}
					});
				} else {
					callback([], "Unknown layerId: " + layerId);
				}
			} else {
				callback([], "Unknown serviceId: " + serviceId);
			}
		}
	}
});

exports.GeoHubProvider = GeoHubProvider;
