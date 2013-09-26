var util = require('util');

// We will support URLs of the format <serviceBase>/rest/<serviceName>/FeatureServer/0/query
// etc. but the important thing to note is that <serviceBase> is effectively a virtual 
// ArcGIS Server root which maps directly to a data provider module inheriting from dataproviderbase
var serviceBaseUrl = '/%s/rest';
var servicesUrl = serviceBaseUrl + '/services';
var infoUrl = serviceBaseUrl + '/info';
var serviceUrlTemplate = servicesUrl + '/%s/FeatureServer';
var layersUrlTemplate = serviceUrlTemplate + '/layers';
var layerUrlTemplate = serviceUrlTemplate + '/%s';
var queryUrlTemplate = layerUrlTemplate + '/query';

Urls = function(dataProvider) {
    dataProvider = dataProvider || {
        name: ":dataProviderName"
    };
    this.dataProvider = dataProvider;
};

Urls.prototype = {
    getServicesUrl: function() {
        return util.format(servicesUrl, this.dataProvider.name);
    },

    getInfoUrl: function() {
        return util.format(infoUrl, this.dataProvider.name);
    },

    getServiceUrl: function(serviceId) {
        if (arguments.length < 1) serviceId = ":serviceId";
        return util.format(serviceUrlTemplate, this.dataProvider.name, serviceId);
    },

    getLayersUrl: function(serviceId) {
        if (arguments.length < 1) serviceId = ":serviceId";
        return util.format(layersUrlTemplate, this.dataProvider.name, serviceId);
    },

    getLayerUrl: function(serviceId, layerId) {
        if (arguments.length < 2) layerId = ":layerId";
        if (arguments.length < 1) serviceId = ":serviceId";
        return util.format(layerUrlTemplate, this.dataProvider.name, serviceId, layerId);
    },

    getLayerQueryUrl: function(serviceId, layerId) {
        if (arguments.length < 2) layerId = ":layerId";
        if (arguments.length < 1) serviceId = ":serviceId";
        return util.format(queryUrlTemplate, this.dataProvider.name, serviceId, layerId);
    }
}

exports.Urls = Urls;
