node-ags-adaptor
================

This is a [node.js](http://nodejs.org) implementation of part of the [Esri GeoServices REST API](http://resources.arcgis.com/en/help/arcgis-rest-api/).

Enough of the API is implemented to allow simple read-only access by ArcGIS tools, apps, and APIs, including the [ArcGIS Runtime SDKs](https://developers.arcgis.com/en/documentation/) (iOS, Android, Mac OS X, Windows Phone, etc.), the [ArcGIS API for JavaScript](https://developers.arcgis.com/en/javascript/), [esri-leaflet](http://esri.github.io/esri-leaflet/), [ArcGIS Desktop](http://www.esri.com/software/arcgis/arcgis-for-desktop) etc.

View live at http://node-geoservices-adaptor.aws.af.cm

##Introduction
The application handles routing to 1 or more "data providers". A data provider is the equivalent of an ArcGIS Server.
It is the entry point that ArcGIS Desktop or ArcCatalog might be pointed at and is responsible for exposing 
FeatureServices, each of which in turn exposes one or more FeatureLayers.

The sample application included here just has one data provider (for data from http://api.citybik.es).

1. Build your own subclass of `agsdataproviderbase.AgsDataProviderBase` (see [citybike.js](https://github.com/ArcGIS/node-ags-adaptor/blob/master/agsdataproviders/citybikes.js) for a sample). Override only what you need to.
3. Add instances of your subclass to the `dataProviders` array at the top of `index.js`

The REST endpoints have matching HTML endpoints to help explore the services and reach a FeatureLayer endpoint for consumption by the ArcGIS tools and APIs.

##Sample Provider
The sample data provider makes use of the [awesome API](http://api.citybik.es) at [CityBik.es](http://citybik.es) providing bike share data (almost) globally. This sample Data Provider adapts the data into Geoservices format output. The root REST endpoint 
for the CityBikes data provider can be found live here (this is where you might point ArcCatalog): http://node-geoservices-adaptor.aws.af.cm/citybikes/rest/services

##Known Limitations
* Only a limited subset of the [Geoservices REST Specification](http://resources.arcgis.com/en/help/arcgis-rest-api/) is implemented.
* Only spatial references 4326 and 102100 are supported
* Queries only work against the layer end point. Feature Server queries are declared as a capability but not yet implemented.
* HTML Browsing is not available for Query enpoints. Only JSON is currently supported.

##Note
This ReadMe is incomplete. Just a placeholder.
