var dataproviderbase = require("../../src/dataproviderbase");
var TerraformerArcGIS = require("terraformer/Parsers/ArcGIS");
var Terraformer = require("terraformer");
var childProcess = require("child_process");
var parseString = require("xml2js").parseString;
var util = require("util");
var path = require("path");
var fs = require("fs");

CurrentWx = function(){
    CurrentWx.super_.call(this);

    this._fieldCacheFilename = path.join(path.dirname(module.filename),"data","fields.json");
    this._wxProviderFilename = path.join(path.dirname(module.filename),"data","allstations.xml");
    this._fieldInfos = null;
    this._wxProvidersInfos = null;
    this._wxStations = [];
    this._wxStationsArr = [];
    this._rawStationsXML = null;
    this._wxDataRaw = null;
    this._child = null; //fork of childProcess
    this._retrieveChild = null;

    /**
     * Local ENUMs (Constants)
     * @type {Object}
     * @returns {*}
     */
    this._localEnum = function(){
        var values = {
            BACKGROUND_TIME_TICK: 30 * 60 * 1000   /* Use shorter interval for testing. E.g. 5 * 1000 */
        }

        return values;
    };

    this._parseStationsXML = function(data,type,callback){
        parseString(data,function(err, result){
            if(err)console.log("_parseStationsXML error: " + err);
            var json = JSON.stringify(result);

            if(type == 'string'){
                callback(json,err);
            }
            else{
                callback(result,err);
            }
        })
    }

    /**
     * Executed upon a Query request from a client application
     * @param query
     * @param data
     * @param callback
     * @returns {Array}
     * @private
     */
    this._loopWxStations = function(/* Query */query, data, callback){
        if(query.geometryType === "esriGeometryEnvelope"){
            var queryGeom= query.geometry;

            var primitive = new Terraformer.Polygon( {
                "type":"Polygon",
                    "coordinates": [
                        [
                            [ queryGeom.xmin, queryGeom.ymax ],
                            [ queryGeom.xmax, queryGeom.ymax ],
                            [ queryGeom.xmax, queryGeom.ymin ],
                            [ queryGeom.xmin, queryGeom.ymin ],
                            [ queryGeom.xmin, queryGeom.ymax ]
                        ]
                    ]
            })

            Terraformer.toGeographic(primitive);
            console.log("PRIMITIVE: " + primitive.coordinates);

            var arrayTemp = [];

            for(var t in data){

                if(data[t] === "undefined" || data[t] === null || typeof data[t] === "undefined"){
                    console.log("_loopWxStations value " + t + " = undefined");
                }
                else{

                    var tempObject =  data[t].current_observation;
                    var point = new Terraformer.Point([tempObject.longitude, tempObject.latitude]);
                    var test = point.within(primitive);

                    var test = true;
                    if(test){
                        var feature = this._createWxStationFeature(tempObject);

                        arrayTemp.push(feature);

                    }
                }
            }
            console.log("Number of stations returned within extent: " + arrayTemp.length);
            return arrayTemp;
        }

        if(typeof query.geometryType === "undefined"){
            var arrayTemp = [];

            for(var t in data){

                if(data[t] === "undefined" || data[t] === null || typeof data[t] === "undefined"){
                    console.log("_loopWxStations value " + t + " = undefined");
                }
                else{

                    var tempObject =  data[t].current_observation;

                    var feature = this._createWxStationFeature(tempObject);

                    arrayTemp.push(feature);

                }
            }
            console.log("Number of stations returned within extent: " + arrayTemp.length);
            return arrayTemp;
        }
        else{
            console.log("_loopWxStations: query does not contain an acceptable geometry type.");
        }
    }

    /**
     * Creates a feature object for each station. This uses a bit of brute force to ensure
     * attribute names are user friendly. Easier way is to simply pass-thru the attributes all at once.
     * @param data
     * @returns {}
     * @private
     */
    this._createWxStationFeature = function(/* Object */ data){

        return feature = {
            geometry: {
                x: typeof data.longitude === "undefined" ? data.longitude : data.longitude[0],
                y: typeof data.latitude === "undefined" ? data.latitude : data.latitude[0],
                spatialReference:{
                    wkid:4326
                }
            },
            attributes:{
                id: typeof data.station_id === "undefined" ? data.station_id : data.station_id[0],
                locationText: typeof data.location === "undefined" ? data.location : data.location[0],
                windDirection: typeof data.wind_dir === "undefined" ? data.wind_dir : data.wind_dir[0],
                latitude: typeof data.latitude === "undefined" ? data.latitude : data.latitude[0],
                longitude: typeof data.longitude === "undefined" ? data.longitude : data.longitude[0],
                pickupTimeMinutes: typeof data.suggested_pickup_period === "undefined" ? data.suggested_pickup_period : data.suggested_pickup_period[0],
                time: typeof data.observation_time_rfc822 === "undefined" ? data.observation_time_rfc822 : data.observation_time_rfc822[0],
                weather: typeof data.weather === "undefined" ? data.weather : data.weather[0],
                tempF: typeof data.temp_f === "undefined" ? data.temp_f : data.temp_f[0],
                tempC: typeof data.temp_c === "undefined" ? data.temp_c : data.temp_c[0],
                relativeHumidity: typeof data.relative_humidity === "undefined" ? data.relative_humidity :  data.relative_humidity[0],
                windDirection: typeof data.wind_dir === "undefined" ? data.wind_dir : data.wind_dir[0],
                windDegrees: typeof data.wind_degrees === "undefined" ? data.wind_degrees : data.wind_degrees[0],
                windMPH: typeof data.wind_mph === "undefined" ? data.wind_mph : data.wind_mph[0],
                windKnots: typeof data.wind_kt === "undefined" ? data.wind_kt : data.wind_kt[0],
                pressureMb: typeof data.pressure_mb === "undefined" ? data.pressure_mb : data.pressure_mb[0],
                pressureIn: typeof data.pressure_in === "undefined" ? data.pressure_in : data.pressure_in[0],
                dewPointF: typeof data.dewpoint_f === "undefined" ? data.dewpoint_f : data.dewpoint_f[0],
                dewPointC: typeof data.dewpoint_c === "undefined" ? data.dewpoint_c : data.dewpoint_c[0],
                heatIndexF: typeof data.heat_index_f === "undefined" ? data.heat_index_f : data.heat_index_f[0],
                heatIndexC: typeof data.heat_index_c === "undefined" ?  data.heat_index_c :  data.heat_index_c[0],
                visibilityMi: typeof data.visibility_mi === "undefined" ? data.visibility_mi : data.visibility_mi[0],
                twoDayHistoryURL: typeof data.two_day_history_url === "undefined" ? data.two_day_history_url : data.two_day_history_url[0]
            }
        };
    }

    this._setRetrieveChildMsgHandler = function(){

        this._retrieveChild.on('message', function(msg){
            console.log("Station data received by parent process.");
            //console.log(msg[0]["current_observation"]['latitude']);
            this._wxDataRaw = msg;
        }.bind(this))

    }

    this._startTimer = function(){

        this._child = childProcess.fork("./samples/currentweather/utils/timer");

        this._child.on('message', function(msg){
            if(msg == "tick"){
                console.log("timer tick event recv'd");
                try{
                    var data = {
                        "content":this._rawStationsXML
                    }

                    this._retrieveChild.send(data);
                }
                catch(err){
                    console.log("_startTimer Error: " + err.message + "\n " + err.stack);
                }

            }
        }.bind(this))

        var interval = this._localEnum().BACKGROUND_TIME_TICK;

        var startParams = {
            "start":true,
            "interval":interval
        }

        this._child.send(startParams);
    }

    /**
     * Initializes the library.
     * IMPORTANT: Make sure this is at the bottom of the CurrentWx so that all functions and variables are inherited
     * @type {}
     */
    this.init = function(){

        this._retrieveChild = childProcess.fork("./samples/currentweather/utils/retriever");

        if (fs.existsSync(this._fieldCacheFilename))
        {
            this._fieldInfos = JSON.parse(fs.readFileSync(this._fieldCacheFilename, 'utf8'));
            console.log("Loaded field info from " + this._fieldCacheFilename);
        }
        else{
            console.log("WARNING: Unable to load field info from fields.json, " + this._fieldCacheFilename);
        }

        if(fs.existsSync(this._wxProviderFilename)){

            var temp = fs.readFileSync(this._wxProviderFilename);

            this._parseStationsXML(temp,null,function(data,err){

                if(err){
                    console.log("Init() Error parsing xml: " + err);
                }
                else{
                    //this._createWxStationsArr(data);
                    this._rawStationsXML = data;
                    this._setRetrieveChildMsgHandler();

                    var data = {
                        "content":this._rawStationsXML
                    }

                    this._retrieveChild.send(data);
                }
            }.bind(this))

            console.log("Loaded weather provider info from " + this._wxProviderFilename);
        }
        else{
            console.log("WARNING: Unable to load weather provider info from allstations.xml, " + this._wxProviderFilename);
        }

        console.log("Initialized Current Weather provider");

        this._startTimer();

    }.bind(this)();

}

