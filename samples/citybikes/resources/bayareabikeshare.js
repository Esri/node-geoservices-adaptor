var util = require("util"),
	http = require("http");

// BayArea Bike Share data is in JSON and looks like this:
// {
// 	"id": 77,
// 	"stationName": "Market at Sansome",
// 	"availableDocks": 16,
// 	"totalDocks": 23,
// 	"latitude": 37.789625,
// 	"longitude": -122.400811,
// 	"statusValue": "In Service",
// 	"statusKey": 1,
// 	"availableBikes": 7,
// 	"stAddress1": "Market at Sansome",
// 	"stAddress2": "Market Street",
// 	"city": "San Francisco",
// 	"postalCode": "",
// 	"location": "",
// 	"altitude": "",
// 	"testStation": false,
// 	"lastCommunicationTime": null,
// 	"landMark": "San Francisco"
// }

var networkTemplate = {
		"city": "Bay Area",
		"name": "bayareabikeshare",
		"url": "http://bayareabikeshare.com/stations/json",
		"radius": 20000,
		"lat": 37330670,
		"lng": -121901593,
		"id": 10002
	},
	stationTemplate = {
		"name": "Somewhere in Boston",
		"idx": 0,
		"timestamp": "2013-08-28T19:07:09.919602",
		"number": 1,
		"free": 4,
		"bikes": 4,
		"coordinates": "",
		"address": "Somewhere in Boston",
		"lat": 42355596,
		"lng": -71072780,
		"id": 0
	}, 
	mapping = {
		"name": "stationName",
		"idx": "id",
// 		"timestamp": "lastCommunicationTime",
		"number": "id",
		"free": "availableDocks",
		"bikes": "availableBikes",
		"address": "stAddress1",
		"lat": "latitude",
		"lng": "longitude",
		"id": "id"
	},
	cityNames = [
		"San Jose",
		"Redwood City",
		"Mountain View",
		"Palo Alto",
		"San Francisco"
	];

function zeroPad(number) {
	return ("0000" + number).slice(-2)
}

BayAreaBikeshare = function() {
    this.network = JSON.parse(JSON.stringify(networkTemplate));
    this.name = this.network.name;
    this._stations = [];
    this.nextUpdateTime = new Date();
}

BayAreaBikeshare.prototype = {
    getStations: function(callback) {
		var bikeShare = this;
		http.get(this.network.url, (function (res)
		{
			res.setEncoding('utf8');
			var stationsJSON = "";

			res.on('data', function(chunk) {
				stationsJSON = stationsJSON + chunk;
			});
			
			res.on('error', function(e) {
				console.log(e);
				debugger;
			});

			res.on('end', (function() 
			{
				var result = null;
				try {
					// Done eating the stations HTTP response for a given network.
					result = JSON.parse(stationsJSON);
				} catch (err) {
					return callback(err, null);
				}

				try {
					var timestamp = new Date(result.executionTime).getTime();
					var stations = result.stationBeanList;
					var processedStations = [];
					for (var i=0; i<stations.length; i++) {
						var station = stations[i];
						// Create a new station record
						var processedStation = JSON.parse(JSON.stringify(stationTemplate));
						for (var destKey in mapping) {
							var potVar = station[mapping[destKey]];
							var parsedVar = parseFloat(potVar);
							if (isNaN(parsedVar)) {
								parsedVar = potVar;
							}
							processedStation[destKey] = parsedVar;
						}
						
						processedStation.timestamp = timestamp;
debugger;
						processedStation = bikeShare.postProcessStation(processedStation);
						processedStations.push(processedStation);
					}
					return callback(null, processedStations);
				} catch (e) {
					console.log(e + " getting stations for " + this.network.name);
					console.log(stationsData);
					return callback(e, null);
				}
			}).bind(this));
		}).bind(this));
    },
    postProcessStation: function(station) {
		var d = new Date(station.timestamp);
		d.setTime(d.getTime() + 2 * 60 * 60 * 1000);
		station.timestamp = util.format("%s-%s-%sT%s:%s:%s.%s", d.getUTCFullYear(), 
			zeroPad(d.getUTCMonth()), zeroPad(d.getUTCDate()), zeroPad(d.getUTCHours()), 
			zeroPad(d.getUTCMinutes()), zeroPad(d.getUTCSeconds()), d.getUTCMilliseconds());

		station.lat = station.lat * 1000000;
		station.lng = station.lng * 1000000;

		return station;
	}
}

exports.BayAreaBikeshare = BayAreaBikeshare;
