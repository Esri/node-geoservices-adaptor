var parseString = require("xml2js").parseString;
var Event = require("events").EventEmitter;
var async = require("async");
var http = require("http");

http.globalAgent.maxSockets = 1000;

process.on('message',function(msg){

    var event = new Event;

    /**
     * Local ENUMs (Constants)
     * @type {Object}
     * @returns {*}
     */
    this._localEnum = function(){
        var values = {
            HTTP_REQUEST_TIMEOUT:30000
        }

        return values;
    };

    this._wxStationsArr = [];

    /**
     * Executes a GET request on the given xml-based url and returns JSON [Object] or JSON string.
     * Default timeout is 20 seconds. Cannot be overridden.
     * @param url
     * @param type 'string' or 'object'
     * @param callback
     */
    this._getFeed = function(url,type,callback){

        var result = null;
        var timeout = this._localEnum().HTTP_REQUEST_TIMEOUT;

        http.get(url,function(response){
            console.log("GET request: " + url);

            var final = "";

            response.setEncoding('utf8');
            response.setTimeout(timeout,function(err){
                console.log("request timed out");
                callback(null,"Request timed out");
            })
            response.on('error',function(err){
                console.log("_getFeed ERROR " + err);
                callback("ERROR",err);
            })

            response.on('data',function(data){
                //console.log(data);
                final = final + data;
            })

            response.on('end',function(){
                callback(final);
            })

        })
    }

    /**
     * Creates the weather stations array for any station configured in allstations.xml
     * @param data
     * @private
     */
    this._createWxStationsArr = function(data){

        var errorCount = 0;

        for(var i in data){
            var object = data[i];
            var station = object["station"];

            Object.keys(station).forEach(function(key){

                var stationFeatureConstructor = function(callback) {
                    console.log("Station id: " + station[key].station_id);

                    var url = "http://w1.weather.gov/xml/current_obs/" + station[key].station_id + ".xml";
                    this._getFeed(url,null,function(data){
//                        if(err){
//                            errorCount++;
//                            console.log("Problem parsing getFeed() request. Total errors: " + errorCount);
//                        }

                        parseString(data,function(err, result){
                            if(err)console.log("Parsing parseString(): " + err);
                            callback(null,result);
                        })

                        //callback(err,result);
                    })
                }.bind(this)

                this._wxStationsArr.push(stationFeatureConstructor);

            }.bind(this))

        }
    }

    /**
     * Asynchronous background task for loading weather station data
     * Utilizes: https://github.com/caolan/async#parallel
     * @param data An array of functions that include the GET requests
     * @private
     */
    this._async = function(/* Array */ data, token){

        try{

            async.parallel(data,function(err,results){
                console.log("Station data retrieved by child process! COUNT = " + results.length);
                try{
                    var object = {
                        "results":results,
                        "token":token
                    }

                    event.emit("AsyncComplete",object);
                }
                catch(err){
                    console.log("_async process.send() error: " + err.message + "\n" + err.stack);
                }
            }.bind(this._async))
        }
        catch(err){
            console.log("_async error: " + err.message + ", " + err.stack);
        }
    }

    this._postProcessStationsArr = function(/* Array */ arr){
        var newArray = [];

        for(var i in arr){
            for(var t in arr[i]){
                newArray.push(arr[i][t])
            }
        }

        return newArray;

    }

    /**
     * A tokenized asychronous callback handler. Acts as a limiter
     * to throttle the number of async http requests that can be executed
     * at a time.
     * @param arr
     * @private
     */
    this._loopStationsArr = function(/* Array */ arr){

        var previousVal = 0;
        var remaining = 0;
        var length = arr.length;

        var token = 0;
        var segment = null;
        var t = 0;
        var count = 1;

        var totalTokens = this._isEven(arr / 10) ? arr.length / 10 : Math.ceil( arr.length /10);

        var resultsArray = [];
        var result = null;

        event.on("AsyncComplete",function(event){
            //process.send(event.results);
            console.log("async complete " + event.token);

            result = event.results;

            //if(result != null)console.log("RESULT " + result[0]["current_observationcurrent_observation"]["latitude"])

            resultsArray.push(result);

            token = parseInt(event.token);

            //console.log("count= " + count + ", totalTokens= " + totalTokens)

            if(count == totalTokens){
                console.log("total has been reached");
                var newArray = this._postProcessStationsArr(resultsArray);

                process.send(newArray);
            }
        }.bind(this))


        if(length > 0){

            var timer = setInterval(function(){

                console.log("t= " + t + ", token= " + token + ", " + totalTokens)
                if(t == token && count <= totalTokens){
                    count++;

                    if(t <= length)t+=10;
                    remaining = length - t;

                    if(remaining > 10){
                        segment = arr.slice(previousVal,t);
                        console.log("segment length " + segment.length)
                        previousVal = t;
                    }
                    else{
                        segment = arr.slice(previousVal,length);
                    }

                    console.log("remaining = " + remaining);

                    if(segment != null && t != 0)this._async(segment,t);
                    if(remaining <10)clearTimeout(timer);
                }

                console.log("tick");
            }.bind(this),1000);
        }

    }

    this._isEven= function(value){
        if(value%2 == 0)
            return true;
        else
            return false;
    }

    this._init = function(){

        this._createWxStationsArr(msg.content);
        this._loopStationsArr(this._wxStationsArr);
        //this._async(this._wxStationsArr);
    }.bind(this)()

})

process.on('uncaughtException',function(err){
    console.log("retriever.js uncaught exception: " + err.message + "\n" + err.stack);
})