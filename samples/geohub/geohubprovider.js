var util = require("util"),
    dataproviderbase = require("../../src/dataproviderbase"),
    Geohub = require("geohub"),
    TerraformerArcGIS = require("terraformer/Parsers/ArcGIS"),
    Terraformer = require("terraformer");

var geohubRepoDescription = "Use the following query parameters to output GeoServices info from a GeoJSON Source:" + "<ul>" + "<li><b>githubUser</b>: The repo owner's username</li>" + "<li><b>repoName</b>: The name of the repo containing the GeoJSON file</li>" + "<li><b>filePath</b>: The path to the GeoJSON file within the repo</li>" + "<li><b>geoJSONType</b> (optional): The geoJSON Geometry Type to extract (since a FeatureLayer may emit a featureset with only a single geometry type). " + "If this is omitted, the first geoJSON Geometry will define the type used to filter on. Note, this is ignored if f=geojson. It should be a valid geoJSON type as defined in the geoJSON specification (including case-sensitivity). GeometryCollection is not supported.</li>" + "</ul>" + "You can also specify the URL as .../geohub/rest/services/repo+<b>githubUsername</b>+<b>repoName</b>+<b>filePath</b>+<b>geoJSONType</b>/FeatureService/0<br/>" + "If you use the URL approach, encode path separators in the <b>filePath</b> portion of the URL";

var geohubGistDescription = "Use the following query parameters to output GeoServices info from a GeoJSON Source:" + "<ul>" + "<li><b>gistId</b>: The unique ID of the Gist</li>" + "<li><b>geoJSONType</b> (optional): The geoJSON Geometry Type to extract (since a FeatureLayer may emit a featureset with only a single geometry type). " + "If this is omitted, the first geoJSON Geometry will define the type used to filter on. Note, this is ignored if f=geojson. It should be a valid geoJSON type as defined in the geoJSON specification (including case-sensitivity). GeometryCollection is not supported.</li>" + "</ul>" + "A Gist may include many geoJSON files. The Layer Index is used to return the correct file starting with index 0. " + "If the requested format is geojson (f=geojson) then you may use * for the layerId to return all encountered geoJSON in the gist." + "<br/>You can also specify the URL as .../geohub/rest/services/gist+<b>gistId</b>+<b>geoJSONType</b>/FeatureService/<b>gistFileIndex</b>" + "<br/>For example, to find the 2nd file in gist 6178185, use this URL:<br/><ul><li>.../geohub/rest/services/gist+6178185/FeatureService/1</li></ul>";

var globalEnvelope = {
	"type": "Polygon",
	"coordinates": [
		[ 
			[-180, 90.0], [180.0, 90.0], 
			[180.0, -90.0], [-180, -90.0], 
			[-180.0, 90.0]
		]
	]
};

var defaultIdFields = ["objectid", "fid", "id"];
var validIdFieldTypes = ["esriFieldTypeDouble","esriFieldTypeInteger"];

var fieldTypes = {
    'string': 'esriFieldTypeString',
    'integer': 'esriFieldTypeInteger',
    'date': 'esriFieldTypeDate',
    'datetime': 'esriFieldTypeDate',
    'float': 'esriFieldTypeDouble'
  };

var fieldTypePriorities = {
	"esriFieldTypeString": [
		"esriFieldTypeDouble",
		"esriFieldTypeInteger",
		"esriFieldTypeDate"
	],
	"esriFieldTypeOID": ["esriFieldTypeInteger","esriFieldTypeDouble"],
	"esriFieldTypeDouble": ["esriFieldTypeInteger","esriFieldTypeDate"],
	"esriFieldTypeInteger": ["esriFieldTypeDate"]
};

