node-ags-adaptor
================

This is a [node.js](http://nodejs.org) implementation of part of the [Esri GeoServices REST API](http://resources.arcgis.com/en/help/arcgis-rest-api/).

Enough of the API is implemented to allow simple read-only access by ArcGIS tools, apps, and APIs, including [ArcGIS Runtime SDKs](https://developers.arcgis.com/en/documentation/) (iOS, Android, Mac OS X, Windows Phone, etc.), [ArcGIS API for JavaScript](https://developers.arcgis.com/en/javascript/), [esri-leaflet](http://esri.github.io/esri-leaflet/), [ArcGIS Desktop](http://www.esri.com/software/arcgis/arcgis-for-desktop) etc.

View live at http://node-geoservices-adaptor.aws.af.cm (hosted at [AppFog](http://appfog.com))

##Introduction
The application handles routing to 1 or more "data providers". A data provider is the equivalent of an ArcGIS Server.
It is the entry point that ArcGIS Desktop or ArcCatalog might be pointed at and is responsible for exposing 
FeatureServices, each of which in turn exposes one or more FeatureLayers.

The sample application included here just has one data provider (for data from http://api.citybik.es).

1. Build your own subclass of `agsdataproviderbase.AgsDataProviderBase` (see [citybike.js](https://github.com/ArcGIS/node-ags-adaptor/blob/master/agsdataproviders/citybikes.js) for a sample). Override only what you need to.
2. Add instances of your subclass to the `dataProviders` array at the top of `index.js`

The REST endpoints have matching HTML endpoints to help explore the services and reach a FeatureLayer endpoint for consumption by the ArcGIS tools and APIs.

##Sample Data Provider
The sample data provider makes use of the [awesome API](http://api.citybik.es) at [CityBik.es](http://citybik.es) providing bike share data (almost) globally. This sample Data Provider adapts the data into Geoservices format output. The root REST endpoint 
for the CityBikes data provider can be found live here (this is where you might point ArcCatalog): http://node-geoservices-adaptor.aws.af.cm/citybikes/rest/services

##Installation
1. Clone the repo and run `npm update` in the repo folder
2. Run the node server with `node index`
3. Browse to [http://localhost:1337](http://localhost:1337)

##Known Limitations
* Only a limited subset of the [Geoservices REST Specification](http://resources.arcgis.com/en/help/arcgis-rest-api/) is implemented.
	* [`Server Info`](http://resources.arcgis.com/en/help/arcgis-rest-api/#/Server_Info/02r300000116000000/)
	* [`Catalog`](http://resources.arcgis.com/en/help/arcgis-rest-api/#/Catalog/02r3000000tn000000/)
	* [`Feature Service`](http://resources.arcgis.com/en/help/arcgis-rest-api/#/Feature_Service/02r3000000z2000000/)
	* `Layers (Feature Service)`
	* [`Layer (Feature Service)`](http://resources.arcgis.com/en/help/arcgis-rest-api/#/Layer/02r3000000w6000000/)
	* [`Query (Feature Service\Layer)`](http://resources.arcgis.com/en/help/arcgis-rest-api/#/Query_Feature_Service_Layer/02r3000000r1000000/)
* Only spatial references 4326 and 102100 are supported
* Queries only work against the layer end point. `Query (Feature Service)` is declared as a capability but not yet implemented.
* HTML Browsing is not available for Query endpoints. All queries return JSON.
* Only a subset of [`Query (Feature Service\Layer)`](http://resources.arcgis.com/en/help/arcgis-rest-api/#/Query_Feature_Service_Layer/02r3000000r1000000/) is implemented:
	* `objectIds`
	* `outSR` (4326 and 102100 only)
	* `returnIdsOnly`
	* `returnCountOnly`

## Requirements

* [node.js](http://nodejs.org)

## Resources

* [Geoservices REST Specification](http://resources.arcgis.com/en/help/arcgis-rest-api/)
* [node.js documentation](http://nodejs.org/api/)
* [express.js documentation](http://expressjs.com/api.html)
* [CityBikes API](http://api.citybik.es)
* [AppFog](http://appfog.com)

## Issues

Find a bug or want to request a new feature?  Please let us know by submitting an Issue.

## Contributing

Anyone and everyone is welcome to contribute. 

## Licensing
Copyright 2013 Esri

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

A copy of the license is available in the repository's [license.txt](https://github.com/ArcGIS/node-geoservices-adaptor/blob/master/license.txt) file.
[](Esri Tags: NodeJS ExpressJS GeoServices REST CityBikes)
[](Esri Language: JavaScript)
