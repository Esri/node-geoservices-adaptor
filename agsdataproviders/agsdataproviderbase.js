var agsoutput = require("../agsoutput.js");
var agsurls = require("../agsurls.js");

AgsDataProviderBase = function () {
	this._urls = new agsurls.AgsUrls(this);
// 	console.log("AgsDataProviderBase initialized");
}

AgsDataProviderBase.prototype = {
	get urls() {
		return this._urls;
	},
	
	get serverVersion() {
		console.log("Implement to override the default server version of 10.1");
		return 10.1;
	},

	get isReady() {
		console.log("Implement isReady if your subclass needs time to set itself up");
		return true;
	},
	
	get name() {
		console.log("Implement to provide a unique name for this virtual AGS instance");
		return "dummyAGSInstance_Override";
	},
	
	get serviceIds() {
		console.log("Implement serviceIds() to return an array of service ID references for this provider");
		return ["firstService","secondService"];
	},

	serviceDetails: function(serviceId) {
		console.log("Implement serviceDetails() to return JSON service definition for a given service");
		var r = {
			"name": serviceId,
			"type": "FeatureServer",
			"url": this.urls.getServiceUrl(serviceId)
		};
		return r;
	},

	featureServiceDetails: function(serviceId) {
		console.log("Implement featureServiceDetails() to return JSON service definition for a given service");
		var r = agsoutput.featureServiceJSON(this, serviceId);
		return r;
	},

	layerIds: function(serviceId) {
		console.log("Implement layerIds() to return an array of layer ID references for the service ID");
		return [0];
	},

	layerDetails: function(serviceId, layerId) {
		console.log("Implement layerDetails() if serviceDetails() just returns layer IDs in the layers[] attribute");
		return {
			"id": layerId,
			"name": serviceId,
			"parentLayerId": -1,
			"defaultVisibility": true,
			"subLayerIds": null,
			"minScale": 0,
			"maxScale": 0
		};
	},

	fields: function(serviceId, layerId) {
		console.log("Implement fields() to provide array of field definitions for a layer");
		return [
			{"name" : "id", "type" : "esriFieldTypeInteger", "alias" : "ID", "nullable" : "true"},
			{"name" : "name", "type" : "esriFieldTypeString", "alias" : "Name", "length" : "255", "nullable" : "true"}
		];
	},

	idField: function(serviceId, layerId) {
		console.log("Implement idField() to provide a field name for the ID field for a layer");
		return "id";
	},

	nameField: function(serviceId, layerId) {
		console.log("Implement nameField() to provide a field name for the Name (display) field for a layer");
		return "name";
	},

	featuresForQuery: function(serviceId, layerId, query, callback) {
		console.log("Implement featuresForDataQuery to return an array of JavaScript objects with 'attributes' and 'geometry' values");
		callback([{
			"attributes": {"id":0, "name":"dummyFeature"},
			"geometry": {"x":0, "y":0, "spatialReference":{"wkid" : 4326}}
		}]);
	},

	idsForQuery: function(serviceId, layerId, query, callback) {
		console.log("Implement iDsForQuery to return an error of Object IDs");
		var thisDataProvider = this;
		this.featuresForQuery(serviceId, layerId, query, function (results) {
			var r = [];
			var idField = thisDataProvider.idField(serviceId, layerId);
			for (var i=0; i<results.length; i++) {
				r.push(results[i].attributes[idField]);
			};
			callback(r);
		});
	},

	countForQuery: function(serviceId, layerId, query, callback) {
		console.log("Implement countForQuery to return an integer count of records matching the query");
		this.featuresForQuery(serviceId, layerId, query, function(fs) {
			callback(fs.length);
		});
	}
};

exports.AgsDataProviderBase = AgsDataProviderBase;
