var rtree = require("terraformer/RTree"),
	geostore = require("terraformer/GeoStore"),
	memoryStore = require("terraformer/Stores/Memory");

DataProviderCache = function(serviceId, layerId, cacheLifetimeInSeconds) {
	this.cacheLifetime = ((arguments >= 3)?cacheLifetimeInSeconds:60*60) * 1000;
	this.serviceId = serviceId;
	this.layerId = layerId;
    this.cacheId = serviceId + "_" + layerId;

	this.expirationUTC = new Date();

    this.store = new geostore.GeoStore({
		store: new memoryStore.Memory(),
        index: new rtree.RTree()
    });

    this.extendCache();
    
    this.layerDetails = {};
    
	this.status = "waitingToLoad";
}

DataProviderCache.prototype = {
	get isExpired() {
    	return new Date().getTime() >= this.expirationUTC;
	},
	canExtendCache: function() {
		return true;
	},
	extendCache: function() {
		if (this.canExtendCache()) {
			this.expirationUTC = new Date().getTime() + this.cacheLifetime;
			return true;
		} else {
			return false;
		}
	},
	validateCache: function() {
		if (!this.isExpired) {
			return true;
		} else {
			return this.extendCache();
		}
	}
}

exports.DataProviderCache = DataProviderCache;
