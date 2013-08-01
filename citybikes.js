"use strict";

var http = require('http');
var path = require('path');
var util = require('util');
var fs = require('fs');

var agol = require('./agol.js');

var networksCacheTime = 30 * 60000;
var networkCacheTime = 1 * 60000;

var cachedCities = null;
var cacheExpirationTime = new Date();
var citiesAwaitingTimezone = {};
var cityTimeZones = {};
var cityTimeZonesCacheExpired = false;

var cityBikesNetworksURL = "http://api.citybik.es/networks.json";
var timezoneCacheFilename = "timezones.json";

if (fs.existsSync(timezoneCacheFilename))
{
	var fileInfo = fs.statSync(timezoneCacheFilename);
	var modified = new Date(fileInfo.mtime);
	var modifiedDay = modified.getDate();
	var now = new Date();
	var today = now.getDate();

	if ((now > modified + (24*60*60*1000)) || (today != modifiedDay))
	{
		console.log("Timezones out of date.");
		cityTimeZonesCacheExpired = true;
	}
	else
	{
		console.log("Timezones valid.");
		// Let's load any cache we have. It's better than nothing if the API fails.
		console.log("Loading timezones");
		cityTimeZones = JSON.parse(fs.readFileSync(timezoneCacheFilename, 'utf8'));
		console.log("Loaded timezones");
	}
}

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

var getCityCacheTimezoneInfo = function(cityCacheEntry) {
	var city = cityCacheEntry.citySvc;
	if (cityTimeZones.hasOwnProperty(city.name))
	{
		return cityTimeZones[city.name];
	}
	else
	{
		citiesAwaitingTimezone[city.name] = true;
		var timezoneUrl = util.format("http://api.timezonedb.com/?key=%s&lat=%d&lng=%d&format=json", "IMPMC00M2XNY", city.lat, city.lng);
		http.get(timezoneUrl, function (res) {
			var timezoneJSON = "";
			res.setEncoding('utf8');
			res.on('data', function(chunk) {
				timezoneJSON += chunk;
			});
			res.on('end', function() {
				var loadedTimezoneOK = false;
				try
				{
					var timezone = JSON.parse(timezoneJSON);
					loadedTimezoneOK = true;
				}
				catch (err)
				{
					console.log(err)
					console.log(timezoneJSON);
				}
				
				if (loadedTimezoneOK)
				{
		// 			console.log("Read timezone!");
		// 			console.log(city);
		// 			console.log(timezone);
					if (timezone.status === "OK")
					{
		// 				console.log("Setting timezone");
						delete timezone["status"];
						delete timezone["message"];
						city["timezone"] = timezone;

						cityTimeZones[city.name] = timezone;
				
						delete citiesAwaitingTimezone[city.name];
						console.log("Timezone: " + city.name + " (" + Object.size(citiesAwaitingTimezone) + ")");
						console.log(timezone);
						if (Object.size(citiesAwaitingTimezone) == 0)
						{
							fs.writeFile('timezones.json', JSON.stringify(cityTimeZones));
						}
					}
				}
			});
		});
	}
}


function cacheCities(callback) {
	if (cacheInvalid())
	{
		// Load the latest list of city services
		console.log("Caching Cities...");
		var added = 0;
		http.get(cityBikesNetworksURL, 
				 function(res)
		{
			console.log("Got response from citibik.es...");

			res.setEncoding('utf8');
			var citiesJSON = "";

			res.on('data', function(chunk) {
				citiesJSON = citiesJSON + chunk;
			});

			res.on('end', function() {
				console.log("Caching...");

				var cities = JSON.parse(citiesJSON);
				var cc = cachedCities = {};

				// update cache
				for (var i=0; i<cities.length; i++)
				{
					var city = cities[i];
					if (!(city.name in cc))
					{
						city.lat = city.lat / 1000000;
						city.lng = city.lng / 1000000;
						var cityCacheEntry = {
							"citySvc": city, 
							"agsSvc": agol.getServiceJSONForServicesList(city.name),
							"bikes": { 
									lastReadTime: -1,
									cacheExpirationTime: new Date(),
									cachedBikes: []
								},
							"timezone": ""
						};
						
						cc[city.name] = cityCacheEntry;
						
						getCityCacheTimezoneInfo(cityCacheEntry);
						
						added++
					}
				}
				
				cacheExpirationTime = new Date();
				cacheExpirationTime.setTime(cacheExpirationTime.getTime() + networksCacheTime);
				console.log("Cached " + added + " new cities!");
				console.log("Cache expires at: " + cacheExpirationTime);
			
				callback(cachedCities);
			});
		});
	}
	else
	{
		callback(cachedCities);
	}
}