function parseServiceId(serviceId, layerId) {
    var r = {
    	fullServiceId: serviceId,
    	typelessFullServiceId: serviceId,
    	cacheId: serviceId
    };
    var parts = serviceId.split("+");
    r.serviceId = parts[0];
    switch (r.serviceId) {
    case "repo":
    	if (parts.length >= 4) {
			r.githubUser = parts[1];
			r.repoName = parts[2];
			r.filePath = parts[3];
        }
        r.geoJSONType = (parts.length > 4) ? parts[4] : null;
        r.name = util.format("%s::%s::%s", r.githubUser, r.repoName, r.filePath);
        break;
    case "gist":
		if (typeof layerId !== "undefined" && layerId !== null) {
			r.cacheId += "_" + layerId;
		}
        r.gistId = parts[1];
        r.geoJSONType = (parts.length > 2) ? parts[2] : null;
        r.name = util.format("%s", r.gistId);
        break;
    };

    if (r.geoJSONType) {
		r.name = util.format("%s::%s", r.name, r.geoJSONType);
    	r.typelessFullServiceId = r.typelessFullServiceId.slice(0, r.typelessFullServiceId.lastIndexOf("+"));
    }
//     console.log(r);
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
    
    this._gistCaches = [];
    
    this.getGistCache = function(serviceId, layerId) {
    }

    console.log("Initialized new GeoHub Data Provider");
};


