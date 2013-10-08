String.prototype.bool = function() {
    return (/^true$/i).test(this);
};

function MergeRecursiveCopy(obj1, obj2) {
  var r = {};
  for (var i=0; i<arguments.length; i++) {
    r = MergeRecursive(r, arguments[i]);
  }
  return r;
}

function MergeRecursive(obj1, obj2) {
    // http://stackoverflow.com/a/383245
    for (var p in obj2) {
        try {
            // Property in destination object set; update its value.
            if (obj2[p].constructor == Object) {
                obj1[p] = MergeRecursive(obj1[p], obj2[p]);

            } else {
                obj1[p] = obj2[p];

            }

        } catch (e) {
            // Property in destination object not set; create it and set its value.
            obj1[p] = obj2[p];

        }
    }

    return obj1;
}

Query = function(request) {
  // See http://resources.arcgis.com/en/help/arcgis-rest-api/#/Query_Feature_Service_Layer/02r3000000r1000000/
  this.where = request.param("where");
  var _objectIds = request.param("objectIds");
  if (_objectIds) {
    _objectIds = JSON.parse("[" + _objectIds + "]");
  }
  this.objectIds = _objectIds;
  
  function parseSR(sr) {
    if (sr) {
      var tempSR = parseInt(sr);
      if(isNaN(tempSR))
      {
        sr = JSON.parse(sr);
        sr = sr.hasOwnProperty("latestWkid")?sr.latestWkid:sr.wkid;
      } else {
        sr = tempSR;
      }
    }
    return sr;
  }

  this.inSR = parseSR(request.param("inSR"));
  this.outSR = parseSR(request.param("outSR")) || 4326;

  this.geometry = request.param("geometry"); // Not used
  this.geometryType = request.param("geometryType"); // Not used

  if (this.geometry) {
    // The geometry could be a json geometry, or it could be an
    // array of coordinates for an envelope (or a point).
    try {
      this.geometry = JSON.parse(this.geometry);
    } catch (ex) {
      debugger;
      var coordArray = this.geometry.split(",").map(function(item) {
        return parseFloat(item);
      });
      if (this.geometryType === "esriGeometryEnvelope" && coordArray.length == 4) {
        this.geometry = {
          xmin: coordArray[0],
          ymin: coordArray[1],
          xmax: coordArray[2],
          ymax: coordArray[3],
          spatialReference: { wkid: this.inSR }
        };
      } else if (this.geometryType === "esriGeometryPoint" && coordArray.length == 2) {
        this.geometry = {
          x: coordArray[0],
          y: coordArray[1],
          spatialReference: { wkid: this.inSR }
        };
      } else {
        console.log(ex);
        console.log("Unexpected geometry type for simple geometry: " + this.geometryType);
        console.log(this.geometry);
        throw ex;
      }
    }
  }

  this.spatialRel = request.param("spatialRel"); // Not used
  this.relationParam = request.param("relationParam"); // Not used
  this.time = request.param("time"); // Not used
  
  var _outFields = (request.param("outFields") || "*");
  if (_outFields !== "*") {
    _outFields = _outFields.split(",");
  }
  this.outFields = _outFields; // Not used
  
  this.returnGeometry = (request.param("returnGeometry") || "false").bool(); // Not used
  this.returnIdsOnly = (request.param("returnIdsOnly") || "false").bool();
  this.returnCountOnly = (request.param("returnCountOnly") || "false").bool();
  
  this.rawParams = MergeRecursiveCopy(request.params, request.query, request.body);

  this.format = (request.param("f") || "json").toLowerCase();
  this.generatedFormat = "json";
  
  // The following FeatureService Layer Query Parameters properties are currently ignored:
  // maxAllowableOffset
  // geometryPrecision
  // gdbVersion
  // returnDistinctValues
  // orderByFields
  // groupByFieldsForStatistics
  // outStatistics
  // returnZ
  // returnM
};

exports.Query = Query;
