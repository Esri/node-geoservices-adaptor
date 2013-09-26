var util = require("util"),
	http = require("http"),
	xml2js = require("xml2js"),
	parser = new xml2js.Parser();

// Hubway data is in XML and looks like this:
// <station>
// 		<id>58</id>
// 		<name>The Esplanade - Beacon St. at Arlington St.</name>
// 		<terminalName>D32017</terminalName>
// 		<lastCommWithServer>1379796612852</lastCommWithServer>
// 		<lat>42.355596</lat>
// 		<long>-71.07278</long>
// 		<installed>true</installed>
// 		<locked>false</locked>
// 		<installDate>1364310000000</installDate>
// 		<removalDate />
// 		<temporary>false</temporary>
// 		<public>true</public>
// 		<nbBikes>8</nbBikes>
// 		<nbEmptyDocks>11</nbEmptyDocks>
// 		<latestUpdateTime>1379796364076</latestUpdateTime>
// </station>

var networkTemplate = {
		"city": "Boston",
		"name": "hubway",
		"url": "http://www.thehubway.com/data/stations/bikeStations.xml",
		"radius": 20000,
		"lat": 42355596,
		"lng": -71072780,
		"id": 10001
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
		"name": "name",
		"idx": "id",
		"timestamp": "latestUpdateTime",
		"number": "id",
		"free": "nbEmptyDocks",
		"bikes": "nbBikes",
		"address": "name",
		"lat": "lat",
		"lng": "long",
		"id": "id"
	};

function zeroPad(number) {
	return ("0000" + number).slice(-2)
}

HubwayBikeshare = function() {
    this.network = JSON.parse(JSON.stringify(networkTemplate));
    this.name = this.network.name;
    this._stations = [];
    this.nextUpdateTime = new Date();
}

HubwayBikeshare.prototype = {
    getStations: function(callback) {
		var bikeShare = this;
		http.get(this.network.url, (function (res)
		{
			res.setEncoding('utf8');
			var stationsXML = "";

			res.on('data', function(chunk) {
				stationsXML = stationsXML + chunk;
			});
			
			res.on('error', function(e) {
				console.log(e);
				debugger;
			});

			res.on('end', (function() 
			{
				var stationsData = null;
				try {
					// Done eating the stations HTTP response for a given network.
					stationsData = parser.parseString(stationsXML, function(err,result) {
						if (err) {
							return callback(err, null);
						}
						
						var stations = result.stations.station;
						var processedStations = [];
						for (var i=0; i<stations.length; i++) {
							var station = stations[i];
							// Create a new station record
							var processedStation = JSON.parse(JSON.stringify(stationTemplate));
							for (var destKey in mapping) {
								var potVar = station[mapping[destKey]][0];
								var parsedVar = parseFloat(potVar);
								if (isNaN(parsedVar)) {
									parsedVar = potVar;
								}
								processedStation[destKey] = parsedVar;
							}

							processedStation = bikeShare.postProcessStation(processedStation);
							processedStations.push(processedStation);
						}
						return callback(null, processedStations);
					});
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

exports.HubwayBikeshare = HubwayBikeshare;
