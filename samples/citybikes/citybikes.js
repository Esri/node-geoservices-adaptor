var agsdp = require("../../src/agsdataproviderbase");
var util = require("util");
var http = require("http");
var path = require("path");
var fs = require("fs");

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

CityBikes = function () {
	CityBikes.super_.call(this);

	this._isReady = false;
	this._cachedNetworks = null;
	this._cacheExpirationTime = new Date();
	var _cityBikesNetworksURL = "http://api.citybik.es/networks.json";
	
	this._networksCacheTime = 30 * 60000;
	this._stationCacheTime = 1 * 60000;

	// A dictionary of timezones matched to cities.
	this._networkTimezones = {};
	this._networksAwaitingTimezone = {};

	this._timezoneCacheFilename = path.join(path.dirname(module.filename),"data","timezones.json");

	if (fs.existsSync(this._timezoneCacheFilename))
	{
		// Load a timezones file. Otherwise we'll be forced to create one from hits against
		// the timezonedb API.
		this._networkTimezones = JSON.parse(fs.readFileSync(this._timezoneCacheFilename, 'utf8'));
		console.log("Loaded timezones from " + this._timezoneCacheFilename);
	}

	function _cacheInvalid(provider) {
		// Convenience function to check whether we need to refresh our Networks data.
		var now = new Date();
		var cacheInvalid = (provider._cachedNetworks == null) || (now >= provider._cacheExpirationTime);
		return cacheInvalid;
	}

	this._getTimezone = function(networkCacheEntry, callback) {
		// We'll try to load some timezone information so that in addition to a UTC
		// timestamp describing when each station in a network was last udpated, we
		// can also give a client some information about displaying that time in a
		// suitable local format.
		//
		// This is an example of how we fix the underlying data on the fly (the timestamps
		// that are returned by Citybik.es are not UTC, but rather local time for the 
		// server, in Madrid) and also how we augment that information with data which
		// consumers of the service are likely to find useful (JavaScript handling of
		// timezone-specific calculations and formatting is pretty poor).
		var network = networkCacheEntry.network;
		var networkName = networkCacheEntry.network.name;
		if (this._networkTimezones.hasOwnProperty(networkName))
		{
			// Try to read the timezone information from a cache file.
			networkCacheEntry["timezone"] = this._networkTimezones[networkName];
			callback.call(this, networkCacheEntry);
		}
		else
		{
			// Try to load the timezone information from the timezonedb API. Note that this
			// is rate limited and it's pretty easy during development to hit the limit,
			// hence the use of the cache above.
			this._networksAwaitingTimezone[networkName] = true;
			var timezoneUrl = util.format("http://api.timezonedb.com/?key=%s&lat=%d&lng=%d&format=json", "IMPMC00M2XNY", network.lat, network.lng);
			var provider = this;
			http.get(timezoneUrl, function (res) {
				var timezoneJSON = "";
				res.setEncoding('utf8');
				res.on('data', function(chunk) {
					timezoneJSON += chunk;
				});
				res.on('end', function() {
					var loadedTimezoneOK = false;
					var timezone = null;
					try
					{
						timezone = JSON.parse(timezoneJSON);
						loadedTimezoneOK = true;
					}
					catch (err)
					{
						console.log(err)
						console.log(timezoneJSON);
					}
				
					if (loadedTimezoneOK)
					{
						if (timezone.status === "OK")
						{
							delete timezone["status"];
							delete timezone["message"];
							// Mark this timezone information as valid for a day.
							timezone["cacheRefreshDue"] = (new Date()).getTime() + 24*60*60000;
							networkCacheEntry["timezone"] = timezone;

							// And associate it with whichever network asked for it.
							provider._networkTimezones[networkName] = timezone;

							// Stop tracking that we're still looking for it.				
							delete provider._networksAwaitingTimezone[networkName];
							console.log("Timezone: " + networkName + " (" + Object.size(provider._networksAwaitingTimezone) + ")");
							console.log(timezone);
							
							// And if we're no longer looking for any timezones, save
							// the file in a cache so we don't hit our rate-limit on the
							// timezonedb API too soon.
							if (Object.size(provider._networksAwaitingTimezone) == 0)
							{
								if (!fs.existsSync(path.dirname(provider._timezoneCacheFilename))) {
									fs.mkDirSync(path.dirname(provider._timezoneCacheFilename));
								}
								fs.writeFile(provider._timezoneCacheFilename, JSON.stringify(provider._networkTimezones));
								console.log("Wrote timezones to " + provider._timezoneCacheFilename);
							}
							
							// Call back with our updated cache entry, setting "this"
							callback.call(provider, networkCacheEntry);
						}
					}
				});
			});
		}
	};

	this._networks = function(callback) {
		if (_cacheInvalid(this))
		{
			// Load the latest list of bike share networks
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
					// Finished eating our HTTP response.
					console.log("Caching Networks...");

					// JSON from the CityBik.es API.
					var networks = JSON.parse(networksJSON);
					// A blank cache
					var nc = {};

					// update cache
					for (var i=0; i<networks.length; i++)
					{
						var network = networks[i];
						if (!(network.name in nc))
						{
							// No entry in the cache for this network.
							// 1. Fix the "lat" and "lng" that we get back.
							network.lat = network.lat / 1000000;
							network.lng = network.lng / 1000000;
							var x = network.lng;
							var y = network.lat;
							var w = 0.5, h = 0.5;
							// Build an extent based off this lat/lng for the FeatureService
							network["agsextent"] = {
								xmin: x - (w/2),
								xmax: x + (w/2),
								ymin: y - (h/2),
								ymax: y + (h/2),
								spatialReference: {
									"wkid": 4326,
									"latestWkid": 4326
								}
							};

							// Create a new cache entry based off this...
							var networkCacheEntry = {
								"network": network, 
								"stations": { 
										lastReadTime: -1,
										cacheExpirationTime: new Date(),
										cachedStations: []
									},
								"timezone": null
							};
							
							// And store it in the cache
							nc[network.name] = networkCacheEntry;
						
							// Set up the timezone for this network
							provider._getTimezone(networkCacheEntry, function() {
								if (process.env.VCAP_APP_PORT) {
									// Don't pre-cache unless deployed
									console.log("Precaching stations for " + networkCacheEntry.network.name);
									provider._stationsForNetwork(networkCacheEntry, function(stations) {
										return null;
									});
								}
							});
						
							added++
						}
					}
				
					// Mark the networks cache as valid for the next little while.
					provider._cacheExpirationTime = new Date();
					provider._cacheExpirationTime.setTime(provider._cacheExpirationTime.getTime() + provider._networksCacheTime);
					console.log("Cached " + added + " new networks!");
					console.log("Networks cache expires at: " + provider._cacheExpirationTime);
			
					// And callback with the networks cache.
					callback(nc);
				});
			});
		}
		else
		{
			// Simple. Just return the cached networks.
			callback(this._cachedNetworks);
		}
	};

	// We add a field that gives some idea of the number of bikes available rather than
	// raw numbers - this is easier to render off for AGOL. Better maps FTW!
	//
	// First, we describe this scheme in this._classificationScheme
	this._classificationScheme = {
		"0": { "min": 0, "max": 0, "label": "No bikes" },
		"1": { "min": 1, "max": 1, "label": "1 bike" },
		"few": { "min": 2, "max": 8, "label": "A few bikes" },
		"plenty": { "min": 9, "max": 10000, "label": "Plenty of bikes" }
	};

	// Then we provide a way to calculate the value from the scheme for a network's station.
	this._getBikeRange = function(station) {
		var bikesAvailable = station.attributes.bikes;
		var classes = [];
		for (var k in this._classificationScheme)
		{
			classes.push(k);
		}
	
		for (var i=0; i<classes.length; i++)
		{
			var className = classes[i];
			var classRange = this._classificationScheme[className];
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

	this._stationsForNetwork = function(n, callback) {
		// Given a networkCacheEntry (see this._networks and this._cachedNetworks),
		// give me the latest information on all the stations. Note, the cached stations
		// for a network are valid for 60 seconds.
		if (n.stations.lastReadTime != -1 &&
			n.stations.cacheExpirationTime > new Date())
		{
			// Easy, we already have the info cached.
			console.log("Returning cached station results for " + n.network.name);
			callback(n.stations.cachedStations);
		}
		else
		{
			// OK, we need to go and ask api.citybik.es for the info.
			// Note, we can only ask for the current state of ALL stations in a given network.
			var cityBikesUrl = n.network.url;
			var provider = this;
			http.get(cityBikesUrl, function (res) {
				res.setEncoding('utf8');
				var stationsJSON = "";
			
				res.on('data', function(chunk) {
					stationsJSON = stationsJSON + chunk;
				});

				res.on('end', function() {
					// Done eating the stations HTTP response for a given network.
					var stationsData = JSON.parse(stationsJSON);

					// Clear the cache.
					n.stations.cachedStations = [];
					// We'll build an accurate envelope of all stations for later.
					var minX = 0;
					var minY = 0;
					var maxX = 0;
					var maxY = 0;
					for (var i=0; i < stationsData.length; i++)
					{
						var station = stationsData[i];

						// Get the non-UTC timestamp returned by api.citybik.es					
						var tmp = new Date(station.timestamp);
						station["citybikesTimeString"] = station.timestamp;

						// The timestamps are CEST - fix by - 2 hours.
						tmp.setTime(tmp.getTime() - (2 * 60 * 60 * 1000));
						var epochMS = new Date(tmp).getTime();
						// Return the corrected time as a new attribute.
						station["utcTime"] = epochMS;

						// We'll also try to get a timestamp local to someone in the network.
						var localEpochMS = new Date(epochMS).getTime();

						// We're also going to try to give any client some info about how
						// to convert the UTC timestamp to something appropriate for the 
						// network itself, or to do time calculations.
						gmtOffStr = "";

						if (n.timezone)
						{
							var gmtOffset = parseInt(n.timezone.gmtOffset);
							localEpochMS = localEpochMS + (gmtOffset * 1000);
							// Build a string suitable to append to a Date/Time string
							// to specify offset from GMT.
							var offsetSeconds = n.timezone.gmtOffset,
								offsetMinutes = Math.round(Math.abs(offsetSeconds)/60),
								offsetMinRem = offsetMinutes%60,
								offsetHours = (offsetMinutes-offsetMinRem)/60;
							gmtOffStr += offsetSeconds<0?"-":"+";
							gmtOffStr += offsetHours==0?"00":((offsetHours<10?"0":"") + offsetHours);
							gmtOffStr += offsetMinRem==0?"00":((offsetMinRem<10?"0":"") + offsetMinRem);
							station["timezone"] = n.timezone.abbreviation;
							station["timezoneOffset"] = parseInt(n.timezone.gmtOffset);
						}
						else
						{
							// We haven't been able to get timezone information for this
							// network so we must default to everything beting UTC (akaGMT).
							gmtOffStr += "+0000";
							station["timezone"] = "GMT";
							station["timezoneOffset"] = 0;
							console.log("Uh oh - no timezone for " + n.network.name);
						}
						station["timezoneOffsetString"] = "GMT" + gmtOffStr;
						station["localTimeString"] = new Date(localEpochMS).toUTCString() + gmtOffStr;

						// Fix the lat/lng					
						var x = station.lng / 1000000;
						var y = station.lat / 1000000;
						// And build that extent so that the "Layer (Feature Service)"
						// JSON can specify the extent of the layer. That way, when it's
						// added to a map, it can be zoomed to easily.
						if (i==0) {
							minX = x;
							maxX = x;
							minY = y;
							maxY = y;
						} else {
							if (x < minX) minX = x;
							if (x > maxX) maxX = x;
							if (y < minY) minY = y;
							if (y > maxY) maxY = y;
						}
						
						// Now build that GeoService formatted feature that we need.
						var stationFeature = { 
							geometry: {
								x: x,
								y: y,
								spatialReference: {
									wkid: 4326
								}
							},
							attributes: JSON.parse(JSON.stringify(station))
						};
						
						// Get that nice smart-value for AGOL rendering (see _getBikeRange()).
						provider._getBikeRange(stationFeature);
						
						// Remove some attributes we don't want to output.
						delete stationFeature.attributes["lat"];
						delete stationFeature.attributes["lng"];
						delete stationFeature.attributes["coordinates"];
						delete stationFeature.attributes["timestamp"];
						
						// And add the stations cache to our overall cache structure.
						n.stations.cachedStations.push(stationFeature);
					}
					// Store the calculated extent
					n.stations["extent"] = n.network["agsextent"] = {
						xmin: minX, ymin: minY,
						xmax: maxX, ymax: maxY,
						spatialReference: {
							"wkid": 4326,
							"latestWkid": 4326
						}
					};
					
					// Flag when we last parsed the stations for this network.
					n.stations.lastReadTime = new Date();

					// And mark when the cache will next be invalid.
					n.stations.cacheExpirationTime =
						new Date(n.stations.lastReadTime.getTime() + provider._stationCacheTime);

					console.log(util.format('Cached %d stations for %s at %s (expires %s)',
											stationsData.length, n.network.name,
											n.stations.lastReadTime,
											n.stations.cacheExpirationTime));

					// Good. Call back with the results of our hard work.				
					callback(n.stations.cachedStations);
				});
			});
		}
	};

	// Someone created an instance of us. Let's get our caches built.
	var citybikesProvider = this;
	this._networks(function(networkList) {
		citybikesProvider._cachedNetworks = networkList;
		citybikesProvider._isReady = true;
	});
};

// This node.js helper function allows us to inherit from agsdataproviderbase.
util.inherits(CityBikes, agsdp.AgsDataProviderBase);

// And now we'll override only what we need to (see also /src/agsdataproviderbase.js).
Object.defineProperties(CityBikes.prototype, {
	name: {
		get: function() {
			// Override the service name - every data provider should override this.
			return "citybikes";
		}
	},
	isReady: {
		get: function() {
			// Since we depend on some async stuff, we might not be ready immediately.
			// We'll track our readiness in the constructor and return whatever that says
			// is the case.
			return this._isReady;
		}
	},
	serviceIds: {
		get: function() {
			// Each Network (typically a city) is mapped to a FeatureService. We'll then
			// give each feature service a single layer, and that layer will contain the
			// actual bike stations information for that network. So, we use the network
			// name (the Citybik.es identifier) as the ServiceID.
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
			// These are the fields that the single layer of each FeatureService will return.
			// this could be different for each feature service and layer, but in the case
			// of Citybik.es the source schema does not change across networks so we just
			// use a constant schema for our FeatureLayers.
			return [
				{"name" : "id", "type" : "esriFieldTypeInteger", "alias" : "ID", "nullable" : "true"},
				{"name" : "idx", "type" : "esriFieldTypeInteger", "alias" : "IDX", "nullable" : "true"},
				{"name" : "name", "type" : "esriFieldTypeString", "alias" : "Name", "length" : "255", "nullable" : "true"},
				{"name" : "number", "type" : "esriFieldTypeInteger", "alias" : "Number", "nullable" : "true"},
				{"name" : "free", "type" : "esriFieldTypeInteger", "alias" : "Free", "nullable" : "true"},
				{"name" : "bikes", "type" : "esriFieldTypeInteger", "alias" : "Bikes", "nullable" : "true"},
				{"name" : "bikesClass", "type" : "esriFieldTypeString", "alias" : "Bikes Class", "length" : "255", "nullable" : "true"},
				{"name" : "address", "type" : "esriFieldTypeString", "alias" : "Address", "length" : "255", "nullable" : "true"},
				{"name" : "citybikesTimeString", "type" : "esriFieldTypeString", "alias" : "CityBikes Time", "length" : "255", "nullable" : "true"},
				{"name" : "utcTime", "type" : "esriFieldTypeDate", "alias" : "UTC Timestamp", "length" : 36, "nullable" : "true"},
				{"name" : "timezone", "type" : "esriFieldTypeString", "alias" : "Timezone Code", "length" : "5", "nullable" : "true"},
				{"name" : "timezoneOffset", "type" : "esriFieldTypeInteger", "alias" : "Timezone Offset", "nullable" : "true"},
				{"name" : "timezoneOffsetString", "type" : "esriFieldTypeString", "alias" : "Timezone Offset String", "length" : "8", "nullable" : "true"},
				{"name" : "localTimeString", "type" : "esriFieldTypeString", "alias" : "Local Time", "length" : "255", "nullable" : "true"},
			];
		}
	},
	featuresForQuery: {
		value: function(serviceId, layerId, query, callback) {
			// Get the bike networks (which map to FeatyreServices). They may be cached,
			// or may need to be fetched. So they are returned with a callback.
			var provider = this;
			this._networks(function(networks) {
				// Now we have the full list of networks let's pick out the one we're 
				// after (which matches the "serviceId" and get all the bike stations in 
				// that network. Again, this may be cached, or may need to be got afresh.
				// Note that we know we only have a single layer (stations) for any
				// feature service (network) so we ignore the layerId.
				var network = networks[serviceId];
				provider._stationsForNetwork(network, function(stationFeatures) {
					// We have the stations for the network. These are our features
					// that match the query. So call back to our caller with our results.
					callback(stationFeatures);
				});
			});
		}
	},
	featureServiceDetails: {
		value: function(detailsTemplate, serviceId, layerId) {
			// We'll take the default JSON that the engine has calculated for us, but we'll
			// inject an extent if we have one stored so that clients can connect to us
			// more easily.
			if (this._cachedNetworks &&
				this._cachedNetworks.hasOwnProperty(serviceId)) {
				var network = this._cachedNetworks[serviceId].network;
				if (network.hasOwnProperty("agsextent"))
				{
					detailsTemplate.initialExtent = network.agsextent;
				}
			}
			return detailsTemplate;
		}
	},
	featureServiceLayerDetails: {
		value: function(detailsTemplate, serviceId, layerId) {
			// We'll take the default JSON that the engine has calculated for us, but we'll
			// inject an extent if we have one stored so that clients can connect to us
			// more easily.
			if (this._cachedNetworks &&
				this._cachedNetworks.hasOwnProperty(serviceId)) {
				var network = this._cachedNetworks[serviceId].network;
				if (network.hasOwnProperty("agsextent"))
				{
					// If we have an accurate extent based off cached station locations,
					// use that.
					detailsTemplate.extent = network.agsextent;
				}
				else
				{
					// Otherwise, use the lat/lon of the network as returned by CityBik.es
					// and build an extent around that.
					var x = network.lng;
					var y = network.lat;
					var w = 0.25, h = 0.25;
					detailsTemplate.extent.xmin = x - w;
					detailsTemplate.extent.xmax = x + w;
					detailsTemplate.extent.ymin = y - h;
					detailsTemplate.extent.ymax = y + h;
				}
			}
			return detailsTemplate;
		}
	}
});

// This allows node.js to import the right things when someone does a require() on us.
exports.CityBikes = CityBikes;
