String.prototype.bool = function() {
    return (/^true$/i).test(this);
};

Query = function(request) {
	// See http://resources.arcgis.com/en/help/arcgis-rest-api/#/Query_Feature_Service_Layer/02r3000000r1000000/
	this.where = request.param("where");
	var _objectIds = request.param("objectIds");
	if (_objectIds) {
		_objectIds = JSON.parse("[" + _objectIds + "]");
	}
	this.objectIds = _objectIds;
	this.geometry = request.param("geometry"); // Not used
	this.geometryType = request.param("geometryType"); // Not used

	var _inSR = request.param("inSR");
	if (_inSR) { _inSR = parseInt(_inSR); }
	this.inSR = _inSR; // Not used

	this.spatialRel = request.param("spatialRel"); // Not used
	this.relationParam = request.param("relationParam"); // Not used
	this.time = request.param("time"); // Not used
	
	var _outFields = (request.param("outFields") || "*");
	if (_outFields !== "*") {
		_outFields = JSON.parse("[" + _outFields + "]");
	}
	this.outFields = _outFields; // Not used
	
	this.returnGeometry = (request.param("returnGeometry") || "false").bool(); // Not used
	this.returnIdsOnly = (request.param("returnIdsOnly") || "false").bool();
	this.returnCountOnly = (request.param("returnCountOnly") || "false").bool();
	
	var _outSR = request.param("outSR");
	if (_outSR) { _outSR = parseInt(_outSR); }	
	this.outSR = _outSR;
	
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
