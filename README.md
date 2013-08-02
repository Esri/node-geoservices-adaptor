node-ags-adaptor
================

A node.js "ArcGIS Server" to provide an AGS bridge to generic data sources

Sample source for http://api.citybik.es is provided.

This node.js project handles a subset of ArcGIS Server requests to describe services and return query results.

View live at http://node-ags-adaptor.aws.af.cm

##Introduction
The application handles routing to 1 or more "data providers". A data provider is the equivalent of an ArcGIS Server.
It is the entry point that ArcGIS Desktop or ArcCatalog might be pointed at and is responsible for exposing 
FeatureServices, each of which in turn exposes one or more FeatureLayers.

The sample application included here just has one data provider (for data from http://api.citybik.es).

1. Build your own subclass of `agsdataproviderbase.AgsDataProviderBase` (see [citybike.js](https://github.com/ArcGIS/node-ags-adaptor/blob/master/agsdataproviders/citybikes.js) for a sample). Override only what you need to.
3. Add instances of your subclass to the `dataProviders` array at the top of `index.js`

The REST endpoints have matching HTML endpoints to help explore the services and reach a FeatureLayer endpoint for consumption by the ArcGIS tools and APIs.

##CityBikes
Thanks to the awesome guys at [CityBik.es](http://citybik.es) we have a data source for bike share availability 
(almost) globally. The sample Data Provider adapts this data into Geoservices format output. The root REST endpoint 
for the CityBikes data provider can be found live here (this is where you might point ArcCatalog): http://node-ags-adaptor.aws.af.cm/citybikes/rest/services

##Known Limitations
* Only spatial references 4326 and 102100 are supported
* Queries only work against the layer end point. Feature Server queries are declared as a capability but not yet implemented.
* HTML Browsing is not available for Query enpoints. Only JSON is currently supported.

##Note
This ReadMe is incomplete. Just a placeholder.