// This node.js helper function allows us to inherit from dataproviderbase.
util.inherits(CurrentWx, dataproviderbase.DataProviderBase);

// And now we'll override only what we need to (see also /src/dataproviderbase.js).
Object.defineProperties(CurrentWx.prototype, {
    name: {
        get: function() {
            // Override the service name - every data provider should override this.
            return "currentwx";
        }
    },
    getServiceIds: {
        value: function(callback) {
            // Override the service name - every data provider should override this.
            callback([this.name]);
        }
    },

    fields: {
        value: function(serviceId, layerId) {
            // These are the fields that the single layer of each FeatureService will return.
            // this could be different for each feature service and layer.
            return this._fieldInfos;
        }
    },
    idField: {
        value: function(serviceId, layerId) {
            return "id";
        }
    },
    nameField: {
        value: function(serviceId, layerId) {
            return "locationText";
        }
    },
    fields: {
        value: function(serviceId, layerId) {
            return this._fieldInfos;
        }
    },
    getLayerIds: {
        value: function(serviceId, callback) {
            callback([0], null);
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
//    getLayerName: {
//        value: function(serviceId, layerId) {
//            var c = parseServiceId(serviceId);
//            serviceId = c.serviceId;
//            switch (serviceId) {
//                case "repo":
//                    return "Repo Layer " + layerId;
//                case "gist":
//                    return "Gist " + c.gistId + " File " + layerId;
//            }
//        }
//    },
    getFeatureServiceDetails: {
        value: function(detailsTemplate, serviceId, callback) {

            var provider = this;
            this.getLayerIds(serviceId, function(layerIds, err) {
                callback(layerIds, provider.getLayerNamesForIds(serviceId, layerIds), err);
            });
        }
    },

    getFeatureServiceLayerDetails: {
        value: function(detailsTemplate, serviceId, layerId, callback) {
            // We'll take the default JSON that the engine has calculated for us, but we'll
            // inject an extent if we have one stored so that clients can connect to us
            // more easily.
            callback({
				layerName: this.getLayerName(serviceId, layerId),
				idField: this.idField(serviceId, layerId),
				nameField: this.nameField(serviceId, layerId),
				fields: this.fields(serviceId, layerId)
            }, null);
        }
    },

    featuresForQuery: {
        value: function(serviceId, layerId, query, callback) {
            console.log("Query timestamp via currentwx.js: " + new Date().toUTCString())
            var wxResult = this._loopWxStations(query,this._wxDataRaw);
            var err = "";
            var provider = this;
            var idField = provider.idField(serviceId, layerId);
            var fields = provider.fields(serviceId, layerId);
            callback(wxResult, idField, fields, err);

        }
    }
});


exports.CurrentWx = CurrentWx;
