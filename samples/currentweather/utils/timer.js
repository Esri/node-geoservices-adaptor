/**
 * Timer that runs in a node child process.
 * Can be used to control multiple things in the main application.
 * @type {*}
 */

var timers = require("timers");

var ___backgroundTimer;

/**
 * @param msg Object
 */
process.on('message',function(msg){

    if(msg.start == true){

        var count = 0;

        ___backgroundTimer = timers.setInterval(function(){
            try{
                var date = new Date();
                console.log("timer.js: datetime tick: " + date.toUTCString());
                process.send("tick");
            }
            catch(err){
                count++;
                if(count == 3){
                    console.log("timer.js: shutdown timer...too many errors. " + err.message);
                    clearInterval(___backgroundTimer);
                    process.disconnect();
                }
                else{
                    console.log("timer.js: " + err.message + "\n" + err.stack);
                }
            }
        },msg.interval);
    }
})

//process.on('exit',function(){
//    console.log("Shutting down timer.js");
//    clearInterval(___backgroundTimer);
//    process.disconnect();
//})

process.on('uncaughtException',function(err){
    console.log("timer.js: " + err.message + "\n" + err.stack + "\n Stopping background timer");
    clearInterval(___backgroundTimer);
})