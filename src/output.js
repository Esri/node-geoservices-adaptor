var fs = require('fs');
var util = require('util');

var dataproviderbase = require("./dataproviderbase");

var terraformer = require("terraformer"),
	terraformerArcGIS = require("terraformer/Parsers/ArcGIS");

var _infoJSON = JSON.parse(fs.readFileSync('resources/templates/info.json', 'utf8'));
var _servicesJSON = JSON.parse(fs.readFileSync('resources/templates/services.json', 'utf8'));
var _featureServiceJSON = JSON.parse(fs.readFileSync('resources/templates/featureService.json', 'utf8'));
var _featureService_LayerItemJSON = JSON.parse(fs.readFileSync('resources/templates/featureService_layerItem.json', 'utf8'));
var _featureServiceLayerJSON = JSON.parse(fs.readFileSync('resources/templates/featureServiceLayer.json', 'utf8'));
var _featureServiceLayersJSON = JSON.parse(fs.readFileSync('resources/templates/featureServiceLayers.json', 'utf8'));

var _featureSetJSON = JSON.parse(fs.readFileSync('resources/templates/featureSet.json', 'utf8'));
var _queryCountJSON = JSON.parse(fs.readFileSync('resources/templates/queryCount.json', 'utf8'));
var _queryIdsJSON = JSON.parse(fs.readFileSync('resources/templates/queryIds.json', 'utf8'));

var _dataProvidersHTML = fs.readFileSync('resources/templates/dataProviders.html', 'utf8');

var _infoHTML = fs.readFileSync('resources/templates/info.html', 'utf8');
var _servicesHTML = fs.readFileSync('resources/templates/services.html', 'utf8');
var _featureServiceHTML = fs.readFileSync('resources/templates/featureService.html', 'utf8');
var _featureServiceLayerHTML = fs.readFileSync('resources/templates/featureServiceLayer.html', 'utf8');
var _featureServiceLayersHTML = fs.readFileSync('resources/templates/featureServiceLayers.html', 'utf8');
var _featureServiceLayer_LayerItemHTML = fs.readFileSync('resources/templates/featureServiceLayer_layerItem.html', 'utf8');

var _serviceDetailsJSON = {
	"name": "dummyService",
	"type": "FeatureServer",
	"url": "http://www.arcgis.com"
};

var drawingInfo_Point = JSON.parse(fs.readFileSync("resources/templates/drawingInfo/point.json", 'utf8'));
var drawingInfo_Line = JSON.parse(fs.readFileSync("resources/templates/drawingInfo/line.json", 'utf8'));
var drawingInfo_Polygon = JSON.parse(fs.readFileSync("resources/templates/drawingInfo/polygon.json", 'utf8'));

function _clone(object) {
	if (object) {
		return JSON.parse(JSON.stringify(object));
	}
	return null;
}

var envelopeHTMLTemplate = '<ul>XMin: %d<br/> YMin: %d<br/> XMax: %d<br/> YMax: %d<br/> ' + 
					   	   'Spatial Reference: %d<br/></ul>';
function htmlStringForEnvelope(env) {
	return util.format(envelopeHTMLTemplate, 
						env.xmin, env.ymin, 
						env.xmax, env.ymax,
						env.spatialReference.wkid);
}

var fieldHTMLTemplate = '<li>%s <i>(type: %s, alias: %s, nullable: %s, editable: %s)</i></li>\n';

function getHtmlForFields(fields) {
	var outStr = "";
	for (var i=0; i < fields.length; i++)
	{
		var field = fields[i];
		outStr = outStr + util.format(fieldHTMLTemplate,
										field.name,
										field.type,
										field.alias,
										field.nullable,
										false);
	}
	return outStr;
};



// JSON
function infoJSON(dataProvider, callback) {
	var t = _clone(_infoJSON);
	t["currentVersion"] = dataProvider.serverVersion;
	t["fullVersion"] = dataProvider.serverVersion.toString();
	callback(t, null);
}

function servicesJSON(dataProvider, callback) {
	var t = _clone(_servicesJSON);
	t["currentVersion"] = dataProvider.serverVersion;
	var serviceIds = dataProvider.getServiceIds(function(serviceIds, err) {
		for (var i=0; i<serviceIds.length; i++)
		{
			var serviceDetails = _clone(_serviceDetailsJSON),
				serviceId = serviceIds[i];
			serviceDetails.name = serviceId;
			serviceDetails.url = dataProvider.urls.getServiceUrl(serviceId);
			t.services.push(serviceDetails);
		};
		dataProvider.updateServicesDetails(t.services, function(newDetails, err) {
			t.services = newDetails;
			callback(t, err);
		});
	});
};

