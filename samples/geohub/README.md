geohub Data Provider Sample
===========================

This is a sample Data Provider to be used with the node-geoservices-adaptor project.

It provides access to geoJSON files stored in GitHub either by providing a *username*, *repo name*, and *file path* or by specifying a *gist ID*.

###geoJSON from a repository
To access a geoJSON file from a GitHub repository, use the following REST URL structure:

`/geohub/rest/services/repo+<GitHub Username>+<Repo Name>+<File Name>/FeatureServer/0`

Where:

* `<GitHub Username>` is a GitHub username.
* `<Repo Name>` is the name of a repo owned by the specified GitHub User.
* `<File Name>` is the name (without the `.geojson` extension) of a geoJSON file within the specified repo.

In the case where the geoJSON includes multiple Geometry Types and the first geometry in the geoJSON file is not the type you want to provide, add the optional `<GeometryType>` specifier like this:

`/geohub/rest/services/repo+<GitHub Username>+<Repo Name>+<File Name>+<GeometryType>/FeatureServer/0`

Where `<GeometryType>` is a valid geoJSON Geometry Type as specified by the [geoJSON Specification](http://www.geojson.org/geojson-spec.html).

**Please note:**

* As per the specification, Geometry Types are case-sensitive.
* `GeometryCollection` is not supported.

Below are some sample URLs that you can add directly to an ArcGIS Online map or consume with one of the ArcGIS APIs.

* Access `forks.geojson` in chelm's grunt-geo repo, filtering by the first geoJSON geometry type encountered in the file: http://geonode.geeknixta.com/geohub/rest/services/repo+chelm+grunt-geo+forks/FeatureServer/0
* Access `forks.geojson` in chelm's grunt-geo repo, filtering by geometry type `LineString`: http://geonode.geeknixta.com/geohub/rest/services/repo+chelm+grunt-geo+forks+LineString/FeatureServer/0
* Access `samples/bower.geojson` in chelm's grunt-geo repo, filtering by geometry type `LineString`: http://geonode.geeknixta.com/geohub/rest/services/repo+chelm+grunt-geo+samples%2Fbower+LineString/FeatureServer/0

###geoJSON from a Gist

To access a geoJSON file from a GitHub Gist, use teh following REST URL structure:

`/geohub/rest/services/gist+<GistId>/FeatureServer/<FileIndex>`

Where:

* `<GistId>` is the ID of the gist, which is included in the Gist's URL
* `<FileIndex>` is a zero-based reference to a geoJSON file in the Gist. Note that non-geoJSON files are ignored. That is, if there are 5 files in the gist, but only 2 geoJSON files, valid values for `<FileIndex>` are 0 and 1.

In the case where the geoJSON includes multiple Geometry Types and the first geometry in the geoJSON file is not the type you want to provide, add the optional <geoJSON Geomsetry Type> component like this:

`/geohub/rest/services/gist+<GistId>+<GeometryType>/FeatureServer/<FileIndex>`

Where `<GeometryType>` is a valid geoJSON Geometry Type as specified by the geoJSON Specification Document.

**Please note:**

* As per the specification, Geometry Types are case-sensitive.
* `GeometryCollection` is not supported.

Below are some sample URLs that you can add directly to an ArcGIS Online map or consume with one of the ArcGIS APIs:

* Access the first geoJSON file in gist `6178185`: http://geonode.geeknixta.com/geohub/rest/services/gist+6178185/FeatureServer/0
* Access the second geoJSON file in gist `6178185`: http://geonode.geeknixta.com/geohub/rest/services/gist+6178185/FeatureServer/1
* Access the second geoJSON file in gist `6178185` and view only `Point` geometries: http://geonode.geeknixta.com/geohub/rest/services/gist+6178185+Point/FeatureServer/1

###References
This adaptor makes use of [GeoHub](https://github.com/chelm/geohub).