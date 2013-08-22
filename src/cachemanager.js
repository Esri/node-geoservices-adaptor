CacheEntry = function() {
	this.Expiration = new Date();
	this.ETag = "";
}

CacheManager = function() {
	// A mapping of ETags to cache responses
	this.cacheLookup = {};
	
	this.getEntry = function(url, ifNoneMatch) {
	}
}