function featureServiceJSON(dataProvider, serviceId, callback) {
	var t = _clone(_featureServiceJSON);
	t["currentVersion"] = dataProvider.serverVersion;
	dataProvider.getFeatureServiceDetails(t, serviceId, function(layerIds, layerNames, err) {
		var ls = [];
		for (var i=0; i<layerIds.length; i++) {
			var layerDetails = _clone(_featureService_LayerItemJSON);
			layerDetails.id = layerIds[i];
			layerDetails.name = layerNames[i];
			ls.push(layerDetails);
		}
		dataProvider.updateFeatureServiceDetailsLayersList(serviceId, ls, function(layersDetails, err) {
			t.layers = layersDetails;
			callback(t, err);
		});
	});
};

function featureServiceLayerJSON(dataProvider, serviceId, layerId, callback) {
	var t = _clone(_featureServiceLayerJSON);
	dataProvider.getFeatureServiceLayerDetails(t, serviceId, layerId, function(layerDetails, err) {
		var layerName = layerDetails.layerName, 
			idField = layerDetails.idField,
			nameField = layerDetails.nameField, 
			fields = layerDetails.fields,
			geomType = layerDetails.geometryType;
		if (geomType) {
			t["geometryType"] = geomType;
		}
		if (!t.hasOwnProperty("drawingInfo")) {
			// If the provider has already given us drawingInfo, let's do it.
			var drawingInfo = null;
			switch(geomType) {
				case "esriGeometryPoint":
					drawingInfo = drawingInfo_Point;
					break;
				case "esriGeometryPolyline":
					drawingInfo = drawingInfo_Line;
					break;
				case "esriGeometryPolygon":
					drawingInfo = drawingInfo_Polygon;
					break;
				default:
					console.log("Could not determine the geometry type: " + geomType);
					console.log("layerDetails");
					break;
			}
			if (drawingInfo) {
				t["drawingInfo"] = drawingInfo;
			}
		}
		t["currentVersion"] = dataProvider.serverVersion;
		t["name"] = layerName; // dataProvider.featureServiceLayerName(serviceId, layerId);
		t["id"] = layerId;
		t["objectIdField"] = idField; // dataProvider.idField(serviceId, layerId);
		t["displayField"] = nameField; // dataProvider.nameField(serviceId, layerId);
		t["fields"] = fields; // dataProvider.fields(serviceId, layerId);
		callback(t, err);
	});
};

function featureServiceLayersJSON(dataProvider, serviceId, callback) {
	var t = _clone(_featureServiceLayersJSON);
	var outputter = this;
	dataProvider.getLayerIds(serviceId, function(layerIds, err) {
		if (err) return callback(null, err);
		var layerResults = {};
		var retrievedResults = 0;
		for (var i=0; i<layerIds.length; i++) {
			var layerId = layerIds[i];
			featureServiceLayerJSON(dataProvider, serviceId, layerId, function (layerJSON, err) {
				if (err) return callback(null, err);
				layerResults[layerId] = layerJSON;
				retrievedResults++;
				if (retrievedResults == layerIds.length) {
					t.layers = layerIds.map(function(layerId) {
						return layerResults[layerId];
					});
					callback(t, err);
				}
			});
		}
	});
};

function projectGeographicGeomToMercator(geometry) {
	var g = terraformerArcGIS.convert(terraformerArcGIS.parse(geometry).toMercator());
	g.spatialReference.wkid = 102100;
	return g;
}

