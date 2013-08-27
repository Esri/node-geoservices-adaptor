var urls = require("./urls.js"),
	Terraformer = require("terraformer"),
	TerraformerArcGIS = require("terraformer/Parsers/ArcGIS"),
	DataProviderCache = require("./dataprovidercache").DataProviderCache;

DataProviderBase = function () {
	this._urls = new urls.Urls(this);
	this._devMode = (process.env.VCAP_APP_PORT === null);
	this._caches = {};
}

DataProviderBase.prototype = {
	/// ---------------------------------------------------------------------------------
	/// CACHE HANDLING
	/// ---------------------------------------------------------------------------------

	getCache: function(serviceId, layerId) {
		if (arguments.length < 2) {
			console.log("You must provide a serviceId and layerId");
			return null; 
		}
		
		var cache = null;
		if (!this._caches.hasOwnProperty(serviceId)) {
			console.log("Creating cache store for service: " + serviceId);
			this._caches[serviceId] = {};
		}
		
		if (!this._caches[serviceId].hasOwnProperty(layerId)) {
			console.log("Creating cache for service " + serviceId + ", layer " + layerId);
			cache = new DataProviderCache(serviceId, layerId);
			this._caches[serviceId][layerId] = cache;
		} else { 
			cache = this._caches[serviceId][layerId];
			if (!cache.validateCache()) {
				console.log("CACHE INVALID: Creating cache for " + cacheId);
				// The cache is expired and should not be extended. Create a new one.
				cache = new DataProviderCache(serviceId, layerId, cache.cacheLifetimeInSeconds);
				// And delete the old one.
				delete this._caches[serviceId][layerId];
				this._caches[serviceId][layerId] = cache;
			}
		}

		return cache;		
	},
	
	deleteCache: function(cache) {
		if (this.cacheExists(cache.serviceId, cache.layerId)) {
			delete this._caches[cache.serviceId][cache.layerId];
		}
		delete cache;
	},
	
	cacheExists: function(serviceId, layerId) {
		return this._caches.hasOwnProperty(serviceId) &&
			   this._caches[serviceId].hasOwnProperty(layerId);
	},
	
	cachesForService: function(serviceId) {
		var cs = [];
		if (this._caches.hasOwnProperty(serviceId)) {
			for (var layerId in this._caches[serviceId]) {
				cs.push(this._caches[serviceId][layerId]);
			}
		}
		return cs;
	},
	
	/// ---------------------------------------------------------------------------------
	/// Helper function (_request should be set by ExpressJS)
	/// ---------------------------------------------------------------------------------
	get baseUrl() {
		if (this.hasOwnProperty("_request") && this._request) {
			var protocol = this._request.protocol;
			var server = this._request.get('host');
			return protocol + "://" + server;
		}
		return "";
	},
	/// ---------------------------------------------------------------------------------
	/// REST REQUEST HANDLING
	/// ---------------------------------------------------------------------------------

	// A single instance of Urls which can be used to return URLs relevant to this service.
	// This is used, for example, where Service URLs are written out in a service's HTML output.
	get urls() {
		return this._urls;
	},
	
	// Return the serverVersion. Only override if you implement functionality specifically not
	// available in the declared base serverVersion. This is used when writing out serverVersion
	// and fullVersion in the various JSON and HTML outputs.
	get serverVersion() {
		if (!this._devMode) console.log("Implement to override the default server version of 10.1");
		return 10.1;
	},

	// If your custom data provider is not ready for interaction until some async action has
	// completed, track and update the isReady status separately. The engine will not attempt to
	// derive JSON until isReady is true.
	get isReady() {
		if (!this._devMode) console.log("Implement isReady if your subclass needs time to set itself up");
		return true;
	},
	
	// This is the top-level name of your data provider. It is used in the URL root of
	// the virtual ArcGIS Server. For example, in:
	// 		http://localhost:1337/citybikes/rest/services/citibikenyc/FeatureServer/0
	// name() will return "myprovider". This is also listed at the root URL (e.g. http://localhost:1337)
	get name() {
		if (!this._devMode) console.log("Implement to provide a unique name for this virtual ArcGIS Server instance");
		return "dummyDataProvider_Override";
	},
	
	// An array of service names that are used to uniquely identify each FeatureService
	// provided by a data-provider. In the case of:
	// 		http://localhost:1337/citybikes/rest/services/citibikenyc/FeatureServer/0
	// the service entry is "citibikenyc" and each entry listed at:
	// 		http://localhost:1337/citybikes/rest/services
	// is an entry in this array.
	// 
	// The brief details which are injected into the "Catalog" endpoint JSON are provided
	// by serviceDetails().
	//
	// The full details provided for each "Feature Service" endpoint is provided by 
	// featureServiceDetails().
	// 
	// Notes:
	// - Service IDs should be suitable for use in urls.
	getServiceIds: function(callback) {
		if (!this._devMode) console.log("Implement serviceIds() to return an array of service ID references for this provider");
		callback(["firstService","secondService"], null);
	},

	// A string to be used to name each Service in the Catalog response. It is 
	// also used in the "Feature Service" response and breadcrumb...
	getServiceName: function(serviceId) {
		if (!this._devMode) console.log("Implement getServiceName() to specify a human readable name for a serviceId");
		return serviceId;
	},

	// An array of objects, each of which will have name and url properties.
	// The output will be injected into the "Catalog" response services property
	//
	// Note:
	// - servicesDetails is pre-populated with sensible values.
	// - The "name" property of each item will correspond to a serviceId returned by getServiceIds().
	updateServicesDetails: function(servicesDetails, callback) {
		if (!this._devMode) console.log("Implement updateServicesDetails() if updating JSON service definitions for the services list");
		callback(servicesDetails, null);
	},

	// Return an array of the IDs for all layers provided by the specified featureService of
	// this data-provider. Full JSON details are then provided by featureServiceLayerDetails().
	//
	// Individual layer details as returned in the FeatureService JSON are provided for each
	// layer by serviceLayerListLayerDetails().
	// 
	// Notes:
	// - IDs are conventionally integers, beginning at 0.
	getLayerIds: function(serviceId, callback) {
		if (!this._devMode) console.log("Implement layerIds() to return an array of layer ID references for the service ID");
		callback([0], null);
	},

	// A string to be used to name each layer in the "Feature Service" response. It is 
	// also used in the "Layer (Feature Service)" and "Layers (Feature Service)" responses.
	//
	// Notes:
	// - A layerId is usually an integer (starting at 0) but it is often useful to 
	//   display a more descriptive name for that layer in the JSON output.
	getLayerName: function(serviceId, layerId) {
		if (!this._devMode) console.log("Implement getLayerName() to specify a human readable name for a layerId");
		return serviceId + " layer " + layerId;
	},
	
	getLayerNamesForIds: function(serviceId, layerIds) {
	    var layerNames = [];
	    for (var i = 0; i < layerIds.length; i++) {
	        layerNames.push(this.getLayerName(serviceId, layerIds[i]));
	    }
	    return layerNames;
	},

	// JSON to be returned for the "Feature Service" response.
	//
	// detailsTemplate is pre-populated with sensible values.
	//
	// Notes:
	// - The layers attribute will be pre-populated by calling the layerIds property and then
	//   the serviceLayerListLayerDetails() function for each layerId.
	// - A useful property to override in the detailsTemplate is "initialExtent".
	getFeatureServiceDetails: function(detailsTemplate, serviceId, callback) {
		if (!this._devMode) console.log("Implement featureServiceDetails() to return JSON service definition for a given service");
		var provider = this;
		this.getLayerIds(serviceId, function(layerIds, err) {
			callback(layerIds, provider.getLayerNamesForIds(layerIds), err);
		});
	},

	// JSON to be injected into the "Feature Service" response for each layer provided 
	// (see also the layerIds property).
	//
	// detailsTemplate is pre-populated with sensible values.
	updateFeatureServiceDetailsLayersList: function(serviceId, layersDetails, callback) {
		if (!this._devMode) console.log("Implement updateServiceLayersListLayerDetails() to update layer information in the featureService layers[] attribute");
		callback(layersDetails, null);
	},

	// JSON to be returned for the "Layer (Feature Service)" and "Layers (Feature Service)"
	// responses.
	// 
	// Notes:
	// - A useful property to override in the detailsTemplate is "extent" which will
	//   allow consumers to home in on the data when added to a map.
	getFeatureServiceLayerDetails: function(detailsTemplate, serviceId, layerId, callback) {
		if (!this._devMode) console.log("Implement featureServiceLayerDetails() to return layer information for a layer definition");
		callback({
			layerName: this.getLayerName(serviceId, layerId), 
			idField: this.idField(serviceId, layerId),
			nameField: this.nameField(serviceId, layerId),
			fields: this.fields(serviceId, layerId),
			geometryType: this.geometryType(serviceId, layerId)
		}, null);
	},

	// Geometry Type to be returned for the "Layer (Feature Service)" json.
	//
	// Note:
	// - Clients may rely on this to determine the correct way to render the output 
	//   from "Query". This should be set correctly for the single type of geometry that this
	//   service endpoint will render.
	// - This will be used to determine the value of the drawingInfo attribute for
	//   "Layer (Feature Service)". To override the drawingInfo, override the 
	//   getFeatureServiceLayerDetails() function.
	geometryType: function(serviceId, layerId) {
		if (!this._devMode) console.log("Implement geometryType() to provide the geometry type for a layer (esriGeometryPoint, esriGeometryPolyline, or esriGeometryPolygon)");
		return "esriGeometryPoint";
	},

	// Fields list to be returned for the "Layer (Feature Service)" and 
	// "Query (Feature Service\Layer)" responses.
	// 
	// Notes:
	// - This is not processed in any way - each field should be a valid GeoServices field
	//   definition.
	fields: function(serviceId, layerId) {
		if (!this._devMode) console.log("Implement fields() to provide array of field definitions for a layer");
		return [
			{"name" : "id", "type" : "esriFieldTypeInteger", "alias" : "ID", "nullable" : "true"},
			{"name" : "name", "type" : "esriFieldTypeString", "alias" : "Name", "length" : "255", "nullable" : "true"}
		];
	},

	// The name of the idField (often "ObjectID" but not necessarily so) for a layer.
	// Used in "Layer (Feature Service)", "Layers (Feature Service)" and 
	// "Query (Feature Service\Layer)".
	//
	// Notes:
	// - If this does not match the "name" of a field returned by fields(), the behaviour
	//   of queries is undefined.
	// - If this does not denote a field whose values are unique, the behaviour of 
	//   queries is undefined.
	// - When "Query (Feature Service\Layer)" has the property "returnIdsOnly=true" then
	//   this is used to determine the IDs which will be returned if idsForQuery() is NOT
	//   explicitly overridden.
	idField: function(serviceId, layerId) {
		if (!this._devMode) console.log("Implement idField() to provide a field name for the ID field for a layer");
		return "id";
	},

	// The display field for the layer.
	//
	// Notes:
	// - If this does not match the "name" of a field returned by fields(), the behaviour
	//   of consuming clients may be undefined.
	nameField: function(serviceId, layerId) {
		if (!this._devMode) console.log("Implement nameField() to provide a field name for the Name (display) field for a layer");
		return "name";
	},

	// Return an array of features that match the query parameters. Note, this does not
	// return a FeatureSet. This simple array of features is post-processed and packaged up
	// automatically depending on query parameters.
	// 
	// Notes:
	// - Each feature should include a dictionary named "attributes" and a dictionary
	//   named "geometry" which matches a valid JSON GeoService geometry representation.
	//   For more details, see http://resources.arcgis.com/en/help/rest/apiref/feature.html
	// - If geometries are returned in WKID 4326, the engine can convert them to 102100
	//   if the caller has requested it with the outSR parameter.
	// - It is valid to return an empty array.
	// - Each feature should have at least an attribute matching the idField().
	// - Features should have unique ids (see idField()).
	featuresForQuery: function(serviceId, layerId, query, callback) {
		if (!this._devMode) console.log("Implement featuresForDataQuery to return an array of JavaScript objects with 'attributes' and 'geometry' values");
		callback([{
			"attributes": {"id":0, "name":"dummyFeature"},
			"geometry": {"x":0, "y":0, "spatialReference":{"wkid" : 4326}}
		}], this.idField(serviceId, layerId), this.fields(serviceId, layerId), null);
	},
	
	// Internal - do not override.
	// This is the entry point from the output module to get query results, and pre-processes the
	// query parameters and post-processes the results appropriately.
	_featuresForQuery: function(serviceId, layerId, query, callback) {
		if (query.objectIds) {
			// If we've been passed objectIds, then we'll pass on the id field for convenience.
			query["_idField"] = this.idField(serviceId, layerId);
		}

		// Now call into the provider implementation of featuresForQuery()
		var provider = this;
		this.featuresForQuery(serviceId, layerId, query, function(features, idField, fields, err) {
			if (err) {
				callback(features, null, null, err);
				return;
			}
			// post-processing the data from featuresForQuery()
			if (query.generatedFormat === "geojson") {
				if (query.format === "geojson") {
					// If geoJSON was generated, just pass it on through
					callback(features, idField, fields, err);
				} else {
					// It actually makes no sense to return json when asked for geojson. The client must
					// specify the f=geojson parameter.
					callback(features, null, null, "Data Provider Error: geoJSON was returned for a query asking for " + query.format);
				}
			} else if (query.generatedFormat === "json") {
				// More typical ArcGIS Server behaviour. Esri JSON delivered.
				// Let's filter out the features according to some query rules.
				var results = features.filter(function(feature) {
					return this._includeQueryResult(feature, query);
				}, provider);
				if (query.format === "geojson") {
					// The user has asked for geoJSON but so far we just have JSON
					// Let's user terraformer to convert...
					var geojsonOutput = {
						type: "FeatureCollection",
						features: []
					};
					for (var i=0; i < results.length; i++) {
						var result = results[i];

						// Need to do this before setting "id". See:
						// https://github.com/Esri/Terraformer/issues/137
						var feature = TerraformerArcGIS.parse(result);

						// We ought to specify the "id" property of the feature, and since
						// we have it, we'll do it.
						feature["id"] = result.attributes[idField];
						geojsonOutput.features.push(feature);
					};

					// Now we're outputting geoJSON.
					query.generatedFormat = "geojson";
					// And pass it on out.
					callback(geojsonOutput, "id", fields, err);
				} else {
					// Just return whatever we got
					callback (results, idField, fields, err);
				}
			} 
		});
	},

	// Internal - do not override.
	// Called from _featuresForQuery().
	// Determines whether a feature returned from featuresForQuery() should be included
	// in the query response.
	//
	// Notes:
	// - Currently just checks whether we're limiting to an ObjectIDs list. I.e. we do
	//   not check against geometry and spatialRel.
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

	// Return an array of IDs matching the features that would be returned by the Query.
	// This is called when returnIdsOnly=true is passed as a parameter. It is ignored if
	// returnCountOnly is also true.
	// 
	// This default implementation merely calls _featuresForQuery() and returns an array
	// of IDs instead of an array of features.
	//
	// Override with a more efficient method if your dataprovider allows for it.
	idsForQuery: function(serviceId, layerId, query, callback) {
		if (!this._devMode) console.log("Implement iDsForQuery to return an error of Object IDs");
		var thisDataProvider = this;
		this._featuresForQuery(serviceId, layerId, query, function (results, idField, fields, err) {
			var r = [];
			if (!err) {
				for (var i=0; i<results.length; i++) {
					r.push(results[i].attributes[idField]);
				};
			}
			callback(r, err);
		});
	},

	// Return the count of records matching the query.
	// This is called when returnCountOnly=true is passed as a parameter.
	// 
	// This default implementation merely calls _featuresForQuery() and returns the length
	// of that array.
	//
	// Override with a more efficient method if your dataprovider allows for it.
	countForQuery: function(serviceId, layerId, query, callback) {
		if (!this._devMode) console.log("Implement countForQuery to return an integer count of records matching the query");
		this._featuresForQuery(serviceId, layerId, query, function(results, idField, fields, err) {
			callback(results.length, err);
		});
	}
};

exports.DataProviderBase = DataProviderBase;
