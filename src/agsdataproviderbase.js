var agsurls = require("./agsurls.js");

AgsDataProviderBase = function () {
	this._urls = new agsurls.AgsUrls(this);
	this._devMode = (process.env.VCAP_APP_PORT === null);
}

AgsDataProviderBase.prototype = {
	get urls() {
		return this._urls;
	},
	
	get serverVersion() {
		if (!this._devMode) console.log("Implement to override the default server version of 10.1");
		return 10.1;
	},

	get isReady() {
		if (!this._devMode) console.log("Implement isReady if your subclass needs time to set itself up");
		return true;
	},
	
	get name() {
		if (!this._devMode) console.log("Implement to provide a unique name for this virtual AGS instance");
		return "dummyAGSInstance_Override";
	},
	
	get serviceIds() {
		if (!this._devMode) console.log("Implement serviceIds() to return an array of service ID references for this provider");
		return ["firstService","secondService"];
	},

	layerIds: function(serviceId) {
		if (!this._devMode) console.log("Implement layerIds() to return an array of layer ID references for the service ID");
		return [0];
	},

	serviceDetails: function(detailsTemplate, serviceId) {
		if (!this._devMode) console.log("Implement serviceDetails() to return JSON service definition for the services list");
		return detailsTemplate;
	},

	serviceLayerListLayerDetails: function(detailsTemplate, serviceId, layerId) {
		if (!this._devMode) console.log("Implement serviceLayerListLayerDetails() to update layer information in the featureService layers[] attribute");
		return detailsTemplate;
	},

	featureServiceDetails: function(detailsTemplate, serviceId) {
		if (!this._devMode) console.log("Implement featureServiceDetails() to return JSON service definition for a given service");
		return detailsTemplate;
	},

	featureServiceLayerDetails: function(detailsTemplate, serviceId, layerId) {
		if (!this._devMode) console.log("Implement featureServiceLayerDetails() to return layer information for a layer definition");
		return detailsTemplate;
	},

	fields: function(serviceId, layerId) {
		if (!this._devMode) console.log("Implement fields() to provide array of field definitions for a layer");
		return [
			{"name" : "id", "type" : "esriFieldTypeInteger", "alias" : "ID", "nullable" : "true"},
			{"name" : "name", "type" : "esriFieldTypeString", "alias" : "Name", "length" : "255", "nullable" : "true"}
		];
	},

	idField: function(serviceId, layerId) {
		if (!this._devMode) console.log("Implement idField() to provide a field name for the ID field for a layer");
		return "id";
	},

	nameField: function(serviceId, layerId) {
		if (!this._devMode) console.log("Implement nameField() to provide a field name for the Name (display) field for a layer");
		return "name";
	},
	
	featuresForQuery: function(serviceId, layerId, query, callback) {
		if (!this._devMode) console.log("Implement featuresForDataQuery to return an array of JavaScript objects with 'attributes' and 'geometry' values");
		callback([{
			"attributes": {"id":0, "name":"dummyFeature"},
			"geometry": {"x":0, "y":0, "spatialReference":{"wkid" : 4326}}
		}]);
	},
	
	_featuresForQuery: function(serviceId, layerId, query, callback) {
		if (query.objectIds) { query["_idField"] = this.idField(serviceId, layerId); }
		var provider = this;
		this.featuresForQuery(serviceId, layerId, query, function(features) {
			callback(features.filter(function(feature) {
				return this._includeQueryResult(feature, query);
			}, provider));
		});
	},

	_includeQueryResult: function(feature, query) {
		if (query.objectIds) {
			if (!query.hasOwnProperty("_idField"))
			{
				console.log("The query object must have an _idField set if passing a list of objectIds");
				return false;
			}
			if (feature.attributes.hasOwnProperty(query._idField) &&
				query.objectIds.indexOf(feature.attributes[query._idField]) > -1) {
				return true;
			}
			return false;
		} else {
			return true;
		}
	},

	idsForQuery: function(serviceId, layerId, query, callback) {
		if (!this._devMode) console.log("Implement iDsForQuery to return an error of Object IDs");
		var thisDataProvider = this;
		this._featuresForQuery(serviceId, layerId, query, function (results) {
			var r = [];
			var idField = thisDataProvider.idField(serviceId, layerId);
			for (var i=0; i<results.length; i++) {
				r.push(results[i].attributes[idField]);
			};
			callback(r);
		});
	},

	countForQuery: function(serviceId, layerId, query, callback) {
		if (!this._devMode) console.log("Implement countForQuery to return an integer count of records matching the query");
		this._featuresForQuery(serviceId, layerId, query, function(results) {
			callback(results.length);
		});
	}
};

exports.AgsDataProviderBase = AgsDataProviderBase;