function featureServiceLayerQueryJSON(dataProvider, serviceId, layerId, 
									  query,
									  callback)
									  {
	var queryResult = null;

	if (query.returnCountOnly)
	{
		dataProvider.countForQuery(serviceId, layerId, query, function(resultCount, err) {
			var output = _clone(_queryCountJSON);
			// Note, for now we only handle one layer at a time
			var outLayer = output.layers[0];
			outLayer.id = layerId;
			outLayer.count = resultCount;
			callback(output, err);
		});
	}
	else if (query.returnIdsOnly)
	{
		dataProvider.idsForQuery(serviceId, layerId, query, function(resultIds, err) {
			var output = _clone(_queryIdsJSON);
			// Note, for now we only handle one layer at a time
			var outLayer = output.layers[0];
			outLayer.id = layerId;
			outLayer.objectIdFieldName = dataProvider.idField(serviceId, layerId);
			outLayer.objectIds = resultIds;
			callback(output, err);
		});
	}
	else
	{
		dataProvider._featuresForQuery(serviceId, layerId, query, function(queryResult, idField, fields, err, outputFormat) {
			if (err) {
				callback([], err);
			}
			else
			{
				switch (query.generatedFormat.toLowerCase()) {
					case "json":
						var featureSet = JSON.parse(JSON.stringify(_featureSetJSON));
						
						featureSet.fields = fields;
						featureSet.objectIdFieldName = idField;
						featureSet.features = [];
						
						if (query.outSR === 102100)
						{
							for (var i=0; i<queryResult.length; i++)
							{
								var feature = JSON.parse(JSON.stringify(queryResult[i]));
 								feature.geometry = projectGeographicGeomToMercator(feature.geometry);
								featureSet.features.push(feature);
							}
							featureSet.spatialReference.wkid = 102100;
						}
						else
						{
							featureSet.features = queryResult;
						}
						if (query.hasOwnProperty("outputGeometryType")) {
							featureSet.geometryType = query["outputGeometryType"];
						}
			
						callback(featureSet, err);
						break;
					case "geojson":
						if (query.outSR != 4326) {
							return callback(queryResult, "geoJSON can only be output in geographic coordinates. outSR asked for " + 
								query.outSR + ". Alternatively specify a return format other than f=geojson");
						}
						callback(queryResult, err);
						break;
				}
			}
		});
	}
};

// HTML
function dataProvidersHTML(dataProviders) {
	var dataProviderTemplate = "<li><a href='%s'>%s</a></li>\n";
	var s = "";
	for (var providerId in dataProviders) {
		var dataProvider = dataProviders[providerId].dataProvider;
		s += util.format(dataProviderTemplate, 
						 dataProvider.urls.getServicesUrl(),
						 dataProvider.name);
	};
	return util.format(_dataProvidersHTML, s);
};

function getHtmlForFeatureServiceEntry(dataProvider, svc) {
	var featureServiceEntryHtmlTemplate = '<li><a href="%s">%s</a> (%s)</li>\n';
	return util.format(featureServiceEntryHtmlTemplate,
						svc.url,
						dataProvider.getServiceName(svc.name),
						svc.type);
}

function getHtmlForFeatureServiceLayerEntry(layer, layerUrl) {
	var featureServiceLayerEntryHtmlTemplate = '<li><a href="%s">%s</a> (%d)</li>\n';
	return util.format(featureServiceLayerEntryHtmlTemplate,
						layerUrl,
						layer.name,
						layer.id);
}

function infoHTML(dataProvider, callback) {
	infoJSON(dataProvider, function(json, err) {
		var r = util.format(_infoHTML,
			json.currentVersion,
			json.fullVersion);
		callback(r, err);
	});
};

function servicesHTML(dataProvider, callback) {
	servicesJSON(dataProvider, function(json, err) {
		var serviceListHTML = "";
		for (var i=0; i < json.services.length; i++) {
			serviceListHTML += getHtmlForFeatureServiceEntry(dataProvider, json.services[i]);
		}
		var r = util.format(_servicesHTML,
			dataProvider.urls.getServicesUrl(), dataProvider.urls.getServicesUrl(),
			json.currentVersion,
			serviceListHTML);

		callback(r, err);
	});
};

function featureServiceHTML(dataProvider, serviceId, callback) {
	featureServiceJSON(dataProvider, serviceId, function(json, err) {
		var layerListHTML = "";
	
		for (var i=0; i<json.layers.length; i++) {
			var layer = json.layers[i];
			var layerUrl = dataProvider.urls.getLayerUrl(serviceId, layer["id"]);
			layerListHTML += getHtmlForFeatureServiceLayerEntry(layer, layerUrl);
		}
	
		var r = util.format(
			_featureServiceHTML,
			dataProvider.name, "FeatureServer",
			dataProvider.urls.getServicesUrl(), dataProvider.urls.getServicesUrl(), 
			dataProvider.urls.getServiceUrl(serviceId), dataProvider.getServiceName(serviceId), "FeatureServer",
			dataProvider.getServiceName(serviceId), "FeatureServer",
			json.serviceDescription,
			json.hasVersionedData,
			json.maxRecordCount,
			json.supportedQueryFormats,
			dataProvider.urls.getLayersUrl(serviceId),
			layerListHTML,
			json.description,
			json.copyrightText,
			json.spatialReference.wkid,
			htmlStringForEnvelope(json.initialExtent),
			htmlStringForEnvelope(json.fullExtent),
			json.units,
			"FSQueryURL"
		);
		
		callback(r, err);
	});
};

