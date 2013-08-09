var agsurls = require("./agsurls.js"),
	TerraformerArcGIS = require("terraformer-arcgis-parser");

AgsDataProviderBase = function () {
	this._urls = new agsurls.AgsUrls(this);
	this._devMode = (process.env.VCAP_APP_PORT === null);
}

AgsDataProviderBase.prototype = {
	// A single instance of AgsUrls which can be used to return URLs relevant to this service.
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
		if (!this._devMode) console.log("Implement to provide a unique name for this virtual AGS instance");
		return "dummyAGSInstance_Override";
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
	get serviceIds() {
		if (!this._devMode) console.log("Implement serviceIds() to return an array of service ID references for this provider");
		return ["firstService","secondService"];
	},

	// Return an array of the IDs for all layers provided by the specified featureService of
	// this data-provider. Full JSON details are then provided by featureServiceLayerDetails().
	//
	// Individual layer details as returned in the FeatureService JSON are provided for each
	// layer by serviceLayerListLayerDetails().
	// 
	// Notes:
	// - IDs are conventionally integers, beginning at 0.
	layerIds: function(serviceId) {
		if (!this._devMode) console.log("Implement layerIds() to return an array of layer ID references for the service ID");
		return [0];
	},

	// JSON to be injected into the "Catalog" response for each service entry returned by
	// the serviceIds property.
	//
	// detailsTemplate is pre-populated with sensible values.
	serviceDetails: function(detailsTemplate, serviceId) {
		if (!this._devMode) console.log("Implement serviceDetails() to return JSON service definition for the services list");
		return detailsTemplate;
	},

	// JSON to be injected into the "Feature Service" response for each layer provided 
	// (see also the layerIds property).
	//
	// detailsTemplate is pre-populated with sensible values.
	serviceLayerListLayerDetails: function(detailsTemplate, serviceId, layerId) {
		if (!this._devMode) console.log("Implement serviceLayerListLayerDetails() to update layer information in the featureService layers[] attribute");
		return detailsTemplate;
	},

	// JSON to be returned for the "Feature Service" response.
	//
	// detailsTemplate is pre-populated with sensible values.
	//
	// Notes:
	// - The layers attribute will be pre-populated by calling the layerIds property and then
	//   the serviceLayerListLayerDetails() function for each layerId.
	// - A useful property to override in the detailsTemplate is "initialExtent".
	featureServiceDetails: function(detailsTemplate, serviceId) {
		if (!this._devMode) console.log("Implement featureServiceDetails() to return JSON service definition for a given service");
		return detailsTemplate;
	},
	
	// A string to be used to name each layer in the "Feature Service" response. It is 
	// also used in the "Layer (Feature Service)" and "Layers (Feature Service)" responses.
	//
	// Notes:
	// - A layerId is usually an integer (starting at 0) but it is often useful to 
	//   display a more descriptive name for that layer in the JSON output.
	featureServiceLayerName: function(serviceId, layerId) {
		if (!this._devMode) console.log("Implement featureServiceName() to specify a human readable name for a layerId");
		return serviceId + " layer " + layerId;
	},

	// JSON to be returned for the "Layer (Feature Service)" and "Layers (Feature Service)"
	// responses.
	// 
	// Notes:
	// - A useful property to override in the detailsTemplate is "extent" which will
	//   allow consumers to home in on the data when added to a map.
	featureServiceLayerDetails: function(detailsTemplate, serviceId, layerId) {
		if (!this._devMode) console.log("Implement featureServiceLayerDetails() to return layer information for a layer definition");
		return detailsTemplate;
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
		}], null);
	},
	
	// Internal - do not override.
	// This is the entry point from agsoutput to get query results, and pre-processes the
	// query parameters and post-processes the results appropriately.
	_featuresForQuery: function(serviceId, layerId, query, callback) {
		// If we've been passed objectIds, then we'll pass on the id field for convenience.
		if (query.objectIds) { query["_idField"] = this.idField(serviceId, layerId); }

		// Now call into the provider implementation of featuresForQuery()
		var provider = this;
		this.featuresForQuery(serviceId, layerId, query, function(features, err) {
			// post-processing the data from featuresForQuery()
			if (query.generatedFormat === "geojson") {
				if (query.format === "json") {
					// It actually makes no sense to return json when asked for geojson. The client must
					// specify the f=geojson parameter.
					callback(features, "Data Provider Error: geoJSON was returned for a query asking for JSON.");
				} else {
					// If geoJSON was generated, just pass it on through
					callback(features, err);
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
					var idField = this.idField(serviceId, layerId);
					for (var i = 0; i < results.length; i++) {
						var feature = TerraformerArcGIS.parse(results[i]);
						// We ought to specify the "id" property of the feature, and since
						// we have it, we'll do it.
						feature.id = results[i].attributes[idField];
						geojsonOutput.features.push(feature)
					};
					// Now we're outputting geoJSON.
					query.generatedFormat = "geojson";
					// And pass it on out.
					callback(geojsonOutput, err);
				}
				callback (results, err);
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
		this._featuresForQuery(serviceId, layerId, query, function (results, err) {
			var r = [];
			if (!err) {
				var idField = thisDataProvider.idField(serviceId, layerId);
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
		this._featuresForQuery(serviceId, layerId, query, function(results, err) {
			callback(results.length, err);
		});
	}
};

exports.AgsDataProviderBase = AgsDataProviderBase;
