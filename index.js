var express = require("express");
var app = express();
var http = require("http");
var url = require("url");
var fs = require("fs");
var path = require("path");
var util = require("util");
// var ags = require('./ags.js');
var agsurls = require("./agsurls");
var agsoutput = require("./agsoutput");
var citybikes = require("./agsdataproviders/citybikes");


// General URL engine for routing templated AGS requests
var routerUrls = new agsurls.AgsUrls();

// Helper Functions
String.prototype.bool = function() {
    return (/^true$/i).test(this);
};

var useCallback = function(request) {
	var q = url.parse(request.url, true).query;
	return q.hasOwnProperty('callback');
};

function getSvcForRequest(request) {
	var svcs = app.get("agsDataProviders");
	if (svcs.hasOwnProperty(request.params.dataProviderName)) {
		return svcs[request.params.dataProviderName].dataProvider;
	}
	else
	{
		console.log("Unknown Data Provider Requested: " + request.params.dataProviderName);
		return null;
	}
};

// App configuration
app.configure(function() {
// 	app.enable("jsonp callback");

	app.use(express.methodOverride());
	app.use(express.bodyParser());
 
	// ## CORS middleware
	//
	// see: http://stackoverflow.com/questions/7067966/how-to-allow-cors-in-express-nodejs
	var allowCrossDomain = function(req, res, next) {
		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
		res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		// intercept OPTIONS method
		if ('OPTIONS' == req.method) {
			res.send(200);
		}
		else {
			next();
		}
	};

	app.use(allowCrossDomain);
	app.use(function(req,res,next) {
		req["agsOutFormat"] = req.param("f") || "html";
		console.log(req.url);
		next();
	});

	app.use(app.router);
	app.use(express.static(__dirname, {maxAge: 31557600000}));
	
	var dataProviders = [new citybikes.CityBikes()];
	var svcs = {};
	for (var i=0; i<dataProviders.length; i++) {
		var dataProvider = dataProviders[i];
		svcs[dataProvider.name] = {
			"dataProvider" : dataProvider
		};
	}
	app.set("agsDataProviders", svcs);
	
	console.log('App Configured');
});

// Redirect handlers for badly formed URLs (help users get to grips)
app.all('/', function onRequest(request, response) {
	response.send(200,agsoutput.dataProvidersHTML(app.get("agsDataProviders")));
});

app.all('/:dataProviderName', function onRequest(request, response, next) {
	var dataProvider = getSvcForRequest(request);
	if (dataProvider) {
		response.writeHead(301, {Location: dataProvider.urls.getServicesUrl()});
		response.end();
	}
	else
	{
		next();
	}
});


// Specific handlers
var infoHandler = function onRequest(request, response) {
	console.log("INFO");

	var dataProvider = getSvcForRequest(request);
	
	var output = agsoutput.info(request.agsOutFormat, dataProvider);
	useCallback(request)?response.jsonp(200,output):response.send(200,output);
};

app.get(routerUrls.getInfoUrl(), infoHandler);
app.post(routerUrls.getInfoUrl(), infoHandler);


var servicesHandler = function onRequest(request, response) {
	console.log("SERVICES");

	var dataProvider = getSvcForRequest(request);

	var output = agsoutput.services(request.agsOutFormat, dataProvider);
	useCallback(request)?response.jsonp(200,output):response.send(200,output);
};

app.get(routerUrls.getServicesUrl(), servicesHandler);
app.post(routerUrls.getServicesUrl(), servicesHandler);


var featureServiceHandler = function onRequest(request, response) {
	console.log("FEATURESERVICE");

	var dataProvider = getSvcForRequest(request);
	var serviceId = request.params.serviceId;

	var output = agsoutput.featureService(request.agsOutFormat, dataProvider, serviceId);
	useCallback(request)?response.jsonp(200,output):response.send(200,output);
};

app.get(routerUrls.getServiceUrl(), featureServiceHandler);
app.post(routerUrls.getServiceUrl(), featureServiceHandler);

var featureLayerHandler = function onRequest(request, response) {
	console.log("LAYER");

	var dataProvider = getSvcForRequest(request);
	var serviceId = request.params.serviceId;
	var layerId = request.params.layerId;

	var output = agsoutput.featureServiceLayer(request.agsOutFormat, dataProvider, serviceId, layerId);
	useCallback(request)?response.jsonp(200,output):response.send(200,output);
};

app.get(routerUrls.getLayerUrl(), featureLayerHandler);
app.post(routerUrls.getLayerUrl(), featureLayerHandler);

var layerQueryHandler = function onRequest(request, response) {
	console.log("QUERY");

	var dataProvider = getSvcForRequest(request);
	var serviceId = request.params.serviceId;
	var layerId = request.params.layerId;

	var returnCountOnly = (request.param("returnCountOnly") || "false").bool();
	var returnIdsOnly = (request.param("returnIdsOnly") || "false").bool();
	var outSR = request.param("outSR") || 4326;
	
	var output = agsoutput.featureServiceLayerQuery(request.agsOutFormat,
										dataProvider, serviceId, layerId, 
										null,
										returnCountOnly, returnIdsOnly, outSR, function(output) {
		useCallback(request)?response.jsonp(200,output):response.send(200,output);	
	});
// 	citybikes.getCities(function(cities) {
// 		var city = cities[svcName];
// 		citybikes.getBikes(city, function(bikes) {
// 			var output = ags.queryOutput(svcName, layerId, bikes, format, returnCountOnly, returnIdsOnly, outSR);
// 			useCallback(request)?response.jsonp(200,output):response.send(200,output);
// 		});
// 	});
}

app.get(routerUrls.getLayerQueryUrl(), layerQueryHandler);
app.post(routerUrls.getLayerQueryUrl(), layerQueryHandler);

app.listen(process.env.VCAP_APP_PORT || 1337);