function bikesCacheInvalid(city) {
	var bikes = city.bikes;
	return (bikes.lastReadTime == -1 || bikes.cacheExpirationTime <= new Date());
}

var classificationScheme = {
	"0": { "min": 0, "max": 0, "label": "No bikes" },
	"1": { "min": 1, "max": 1, "label": "1 bike" },
	"few": { "min": 2, "max": 8, "label": "A few bikes" },
	"plenty": { "min": 9, "max": 10000, "label": "Plenty of bikes" }
};

var getBikeRange = function(bike) {
	var bikesAvailable = bike.attributes.bikes;
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

// 		console.log(bikesAvailable + " = " + className + " : " + min + " -> " + max);
		
		if (bikesAvailable >= min && bikesAvailable <= max)
		{
			bike.attributes["bikesClass"] = classRange.label;
			break;
		}
	}
	if (!bike.attributes.hasOwnProperty("bikesClass"))
	{
		bike.attributes["bikesClass"] = "Woah, that's a lotta bikes!";
	}
};

function getBikes(city, callback) {
	if (bikesCacheInvalid(city))
	{
		var cityBikesUrl = city.citySvc.url;
		http.get(cityBikesUrl,
				 function (res) {
			res.setEncoding('utf8');
			var bikesJSON = "";
			
			res.on('data', function(chunk) {
				bikesJSON = bikesJSON + chunk;
			});

			res.on('end', function() {
				var bikes = JSON.parse(bikesJSON);

				city.bikes.cachedBikes = [];
				var minX = 0;
				var minY = 0;
				var maxX = 0;
				var maxY = 0;
				for (var i=0; i < bikes.length; i++)
				{
					var bike = bikes[i];
					
					var tmp = new Date(bike.timestamp);
					// The timestamps are CEST - fix by - 2 hours.
					tmp.setTime(tmp.getTime() - (2 * 60 * 60 * 1000));
// 					console.log(tmp.toString() + " >> " + tmp.toUTCString());
					var epochMS = new Date(tmp).getTime();
					var localEpochMS = new Date(epochMS).getTime();
					bike["citybikeTimestamp"] = epochMS;
// 					console.log(city);
// 					console.log(city.citySvc);
					if (cityTimeZones.hasOwnProperty(city.citySvc.name))
					{
						var timezone = cityTimeZones[city.citySvc.name];
						var gmtOffset = parseInt(timezone.gmtOffset);
// 						console.log("Adjusting timezone for " + city.citySvc.name + " by " + gmtOffset);
						localEpochMS = localEpochMS + (gmtOffset * 1000);
					}
					else
					{
						console.log("Uh oh - no timezone for " + city.citySvc.name);
					}
					bike["localTimestamp"] = localEpochMS;
// 					console.log(epochMS + " >> " + localEpochMS);
					
					var agolBike = { 
						"geometry": {"spatialReference": {"wkid":4326}},
						"attributes": {}
					};
					var x = bike.lng / 1000000;
					var y = bike.lat / 1000000;
					agolBike.geometry["x"] = x;
					agolBike.geometry["y"] = y;
					if (x < minX) minX = x;
					if (x > maxX) maxX = x;
					if (y < minY) minY = y;
					if (y > maxY) maxY = y;
					agolBike.attributes = JSON.parse(JSON.stringify(bike));
					getBikeRange(agolBike);
					delete agolBike.attributes["lat"];
					delete agolBike.attributes["lng"];
					delete agolBike.attributes["coordinates"];
					city.bikes.cachedBikes.push(agolBike);
				}
				city.bikes["extent"] = {
					"xmin": minX, "ymin": minY,
					"xmax": maxX, "ymax": maxY
				};
				city.bikes.lastReadTime = new Date();
				city.bikes.cacheExpirationTime =
					new Date(city.bikes.lastReadTime.getTime() + networkCacheTime);
					
				console.log(util.format('Cached %d bikes for %s at %s (expires %s)',
										bikes.length, city.citySvc.name,
										city.bikes.lastReadTime,
										city.bikes.cacheExpirationTime));
				
				callback(city.bikes.cachedBikes);
			});
		});
	}
	else
	{
		callback(city.bikes.cachedBikes);
	}
}

function cacheInvalid() {
	var now = new Date();
	return (cachedCities == null) || (now >= cacheExpirationTime);
}

exports.getCities = function(callback) {
	if (cacheInvalid())
	{
		cacheCities(callback);
	}
	else
	{
		callback(cachedCities);
	}
}

exports.getBikes = getBikes;

