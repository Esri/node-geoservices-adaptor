var rtree = require("terraformer/RTree"),
	geostore = require("terraformer/GeoStore"),
	memoryStore = require("terraformer/Stores/Memory");

DataProviderCache = function(serviceId, layerId, cacheLifetimeInSeconds) {
	this.cacheLifetime = ((arguments >= 3)?cacheLifetimeInSeconds:60*60) * 1000;
	this.serviceId = serviceId;
	this.layerId = layerId;
    this.cacheId = serviceId + "_" + layerId;

	this.expirationUTC = null;
	this.store = null;
	this._status = null;
	this.resetCache();
    
    this.layerDetails = {};
}

DataProviderCache.prototype = {
	get isExpired() {
    	return new Date().getTime() >= this.expirationUTC;
	},
	get status() {
		return this._status;
	},
	set status(newStatus) {
		var oldStatus = this._status;
		this._status = newStatus;
		if (newStatus === "loaded") {
			this.extendCache();
		}
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
	},
	resetCache: function() {
		this.expirationUTC = new Date();

		this.store = new geostore.GeoStore({
			store: new memoryStore.Memory(),
			index: new rtree.RTree()
		});

		this._status = "waitingToLoad";
	}
}

exports.DataProviderCache = DataProviderCache;