function addId(geoJSON, seedId) {
	if (arguments.length < 2) {
		seedId = 0;
	}
	if (!geoJSON.hasOwnProperty("id")) {
		geoJSON["id"] = seedId;
	} else {
		console.log("Existing ID " + seedId);
	}
	if (geoJSON.type === "FeatureCollection") {
		for (var i=0; i<geoJSON.features.length; i++) {
			addId(geoJSON.features[i], ++seedId);
		}
	}
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

function calculateTypeInfo(geoJSONOutput, query) {
    // GeoJSON FeatureCollections can contain anything. We'll
    // limit the output to the type of just the first item.
    var types = GeoJSONGeometryTypes(geoJSONOutput);
    var type = types[0];
    if (arguments.length > 1 && query && 
    	query.hasOwnProperty("geohubParams") &&
    	query.geohubParams.geoJSONType) {
    	type = query.geohubParams.geoJSONType;
	}

	return {
		type: type,
		types: types
	};
}

function fieldType( value ) {
    var type = typeof( value );
    if ( type == 'number'){
      type = ( isInt( value ) ) ? 'integer' : 'float';
    }
    return fieldTypes[ type ];
};

  // is the value an integer?
function isInt( v ){
    return Math.round( v ) == v;
};

function getFields(props, idField) {
    var self = this;
    var fields = [];

    Object.keys(props).forEach(function(key) {
        var type = (idField && key == idField)?'esriFieldTypeOID':fieldType(props[key]);
        fields.push({
            name: key.toLowerCase(),
            type: type,
            alias: key
        });
    });

    return fields;
};

function getMaxType(f1, f2) {
	var t1 = f1.type,
		t2 = f2.type;
	if (t1 === t2) return t1;
	var c1 = fieldTypePriorities[t1],
		c2 = fieldTypePriorities[t2];
	if (c1 && c1.indexOf(t2) > -1) {
		return t1;
	} else if (c2 && c2.indexOf(t1) > -1) {
		return t2;
	} else {
		throw "***There is no winner defined between " + t1 + " and " + t2 + "!!!";
	}
}

function calculateFields(geoJSONItem, fields, idField, nameField) {
	if (typeof fields === "undefined" || fields===null) {
		fields = {};
	}
	if (typeof idField === "undefined" || idField===null) {
		idField = [];
	}
	if (typeof nameField === "undefined" || nameField===null) {
		nameField = [];
	}

    if (geoJSONItem.type === "FeatureCollection") {
        for (var i=0; i < geoJSONItem.features.length; i++) {
            calculateFields(geoJSONItem.features[i], fields, idField, nameField);
        }
    } else if (geoJSONItem.type === "Feature") {
    	if (geoJSONItem.properties) {
    		var itemFields = getFields(geoJSONItem.properties, idField);
    		if (idField.length == 0) {
    			var bestId = defaultIdFields.length;
    			for (var i=0; i<itemFields.length; i++) {
    				var idIndex = defaultIdFields.indexOf(itemFields[i].name);
    				if (idIndex > -1 && idIndex < bestId && 
    					validIdFieldTypes.indexOf(itemFields[i].type) > -1) {
    					bestId = idIndex;
    					idField.push(itemFields[i]);
    				}
    			}
    		}
    		for (var i=0; i < itemFields.length; i++) {
	    		if (nameField.length == 0 && itemFields[i].type === "esriFieldTypeString") {
	    			nameField.push(itemFields[i]);
	    		}
    			var k = itemFields[i].name; // + "_" + itemFields[i].type;
    			if (!fields.hasOwnProperty(k)) {
    				fields[k] = itemFields[i];
    			} else {
    				if (fields[k].type !== itemFields[i].type) {
    					fields[k].type = getMaxType(fields[k], itemFields[i]);
    				}
    			}
    		}
    
			if (idField.length == 0 && !fields.hasOwnProperty("id")) {
				fields["id"] = {
					name: 'id',
					type: 'esriFieldTypeOID',
					alias: 'id'
				};
				idField.push(fields["id"]);
			}
			
			if (nameField.length == 0) {
				nameField.push(idField[0]);
			}
    	}
    }
    
    var outFields = [];
    for (var fieldName in fields) {
    	outFields.push(fields[fieldName]);
    }

    return outFields;
}

function inflateFields(geoJSONItem, fields) {
	if (geoJSONItem.type === "FeatureCollection") {
		for (var i=0; i < geoJSONItem.features.length; i++) {
			inflateFields(geoJSONItem.features[i], fields);
		}
	} else if (geoJSONItem.type === "Feature") {
		if (geoJSONItem.hasOwnProperty("properties")) {
			for (var i=0; i < fields.length; i++) {
				var f = fields[i];
				if (!geoJSONItem.properties.hasOwnProperty(f.name)) {
					var newVal = null;
					if (geoJSONItem.properties.hasOwnProperty(f.alias)) {
						newVal = geoJSONItem.properties[f.alias];
						delete geoJSONItem.properties[f.alias];
					}
					geoJSONItem.properties[fields[i].name] = newVal;
				}
			}
		}
	}
}

function outputArcGISJSON(geoJSONOutput, cache, query, callback) {
	var typeInfo = calculateTypeInfo(geoJSONOutput, query);
	
    if (typeInfo.types.indexOf("GeometryCollection") > -1) {
        console.log("WARNING!!!!! The geoJSON contains at least one GeometryCollection object which Esri GeoServices JSON cannot represent.");
    }

    if (typeInfo.type === "GeometryCollection") {
        var eString = "The requested or calculated geoJSON type to be returned is GeometryCollection. This is unsupported by Esri GeosServices JSON. Use the optional geoJSONType query parameter to override."
        console.log("ERROR!!!!!" + eString);
        callback([], null, null, eString);
        return;
    }

    console.log("Filtering by geoJSON type: " + typeInfo.type + " / " +
    			typeInfo.types.toString());
    var filteredGeoJSON = FilterGeoJSONByType(geoJSONOutput, typeInfo.type);

    inflateFields(filteredGeoJSON, cache.layerDetails.fields);
    
    var arcgisOutput = TerraformerArcGIS.convert(filteredGeoJSON);
	
	if (query.geohubParams.geoJSONType) {
		query.outputGeometryType = getEsriGeometryType(query.geohubParams.geoJSONType);
	}
	
	var idField = cache.layerDetails.idField;
	
    for (var i = 0; i < arcgisOutput.length; i++) {
    	if (!arcgisOutput[i].hasOwnProperty("attributes")) {
			arcgisOutput[i].attributes = {}
		}

		var newId = i;
		if (arcgisOutput[i].hasOwnProperty("geojsonid")) {
			newId = arcgisOutput[i].geojsonid;
			arcgisOutput[i].attributes[idField] = newId;
			delete arcgisOutput[i].geojsonid;
		} else {
			console.log("Having to set id on geoJSON with AUTO: " + newId);
		}
    }
    callback(arcgisOutput, idField, cache.layerDetails.fields, null);
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
    serverVersion: {
    	get: function() {
    		return 10.0;
    	}
    },
    getServiceIds: {
        value: function(callback) {
            // Override the service name - every data provider should override this.
            callback(Object.keys(this._services), null);
        }
    },
    getServiceName: {
    	value: function(serviceId) {
    		var c = parseServiceId(serviceId);
    		return c.name;
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
            		return "Layer " + 0;
            	case "gist":
            		return "Gist " + c.name + " Layer " + layerId;
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
    geometryType: {
    	value: function(serviceId, layerId) {
            var c = parseServiceId(serviceId, layerId);
            var r = "esriGeometryPoint";
            if (c.geoJSONType) {
            	r = getEsriGeometryType(c.geoJSONType);
            }
            return r;
    	}
    },
    idField: {
    	value: function(serviceId, layerId) {
    		// Do not call this before getFeatureServiceLayerDetails() or featuresForQuery()
    		// if you want actual results.
        	var cache = this.getCache(serviceId, layerId);
        	return cache.layerDetails.idField;
        }
    },
    nameField: {
    	value: function(serviceId, layerId) {
    		// Do not call this before getFeatureServiceLayerDetails() or featuresForQuery()
    		// if you want actual results.
        	var cache = this.getCache(serviceId, layerId);
        	return cache.layerDetails.nameField;
        }
    },
    getFeatureServiceLayerDetails: {
        value: function(detailsTemplate, serviceId, layerId, callback) {
        	this._geohubGetFeatureServiceLayerDetails(detailsTemplate, serviceId, layerId, null, callback);
        }
    },
    _geohubGetFeatureServiceLayerDetails: {
    	value: function(detailsTemplate, serviceId, layerId, query, callback) {
            var provider = this;
            this._readGeoHubGeoJSON(serviceId, layerId, query, function(data, err) {
                var c = parseServiceId(serviceId, layerId);
                geohubServiceId = c.serviceId;

				if (detailsTemplate) {
					if (geohubServiceId === "repo") {
						detailsTemplate.description = geohubRepoDescription;
					} else if (geohubServiceId === "gist") {
						detailsTemplate.description = geohubGistDescription;
					} else {
						detailsTemplate.description = "Whoops - unrecognized GeoHub type. Run Away! " + geohubServiceId;
						console.log("Unrecognized GeoHub type: " + geohubServiceId);
					}
				}

                if (err) {
                    return callback({
                    	layerName: provider.getLayerName(serviceId, layerId),
                    	idField: null,
                    	nameField: null,
                    	fields: provider.fields(serviceId, layerId),
	                    geometryType: "esriGeometryPoint",
                    	geoJSONData: null,
                    	cache: null
	                }, err);
                }
                
                if (geohubServiceId === "gist" && layerId === "*") {
                	geoJSONData = Array.prototype.map.call(data, function(item) {
                		return item.geoJSONData;
                	});
                	callback({
						layerName: "All Layers",
						idField: "id",
						nameField: "n/a",
						fields: [],
						geometryType: "n/a",
						geoJSONData: geoJSONData,
						cache: null
                	}, null);
                } else {
	                var geoJSONData = data.geoJSONData;
	                var cache = data.cache;
                	var bounds = Terraformer.Tools.calculateBounds(data.geoJSONData);
					if (!cache.layerDetails.hasOwnProperty("extent")) {
						cache.layerDetails.extent = {
							xmin: bounds[0],
							ymin: bounds[1],
							xmax: bounds[2],
							ymax: bounds[3],
							spatialReference: { wkid: 4326 }
						};
					}
					if (detailsTemplate) {
						detailsTemplate.extent = cache.layerDetails.extent;
					}

					var typeInfo = calculateTypeInfo(geoJSONData, {
						geohubParams: c
					});

					var idFieldContainer = [];
					var nameFieldContainer = [];
					if (!cache.layerDetails.hasOwnProperty("fields")) {
						var fields = calculateFields(geoJSONData, null, idFieldContainer, nameFieldContainer);
						var idField = idFieldContainer[0].name;
						cache.layerDetails.fields = fields;
						cache.layerDetails.idField = idField;
						cache.layerDetails.nameField = nameFieldContainer[0].name
					}
					callback({
						layerName: provider.getLayerName(serviceId, layerId),
						idField: cache.layerDetails.idField,
						nameField: cache.layerDetails.nameField,
						fields: cache.layerDetails.fields,
						geometryType: getEsriGeometryType(typeInfo.type),
						geoJSONData: geoJSONData,
						cache: cache
					}, null);
                }
            });
    	}
    },
    featuresForQuery: {
        value: function(serviceId, layerId, query, callback) {
        	var provider = this;
            this._geohubGetFeatureServiceLayerDetails(null, serviceId, layerId, query, function(layerDetails, err) {
            	if (err) { return callback([], null, null, err); }

            	var geoJSONData = layerDetails.geoJSONData;
            	
				var c = parseServiceId(serviceId, layerId);
				serviceId = c.serviceId;

				query.geohubParams = c;

                if (serviceId === "gist") {
                    if (layerId === "*") {
                        // If the user specified the unorthodox * layer descriptor AND
                        // they asked for a geoJSON response, we can give them the
                        // entire raw output from GeoHub. It's not technically valid
                        // geoJSON, but that's on GeoHub :)
                        if (query.format === "geojson") {
                            query.generatedFormat = "geojson";
                            callback(geoJSONData, null, null, null);
                        } else {
                            // Note that you can only use * with f=geojson
                            callback([], null, null, "You can only specify a layerId of '*' if using f=geojson");
                        }
                    } else {
						if (query.format === "geojson") {
                            // OK, we can just return the geoJSON for that file.
                            query.generatedFormat = "geojson";
                            callback(geoJSONData, null, null, null);
                        } else if (query.format === "json") {
                            // Otherwise we return the Esri JSON for that file.
                            outputArcGISJSON(geoJSONData, layerDetails.cache, query, callback);
                        }
                    }
                } else if (serviceId === "repo") {
                	if (query.format === "geojson") {
                		query.generatedFormat = "geojson";
                		callback(geoJSONData, null);
                	} else {
                		outputArcGISJSON(geoJSONData, layerDetails.cache, query, callback);
                	}
                }
            });
		}
	},
    _loadDataFromCache: {
    	value: function(serviceId, layerId, query, callback) {
			var c = parseServiceId(serviceId, layerId);
			if (c.serviceId === "gist" && layerId === "*") {
				var allResults = [];
				var allCaches = this.cachesForService(serviceId);
				var layersLeft = allCaches.length;
				for (var i=0; i<allCaches.length; i++) {
					this._loadDataFromCache(serviceId, i, query, function (layerResult,e) {
						allResults.push(layerResult);
						layersLeft--;
						if (layersLeft == 0) {
							callback(allResults);
						}
					});
				}
				return;
			}

    		var loadingCache = this.getCache(serviceId, layerId);
// 			console.log(loadingCache.status + " :: " + c.cacheId);
			
			if (loadingCache.status === "invalid") {
				// Cache finished processing but couldn't load.
				this.deleteCache(loadingCache);
			} else if (loadingCache.status === "loaded") {
				// Cache is ready to return.
				var geom = null;
				if (query && query.geometry) {
					geom = query.geometry;
					
					if (query.geometryType === "esriGeometryEnvelope") {
						// Terraformer doesn't handle esriGeometryEnvelope yet
						geom = {
							"rings": [
								[
									[geom.xmin,geom.ymin],
									[geom.xmin,geom.ymax],
									[geom.xmax,geom.ymax],
									[geom.xmax,geom.ymin],
									[geom.xmin,geom.ymin]
								]
							],
							"spatialReference": geom.spatialReference
						};
					}
					geom = TerraformerArcGIS.parse(geom);
				}
				
				if (geom == null) {
					geom = globalEnvelope;
				}
				
				loadingCache.store.intersects(geom, function(err, results) {
					if (err) {
						callback(null, err);
						return;
					}
					
					console.log("########## " + results.length);
					
					var r = {
						geoJSONData: {
							type: "FeatureCollection",
							features: results
						},
						cache: loadingCache
					};
					callback(r, null);
				});
			} else {
				// Cache is still loading.
				var provider = this;
				console.log("Still waiting for cache " + loadingCache.cacheId + " to load...");
				(function(lc, cb) {
					setTimeout(function () {
						// We weren't ready yet, let's try again in a few
						provider._loadDataFromCache(serviceId, layerId, query, cb);
					}, 100);
				})(loadingCache, callback);
			}
		}
	},
	_populateCacheIfNecessary: {
		value: function(serviceId, layerId, query, callback) {
			var c = parseServiceId(serviceId, layerId);
			var cache = null;

			if (c.serviceId === "repo") {

				cache = this.getCache(serviceId, layerId);

				if (cache.status === "loaded") {
					callback(null);
				} else if (cache.status === "waitingToLoad") {

					console.log("READING REPO");

	        		cache.status === "loading";
					if (!(c.hasOwnProperty("githubUser") && c.hasOwnProperty("repoName") && c.hasOwnProperty("filePath"))) {
						cache.status = "invalid";
						console.log("You must specify githubUser, repoName, and filePath!");
						callback("You must specify githubUser, repoName, and filePath!");
						return;
					}

					var user = c.githubUser;
					var repo = c.repoName;
					var file = c.filePath;

					Geohub.repo(user, repo, file, function(err, geoJSONData) {
						if (err) {
							callback(err);
							return;
						} else {
							addId(geoJSONData);
							cache.store.add(geoJSONData, function(err,result) {
								if (err) { 
									callback(err); 
									return;
								} else {
									console.log("******LOADED******");
									cache.status = "loaded";
									callback(null);
								}
							});
						}
					});
				}
			} else if (c.serviceId == "gist") {
				if (!c.hasOwnProperty("gistId")) {
					callback("You must specify a gistId query parameter.");
					return;
				}
				if (layerId === "*") {
					this._populateCacheIfNecessary(serviceId, 0, query, function(err) {
						// We'll have loaded all the caches. Can now go ahead and
						// return the data.
						callback(err);
					});
				} else if (!this.cacheExists(serviceId, layerId)) {
					var gistId = c.gistId;
					var provider = this;
					Geohub.gist({
						id: gistId
					}, function(err, geoJSONData) {
						if (err) {
							console.log(err);
							callback(err);
							return;
						} else {
							if (layerId > geoJSONData.length) {
								console.log("LayerID Out of Range: 0..." + geoJSONData.length);
								callback("LayerID Out of Range: 0..." + geoJSONData.length);
								return;
							}
							var cachesLoading = geoJSONData.length;
							console.log("LOADING " + cachesLoading + " CACHES");
							var cachesToLoad = [];
							for (var i=0; i<geoJSONData.length; i++) {
								var cacheLocal = provider.getCache(serviceId, i);

								if (cacheLocal.status === "loaded") {
									console.log("****** Error - loading to loaded cache! " + c.cacheId);
									cachesLoading--;
								} else {
									cachesToLoad.push(cacheLocal);
									cacheLocal.status = "loading";
									var d = geoJSONData[i];
									addId(d);
									cacheLocal.store.add(d, function(err,result) {
										console.log("STORED " + this.cacheId);
										cachesLoading--;
										console.log(cachesLoading + " CACHES LEFT...");
										if (err) { 
											callback(err); 
											return;
										} else {
											if (cachesLoading == 0) {
												for (var j=0; j < cachesToLoad.length; j++) {
													cachesToLoad[j].status = "loaded";
												}
												callback(null);
												return;
											}
										}
									});
								}
							}
						}
					});
				} else {
					console.log("Using existing cache " + c.cacheId);
					callback(null);
				}
			} else {
				callback("Unknown GeoHub Type: " + c.serviceId);
				return;
			}
		}
	},
    _readGeoHubGeoJSON: {
        value: function(serviceId, layerId, query, callback) {
        	var provider = this;
			this._populateCacheIfNecessary(serviceId, layerId, query, function(err) {

				// We'll only get called if there was an error populating the cache.
				if (err) {
					callback(null, err);
					return;
				}
				// Data is ready to read from the cache
				provider._loadDataFromCache(serviceId, layerId, query, function(result, err) {
					callback(result, err);
					return;
				});
			});
        }
    }
});

exports.GeoHubProvider = GeoHubProvider;
