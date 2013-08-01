var agsdp = require("../agsdataprovider");
var util = require('util');
var http = require('http');

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

CityBikes = function () {
	CityBikes.super_.call(this);
// 	console.log("CityBikes initialized");
	this._isReady = false;
	
	this._cachedNetworks = null;
	this._cacheExpirationTime = new Date();
	var _cityBikesNetworksURL = "http://api.citybik.es/networks.json";
	
	this._networksCacheTime = 30 * 60000;
	var _bikesCacheTime = 1 * 60000;

	function _cacheInvalid() {
		var now = new Date();
		return (this._cachedNetworks == null) || (now >= this._cacheExpirationTime);
	}

	var citybikesProvider = this;	

	this._cacheNetworks = function(callback) {
		if (_cacheInvalid())
		{
			// Load the latest list of city services
			console.log("Caching Networks...");
			var added = 0;
			http.get(_cityBikesNetworksURL, 
					 function(res)
			{
				console.log("Got response from citibik.es...");

				res.setEncoding('utf8');
				var networksJSON = "";

				res.on('data', function(chunk) {
					networksJSON = networksJSON + chunk;
				});

				res.on('end', function() {
					console.log("Caching...");

					var networks = JSON.parse(networksJSON);
					var nc = {};

					// update cache
					for (var i=0; i<networks.length; i++)
					{
						var network = networks[i];
						if (!(network.name in nc))
						{
							network.lat = network.lat / 1000000;
							network.lng = network.lng / 1000000;
							var networksCacheEntry = {
								"network": network, 
								"bikes": { 
										lastReadTime: -1,
										cacheExpirationTime: new Date(),
										cachedBikes: []
									},
								"timezone": ""
							};
						
							nc[network.name] = networksCacheEntry;
						
// 							getCityCacheTimezoneInfo(cityCacheEntry);
						
							added++
						}
					}
				
					citybikesProvider._cacheExpirationTime = new Date();
					citybikesProvider._cacheExpirationTime.setTime(citybikesProvider._cacheExpirationTime.getTime() + citybikesProvider._networksCacheTime);
					console.log("Cached " + added + " new networks!");
					console.log("Cache expires at: " + citybikesProvider._cacheExpirationTime);
			
					callback(nc);
				});
			});
		}
		else
		{
			callback(citybikesProvider._cachedNetworks);
		}
	};

	this._cacheNetworks(function(cachedNetworks) {
		citybikesProvider._cachedNetworks = cachedNetworks;
		citybikesProvider._isReady = true;
	});
};

util.inherits(CityBikes, agsdp.AgsDataProviderBase);

// Property overrides
Object.defineProperties(CityBikes.prototype, {
	"name": {
		get: function() {
			return "citybikes";
		}
	},
	"isReady": {
		get: function() {
			return this._isReady;
		}
	},
	"serviceIds": {
		get: function() {
			var out = [];
			if (this._isReady) {
				for (var networkName in this._cachedNetworks) {
					out.push(networkName);
				}
			}
			return out.sort();
		}
	},
	"fields": {
		value: function(serviceId, layerId) {
			return [
				{"name" : "id", "type" : "esriFieldTypeInteger", "alias" : "ID", "nullable" : "true"},
				{"name" : "idx", "type" : "esriFieldTypeInteger", "alias" : "IDX", "nullable" : "true"},
				{"name" : "name", "type" : "esriFieldTypeString", "alias" : "Name", "length" : "255", "nullable" : "true"},
				{"name" : "number", "type" : "esriFieldTypeInteger", "alias" : "Number", "nullable" : "true"},
				{"name" : "free", "type" : "esriFieldTypeInteger", "alias" : "Free", "nullable" : "true"},
				{"name" : "bikes", "type" : "esriFieldTypeInteger", "alias" : "Bikes", "nullable" : "true"},
				{"name" : "bikesClass", "type" : "esriFieldTypeString", "alias" : "Bikes Class", "length" : "255", "nullable" : "true"},
				{"name" : "address", "type" : "esriFieldTypeString", "alias" : "Address", "length" : "255", "nullable" : "true"},
				{"name" : "timestamp", "type" : "esriFieldTypeString", "alias" : "Timestamp", "length" : "255", "nullable" : "true"},
				{"name" : "citybikeTimestamp", "type" : "esriFieldTypeDate", "alias" : "Citybike Timestamp", "length" : 36, "nullable" : "true"},
				{"name" : "localTimestamp", "type" : "esriFieldTypeDate", "alias" : "Local Timestamp", "length" : 36, "nullable" : "true"}
			];
		}
	},
	"countForQuery": {
		value: function(serviceId, layerId, query, callback) {
			callback(0);
		}
	},
	"idsForQuery": {
		value: function(serviceId, layerId, query, callback) {
			callback([]);
		}
// 	},
// 	"featuresForQuery": {
// 		value: function(serviceId, layerId, query, callback) {
// 			callback([]);
// 		}
	}
});

exports.CityBikes = CityBikes;
