var fs = require('fs');
var util = require('util');

var agsurls = require("./agsurls");

var agsdataproviderbase = require("./agsdataproviderbase");

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
function infoJSON(dataProvider) {
	var r = _clone(_infoJSON);
	r["currentVersion"] = dataProvider.serverVersion;
	r["fullVersion"] = dataProvider.serverVersion.toString();
	return r;
}

function servicesJSON(dataProvider) {
	var r = _clone(_servicesJSON);
	r["currentVersion"] = dataProvider.serverVersion;
	var serviceIds = dataProvider.serviceIds;
	for (var i=0; i<serviceIds.length; i++)
	{
		var serviceDetails = _clone(_serviceDetailsJSON),
			serviceId = serviceIds[i];
		serviceDetails.name = serviceId;
		serviceDetails.url = dataProvider.urls.getServiceUrl(serviceId);
		r.services.push(dataProvider.serviceDetails(serviceDetails, serviceId));
	};
	return r;
};

function featureServiceJSON(dataProvider, serviceId) {
	var r = _clone(_featureServiceJSON);
	r["currentVersion"] = dataProvider.serverVersion;
	var layerIds = dataProvider.layerIds(serviceId);
	var ls = [];
	for (var i=0; i<layerIds.length; i++) {
		var layerDetails = _clone(_featureService_LayerItemJSON),
			layerId = layerIds[i];
		layerDetails.id = layerId;
		layerDetails.name = dataProvider.featureServiceLayerName(serviceId, layerId);
		ls.push(dataProvider.serviceLayerListLayerDetails(layerDetails, serviceId, layerId));
	}
	r["layers"] = ls;
	return dataProvider.featureServiceDetails(r, serviceId);
};

function featureServiceLayerJSON(dataProvider, serviceId, layerId) {
	var r = _clone(_featureServiceLayerJSON);
	r["currentVersion"] = dataProvider.serverVersion;
	r["name"] = dataProvider.featureServiceLayerName(serviceId, layerId);
	r["layerId"] = layerId;
	r["displayField"] = dataProvider.nameField(serviceId, layerId);
	r["objectIdField"] = dataProvider.idField(serviceId, layerId);
	r["fields"] = dataProvider.fields(serviceId, layerId);
	return dataProvider.featureServiceLayerDetails(r, serviceId, layerId);
};

function featureServiceLayersJSON(dataProvider, serviceId) {
	var r = _clone(_featureServiceLayersJSON);
	var layerIds = dataProvider.layerIds;
	for (var i=0; i<layerIds.length; i++) {
		r.layers.push(featureServiceLayerJSON(dataProvider, serviceId, layerIds[i]));
	}
	return r;
};

var EarthRadius = 6378137,
	RadiansPerDegree =  0.017453292519943;

function degToRad(deg) {
	return deg * RadiansPerDegree;
}

