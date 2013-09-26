var util = require("util");

var networkTemplate = {
		"city": "Redlands",
		"name": "esribike",
		"url": "http://www.esri.com",
		"radius": 20000,
		"lat": 34056490,
		"lng": -117195681,
		"id": 10000
	},
	stationTemplate = {
		"name": "Esri Campus",
		"idx": 0,
		"timestamp": "2013-08-28T19:07:09.919602",
		"number": 1,
		"free": 4,
		"bikes": 4,
		"coordinates": "",
		"address": "380 New York Street",
		"lat": 34056490,
		"lng": -117195681,
		"id": 0
	}, 
	maxBikes = 4, 
	updateDuration = 30000; // milliseconds

var bikeClassificationScheme = {
	"0": { "min": 0, "max": 0, "label": "No bikes" },
	"1": { "min": 1, "max": 1, "label": "1 bike" },
	"few": { "min": 2, "max": 2, "label": "A few bikes" },
	"plenty": { "min": 3, "max": 10000, "label": "Plenty of bikes" }
};
	
var dockClassificationScheme = {
	"0": { "min": 0, "max": 0, "label": "No docks" },
	"1": { "min": 1, "max": 1, "label": "1 dock" },
	"2": { "min": 2, "max": 2, "label": "2 docks" },
	"3": { "min": 3, "max": 3, "label": "3 docks" },
	"plenty": { "min": 4, "max": 10000, "label": "Plenty of docks" }
};

function zeroPad(number) {
	return ("0000" + number).slice(-2)
}

function getNewStationStatus() {
    var station = JSON.parse(JSON.stringify(stationTemplate));

    var d = new Date();
    d.setTime(d.getTime() + 2 * 60 * 60 * 1000);
    station.timestamp = util.format("%s-%s-%sT%s:%s:%s.%s", d.getUTCFullYear(), 
    	zeroPad(d.getUTCMonth()), zeroPad(d.getUTCDate()), zeroPad(d.getUTCHours()), 
    	zeroPad(d.getUTCMinutes()), zeroPad(d.getUTCSeconds()), d.getUTCMilliseconds());

    station.bikes = Math.floor(Math.random() * (maxBikes + 1));
    station.free = maxBikes - station.bikes;

    return station;
}

EsriBikeshare = function() {
    this.network = JSON.parse(JSON.stringify(networkTemplate));
    this.name = this.network.name;
    this._stations = [];
    this.nextUpdateTime = new Date();
}

EsriBikeshare.prototype = {
    get stations() {
        if (this._stations.length == 0 || this.nextUpdateTime <= new Date()) {
            var s = getNewStationStatus();
            this.nextUpdateTime = new Date() + updateDuration;
            this._stations = [s];
        }
        return this._stations;
    },
	_getBikeRange: function(provider, station) {
		var bikesAvailable = station.attributes.bikes;

		station.attributes["bikesClass"] = provider._getClassValue(bikeClassificationScheme, bikesAvailable);
	},
	_getDockRange: function(provider, station) {
		var docksFree = station.attributes.free;
	
		station.attributes["docksClass"] = provider._getClassValue(dockClassificationScheme, docksFree);
	}

}

exports.EsriBikeshare = EsriBikeshare;
