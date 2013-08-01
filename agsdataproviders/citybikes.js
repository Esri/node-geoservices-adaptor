var agsdp = require("./agsdataproviderbase");
var util = require('util');
var http = require('http');

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

var classificationScheme = {
	"0": { "min": 0, "max": 0, "label": "No bikes" },
	"1": { "min": 1, "max": 1, "label": "1 bike" },
	"few": { "min": 2, "max": 8, "label": "A few bikes" },
	"plenty": { "min": 9, "max": 10000, "label": "Plenty of bikes" }
};

var getBikeRange = function(station) {
	var bikesAvailable = station.attributes.bikes;
	var classes = [];
	for (var k in classificationScheme)
	{
		classes.push(k);
	}
	
	for (var i=0; i<classes.length; i++)
	{
		var className = classes[i];
		var classRange = classificationScheme[className];
		var min = classRange.min;
		var max = classRange.max;

		if (bikesAvailable >= min && bikesAvailable <= max)
		{
			station.attributes["bikesClass"] = classRange.label;
			break;
		}
	}
	if (!station.attributes.hasOwnProperty("bikesClass"))
	{
		station.attributes["bikesClass"] = "Woah, that's a lotta bikes!";
	}
};

CityBikes = function () {
	CityBikes.super_.call(this);

	this._isReady = false;
	this._cachedNetworks = null;
	this._cacheExpirationTime = new Date();
	var _cityBikesNetworksURL = "http://api.citybik.es/networks.json";
	
	this._networksCacheTime = 30 * 60000;
	this._stationCacheTime = 1 * 60000;

	function _cacheInvalid(provider) {
		var now = new Date();
		var cacheInvalid = (provider._cachedNetworks == null) || (now >= provider._cacheExpirationTime);
		return cacheInvalid;
	}

	this._networks = function(callback) {
		if (_cacheInvalid(this))
		{
			// Load the latest list of city services
			console.log("Caching Networks...");
			var added = 0;
			var provider = this;
			http.get(_cityBikesNetworksURL, 
					 function(res)
			{
				res.setEncoding('utf8');
				var networksJSON = "";

				res.on('data', function(chunk) {
					networksJSON = networksJSON + chunk;
				});

				res.on('end', function() {
					console.log("Caching Networks...");

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
							var networkCacheEntry = {
								"network": network, 
								"stations": { 
										lastReadTime: -1,
										cacheExpirationTime: new Date(),
										cachedStations: []
									},
								"timezone": null
							};
						
							nc[network.name] = networkCacheEntry;
						
// 							getCityCacheTimezoneInfo(cityCacheEntry);
						
							added++
						}
					}
				
					provider._cacheExpirationTime = new Date();
					provider._cacheExpirationTime.setTime(provider._cacheExpirationTime.getTime() + provider._networksCacheTime);
					console.log("Cached " + added + " new networks!");
					console.log("Networks cache expires at: " + provider._cacheExpirationTime);
			
					callback(nc);
				});
			});
		}
		else
		{
			callback(this._cachedNetworks);
		}
	};

	this._stationsForNetwork = function(n, callback) {
		if (n.stations.lastReadTime != -1 &&
			n.stations.cacheExpirationTime > new Date())
		{
			console.log("Returning cached station results for " + n.network.name);
			callback(n.stations.cachedStations);
		}
		else
		{
			var cityBikesUrl = n.network.url;
			var provider = this;
			http.get(cityBikesUrl, function (res) {
				res.setEncoding('utf8');
				var stationsJSON = "";
			
				res.on('data', function(chunk) {
					stationsJSON = stationsJSON + chunk;
				});

				res.on('end', function() {
					var stationsData = JSON.parse(stationsJSON);

					n.stations.cachedBikes = [];
					var minX = 0;
					var minY = 0;
					var maxX = 0;
					var maxY = 0;
					for (var i=0; i < stationsData.length; i++)
					{
						var station = stationsData[i];
					
						var tmp = new Date(station.timestamp);
						// The timestamps are CEST - fix by - 2 hours.
						tmp.setTime(tmp.getTime() - (2 * 60 * 60 * 1000));
	// 					console.log(tmp.toString() + " >> " + tmp.toUTCString());
						var epochMS = new Date(tmp).getTime();
						var localEpochMS = new Date(epochMS).getTime();
						station["citybikeTimestamp"] = epochMS;
	// 					console.log(city);
	// 					console.log(city.citySvc);
						if (n.timezone)
						{
							var gmtOffset = parseInt(n.timezone.gmtOffset);
	// 						console.log("Adjusting timezone for " + city.citySvc.name + " by " + gmtOffset);
							localEpochMS = localEpochMS + (gmtOffset * 1000);
						}
						else
						{
// 							console.log("Uh oh - no timezone for " + n.network.name);
						}
						station["localTimestamp"] = localEpochMS;
	// 					console.log(epochMS + " >> " + localEpochMS);
					
						var stationFeature = { 
							"geometry": {"spatialReference": {"wkid":4326}},
							"attributes": {}
						};
						var x = station.lng / 1000000;
						var y = station.lat / 1000000;
						stationFeature.geometry["x"] = x;
						stationFeature.geometry["y"] = y;
						if (x < minX) minX = x;
						if (x > maxX) maxX = x;
						if (y < minY) minY = y;
						if (y > maxY) maxY = y;
						stationFeature.attributes = JSON.parse(JSON.stringify(station));
						getBikeRange(stationFeature);
						delete stationFeature.attributes["lat"];
						delete stationFeature.attributes["lng"];
						delete stationFeature.attributes["coordinates"];
						n.stations.cachedStations.push(stationFeature);
					}
					n.stations["extent"] = {
						"xmin": minX, "ymin": minY,
						"xmax": maxX, "ymax": maxY
					};
					n.stations.lastReadTime = new Date();

					n.stations.cacheExpirationTime =
						new Date(n.stations.lastReadTime.getTime() + provider._stationCacheTime);

					console.log(util.format('Cached %d stations for %s at %s (expires %s)',
											stationsData.length, n.network.name,
											n.stations.lastReadTime,
											n.stations.cacheExpirationTime));
				
					callback(n.stations.cachedStations);
				});
			});
		}
	};

	var citybikesProvider = this;
	this._networks(function(networkList) {
		citybikesProvider._cachedNetworks = networkList;
		citybikesProvider._isReady = true;
	});
};

util.inherits(CityBikes, agsdp.AgsDataProviderBase);

// Property overrides
Object.defineProperties(CityBikes.prototype, {
	name: {
		get: function() {
			return "citybikes";
		}
	},
	isReady: {
		get: function() {
			return this._isReady;
		}
	},
	serviceIds: {
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
	fields: {
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
	featuresForQuery: {
		value: function(serviceId, layerId, query, callback) {
			var provider = this;
			this._networks(function(networks) {
				var network = networks[serviceId];
				provider._stationsForNetwork(network, function(stationFeatures) {
					callback(stationFeatures);
				});
			});
		}
	}
});

exports.CityBikes = CityBikes;
