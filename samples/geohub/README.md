geohub Data Provider Sample
===========================

This is a sample Data Provider to be used with the node-geoservices-adaptor project.

It provides access to geoJSON files stored in GitHub either by providing a username, repo name, and file path or by specifying a gist ID.

It implements a REST Endpoint structure compatible with ArcGIS Online and ArcGIS Server.

###Repos
To access a geoJSON file from a GitHub Repo, use the following REST URL structure:

`/geohub/rest/services/repo+<GitHub Username>+<Repo Name>+<File Name>/FeatureServer/0`

Or, in the case where the geoJSON includes multiple Geometry Types and the first geometry in the geoJSON file is not the type you want to provide, add the optional <geoJSON Geomsetry Type> component like this:

`/geohub/rest/services/repo+<GitHub Username>+<Repo Name>+<File Name>+<GeometryType>/FeatureServer/0`

Where <GeometryType> is a valid geoJSON Geometry Type as specified by the geoJSON Specification Document.

Note that:

* As per the specification, Geometry Types are case-sensitive.
* 

Below are some sample URLs that you can add directly to an ArcGIS Online map or consume with one of the ArcGIS APIs.

* Access `forks.geojson` in chelm's grunt-geo repo, filtering by the first geoJSON geometry type encountered in the file: http://geonode.geeknixta.com/geohub/rest/services/repo+chelm+grunt-geo+forks/FeatureServer/0
* Access `forks.geojson` in chelm's grunt-geo repo, filtering by geometry type `LineString`: http://geonode.geeknixta.com/geohub/rest/services/repo+chelm+grunt-geo+forks+LineString/FeatureServer/0
* Access `samples/bower.geojson` in chelm's grunt-geo repo, filtering by geometry type `LineString`: http://geonode.geeknixta.com/geohub/rest/services/repo+chelm+grunt-geo+samples%2Fbower+LineString/FeatureServer/0
* The first geoJSON file in gist `6178185`: http://geonode.geeknixta.com/geohub/rest/services/gist+6178185/FeatureServer/0
* The second geoJSON file in gist `6178185`: http://geonode.geeknixta.com/geohub/rest/services/gist+6178185/FeatureServer/1