function featureServiceLayerItemHTML(dataProvider, serviceId, layerId, callback) {
	function getHTML(json) {
		var r = util.format(_featureServiceLayer_LayerItemHTML,
			json.name,
			json.displayField,
			json.geometryType,
			json.description,
			json.copyrightText,
			json.minScale,
			json.maxScale,
			json.maxRecordCount,
			htmlStringForEnvelope(json.extent),
			getHtmlForFields(json.fields));

		return r;
	}
	if (dataProvider instanceof dataproviderbase.DataProviderBase) {
		featureServiceLayerJSON(dataProvider, serviceId, layerId, function (json, err) {
			callback(getHTML(json), err);
		});
	} else {
		var json = dataProvider;
		return getHTML(json);
	}
};

function getFullFeatureServiceLayerURL(dataProvider, serviceId, layerId) {
	var r = dataProvider.baseUrl + dataProvider.urls.getLayerUrl(serviceId, layerId);
	return encodeURIComponent(r);
}

function featureServiceLayerHTML(dataProvider, serviceId, layerId, callback) {
	featureServiceLayerJSON(dataProvider, serviceId, layerId, function (json, err) {
		var url = getFullFeatureServiceLayerURL(dataProvider, serviceId, layerId);
		var r = util.format(_featureServiceLayerHTML,
			json.name, layerId,
			dataProvider.urls.getServicesUrl(), dataProvider.urls.getServicesUrl(),
			dataProvider.urls.getServiceUrl(serviceId), dataProvider.getServiceName(serviceId), "FeatureServer",
			dataProvider.urls.getLayerUrl(serviceId, layerId), json.name,
			json.name, layerId,
			url,
			dataProvider.baseUrl,url,
			dataProvider.baseUrl,url,
			url,
			featureServiceLayerItemHTML(json),
			dataProvider.urls.getLayerQueryUrl(serviceId, layerId));
	
		callback(r, err);
	});
};

function featureServiceLayersHTML(dataProvider, serviceId, callback) {
	featureServiceLayersJSON(dataProvider, serviceId, function(json, err) {
		var layerHTMLItems = {};
		var t = '<h3>Layer: <a href="%s">%s</a> (%d)</h3><br/>';
		for (var i=0; i<json.layers.length; i++) {
			var layer = json.layers[i];
			var html = featureServiceLayerItemHTML(layer, serviceId, layer.id);
			html = util.format(t, dataProvider.urls.getLayerUrl(serviceId, layer.id),
							   layer.name, layer.id) + html;
			layerHTMLItems[layer.id] = html;
		}

		var layersHTML = "";
		for (var j=0; j<json.layers.length; j++) {
			layersHTML += layerHTMLItems[json.layers[j].id];
		}

		var r = util.format(_featureServiceLayersHTML,
			serviceId, 
			dataProvider.urls.getServicesUrl(), dataProvider.urls.getServicesUrl(),
			dataProvider.urls.getServiceUrl(serviceId), dataProvider.getServiceName(serviceId), "FeatureServer",
			dataProvider.urls.getLayersUrl(serviceId),
			serviceId,
			layersHTML);
		callback(r, err);
	});
};

exports.dataProvidersHTML = dataProvidersHTML;

function o(mJ,mH,f,d) {
	var args = Array.prototype.slice.call(arguments);
	var callback = args.pop();
	args.shift(); args.shift(); args.shift();
	args.push(function(result, err) {
		callback(result, err);
	});
	var m = (f==="json" || f==="pjson")?mJ:mH;
	m.apply(d,args);
};

exports.info = function(f, dataProvider, callback) {
	o(infoJSON, infoHTML, f, dataProvider, function(output, err) {
		callback(output, err);
	});
};

exports.services = function(f, dataProvider, callback) {
	o(servicesJSON, servicesHTML, f, dataProvider, function(output, err) {
		callback(output, err);
	});
};

exports.featureService = function(f, dataProvider, serviceId, callback) {
	o(featureServiceJSON, featureServiceHTML, f, dataProvider, serviceId, function(output, err) {
		callback(output, err);
	});
};

exports.featureServiceLayer = function(f, dataProvider, serviceId, layerId, callback) {
	o(featureServiceLayerJSON, featureServiceLayerHTML, f, dataProvider, serviceId, layerId, function(output, err) {
		callback(output, err);
	});
};

exports.featureServiceLayers = function(f, dataProvider, serviceId, callback) {
	o(featureServiceLayersJSON, featureServiceLayersHTML, f, dataProvider, serviceId, function(output, err) {
		callback(output, err);
	});
};

exports.featureServiceLayerQuery = function(f, dataProvider, serviceId, layerId, query, callback) {
	o(featureServiceLayerQueryJSON, featureServiceLayerQueryJSON, f, dataProvider, serviceId, layerId, query, function(output, err) {
		callback(output, err);
	});
};