function coordToMercator(coord) {
	var x = coord.x;
	var y = Math.max(Math.min(coord.y, 89.99999), -89.99999);
	return {
		"x": degToRad(x) * EarthRadius,
		"y": EarthRadius/2.0 * Math.log( (1.0 + Math.sin(degToRad(y))) / (1.0 - Math.sin(degToRad(y))) ),
		"spatialReference": {"wkid": 102100}
	};
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
			callback(output);
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
			callback(output);
		});
	}
	else
	{
		dataProvider._featuresForQuery(serviceId, layerId, query, function(queryResult, err, outputFormat) {
			if (err) {
				callback([], err);
			}
			else
			{
				switch (query.generatedFormat.toLowerCase()) {
					case "json":
						var featureSet = JSON.parse(JSON.stringify(_featureSetJSON));
			
						featureSet.fields = dataProvider.fields(serviceId, layerId);
						featureSet.objectIdFieldName = dataProvider.idField(serviceId, layerId);
			
						if (query.outSR === 102100)
						{
							var projectedOutput = [];
			
							for (var i=0; i<queryResult.length; i++)
							{
								var feature = JSON.parse(JSON.stringify(queryResult[i]));
								feature.geometry = coordToMercator(feature.geometry);
								projectedOutput.push(feature);
							}

							featureSet.features = projectedOutput;
							featureSet.spatialReference.wkid = 102100;
						}
						else
						{
							featureSet.features = queryResult;
						}
			
						callback(featureSet, err);
						break;
					case "geojson":
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

function getHtmlForFeatureServiceEntry(svc) {
	var featureServiceEntryHtmlTemplate = '<li><a href="%s">%s</a> (%s)</li>\n';
	return util.format(featureServiceEntryHtmlTemplate,
						svc.url,
						svc.name,
						svc.type);
}

function getHtmlForFeatureServiceLayerEntry(layer, layerUrl) {
	var featureServiceLayerEntryHtmlTemplate = '<li><a href="%s">%s</a> (%d)</li>\n';
	return util.format(featureServiceLayerEntryHtmlTemplate,
						layerUrl,
						layer.name,
						layer.id);
}

function infoHTML(dataProvider) {
	var json = infoJSON(dataProvider);
	return util.format(_infoHTML,
		json.currentVersion,
		json.fullVersion);
};

function servicesHTML(dataProvider) {
	var json = servicesJSON(dataProvider);
	var serviceListHTML = "";
	for (var i=0; i < json.services.length; i++) {
		serviceListHTML += getHtmlForFeatureServiceEntry(json.services[i]);
	}
	return util.format(_servicesHTML,
		dataProvider.urls.getServicesUrl(), dataProvider.urls.getServicesUrl(),
		json.currentVersion,
		serviceListHTML);
};

function featureServiceHTML(dataProvider, serviceId) {
	var json = featureServiceJSON(dataProvider, serviceId);
	var layerListHTML = "";
	
	for (var i=0; i<json.layers.length; i++) {
		var layer = json.layers[i];
		var layerUrl = dataProvider.urls.getLayerUrl(serviceId, layer["id"]);
		layerListHTML += getHtmlForFeatureServiceLayerEntry(layer, layerUrl);
	}
	
	return util.format(
		_featureServiceHTML,
		dataProvider.name, "Feature Server",
		dataProvider.urls.getServicesUrl(), dataProvider.urls.getServicesUrl(), "",
		dataProvider.name, "Feature Server",
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
};

function featureServiceLayerItemHTML(dataProvider, serviceId, layerId) {
	var json = null;
	if (dataProvider instanceof agsdataproviderbase.AgsDataProviderBase) {
		json = featureServiceLayerJSON(dataProvider, serviceId, layerId);
	} else {
		json = dataProvider;
	}
	
	return util.format(_featureServiceLayer_LayerItemHTML,
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
};

function featureServiceLayerHTML(dataProvider, serviceId, layerId) {
	var json = featureServiceLayerJSON(dataProvider, serviceId, layerId);
	
	return util.format(_featureServiceLayerHTML,
		json.name, layerId,
		dataProvider.urls.getServicesUrl(), dataProvider.urls.getServicesUrl(),
		dataProvider.urls.getServiceUrl(serviceId), json.name, json.type,
		dataProvider.urls.getLayerUrl(serviceId, layerId), json.name,
		json.name, layerId,
		featureServiceLayerItemHTML(json),
		dataProvider.urls.getLayerQueryUrl(serviceId, layerId));
};

function featureServiceLayersHTML(dataProvider, serviceId) {
	var json = featureServiceJSON(dataProvider, serviceId);

	var t = '<h3>Layer: <a href="%s">%s</a> (%d)</h3><br/>';
	var layersHTML = "";
	for (var i=0; i<json.layers.length; i++) {
		var layer = json.layers[i];
		layersHTML += util.format(t, 
			dataProvider.urls.getLayerUrl(serviceId, layer.id),
			layer.name, layer.id);
	
		layersHTML += featureServiceLayerItemHTML(dataProvider, serviceId, layer.id);
	}

	return util.format(_featureServiceLayersHTML,
		serviceId, 
		dataProvider.urls.getServicesUrl(), dataProvider.urls.getServicesUrl(),
		dataProvider.urls.getServiceUrl(serviceId),
		dataProvider.name, "FeatureServer",
		dataProvider.urls.getLayersUrl(serviceId),
		serviceId,
		layersHTML);
};

exports.dataProvidersHTML = dataProvidersHTML;

function o(mJ,mH,f,d,s,l) {
	return (f==="json")?mJ(d,s,l):mH(d,s,l);
};

exports.info = function(f, dataProvider) {
	return o(infoJSON, infoHTML, f, dataProvider);
};

exports.services = function(f, dataProvider) {
	return o(servicesJSON, servicesHTML, f, dataProvider);
};

exports.featureService = function(f, dataProvider, serviceId) {
	return o(featureServiceJSON, featureServiceHTML, f, dataProvider, serviceId);
};

exports.featureServiceLayer = function(f, dataProvider, serviceId, layerId) {
	return o(featureServiceLayerJSON, featureServiceLayerHTML, f, dataProvider, serviceId, layerId);
};

exports.featureServiceLayers = function(f, dataProvider, serviceId) {
	return o(featureServiceLayersJSON, featureServiceLayersHTML, f, dataProvider, serviceId);
};

exports.featureServiceLayerQuery = function(f, 
											dataProvider, serviceId, layerId,
											query, callback) {
	featureServiceLayerQueryJSON(dataProvider, serviceId, layerId, query, function(output) {
		callback(output);
	});
};
