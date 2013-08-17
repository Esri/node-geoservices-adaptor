GitHub geoJSON Data Provider Sample
===================================

This is a sample Data Provider for the [node-geoservices-adaptor](../..).

It provides access to geoJSON files stored in GitHub by providing a wrapper around [GeoHub](https://github.com/chelm/geohub).

##GitHub Repository
To reference a geoJSON file from a GitHub repository, use the following REST URL structure:

	/geohub/rest/services/repo+<GitHub Username>+<Repo Name>+<File Name>/FeatureServer/0

Where:

* `<GitHub Username>` is a GitHub username.
* `<Repo Name>` is the name of a repo owned by the specified GitHub User.
* `<File Name>` is the name (without the `.geojson` extension) of a geoJSON file within the specified repo. It should be URL Encoded. It may include a relative path within the repository.

Below is a sample URL that you can add directly to an ArcGIS Online map or consume with one of the ArcGIS APIs:

* Access `forks.geojson` in chelm's grunt-geo repo: http://geonode.geeknixta.com/geohub/rest/services/repo+chelm+grunt-geo+forks/FeatureServer/0
* Access `samples/bower.geojson` in chelm's grunt-geo repo: http://geonode.geeknixta.com/geohub/rest/services/repo+chelm+grunt-geo+samples%2Fbower/FeatureServer/0

##GitHub Gist

To reference a geoJSON file from a GitHub Gist, use the following REST URL structure:

	/geohub/rest/services/gist+<GistId>/FeatureServer/<FileIndex>

Where:

* `<GistId>` is the ID of the gist, which is included in the Gist's URL
* `<FileIndex>` is a zero-based reference to a geoJSON file in the Gist. Note that non-geoJSON files are ignored. That is, if there are 5 files in the gist, but only 2 geoJSON files, valid values for `<FileIndex>` are 0 and 1.

Below are some sample URLs that you can add directly to an ArcGIS Online map or consume with one of the ArcGIS APIs:

* Access the first geoJSON file in gist `6178185`: http://geonode.geeknixta.com/geohub/rest/services/gist+6178185/FeatureServer/0
* Access the second geoJSON file in gist `6178185`: http://geonode.geeknixta.com/geohub/rest/services/gist+6178185/FeatureServer/1

##Notes
###geoJSON containing multiple geometry types

An ArcGIS Feature Layer can only provide a single type of Esri Geometry. However, geoJSON files may contain any combination of [Geometry Types](http://www.geojson.org/geojson-spec.html#geometry-objects). The GeoHub Data Provider defaults to outputting only geometries matching the type of the first geometry encountered in the geoJSON file. In the case where the geoJSON includes multiple Geometry Types and the first geometry in the geoJSON file is not the type you want to provide, add the optional `+<GeometryType>` specifier like this:

**Repository**:

	/geohub/rest/services/repo+<GitHub Username>+<Repo Name>+<File Name>+<GeometryType>/FeatureServer/0

**Gist**:

	/geohub/rest/services/gist+<GistId>+<GeometryType>/FeatureServer/<FileIndex>

Where `<GeometryType>` is a valid geoJSON Geometry Type as specified by the [geoJSON Specification](http://www.geojson.org/geojson-spec.html).

**Please note:**

* As per the specification, **Geometry Types are case-sensitive**.
* `GeometryCollection` is **not supported**.

Below are some sample URLs that you can add directly to an ArcGIS Online map or consume with one of the ArcGIS APIs:

#####Repository:
* Access `forks.geojson` in chelm's grunt-geo repo, filtering by geometry type `LineString`: http://geonode.geeknixta.com/geohub/rest/services/repo+chelm+grunt-geo+forks+LineString/FeatureServer/0
* Access `samples/bower.geojson` in chelm's grunt-geo repo, filtering by geometry type `LineString`: http://geonode.geeknixta.com/geohub/rest/services/repo+chelm+grunt-geo+samples%2Fbower+LineString/FeatureServer/0

#####Gist:
* Access the second geoJSON file in gist `6178185` and view only `Point` geometries: http://geonode.geeknixta.com/geohub/rest/services/gist+6178185+Point/FeatureServer/1

###GeoHub
This adaptor makes use of [GeoHub](https://github.com/chelm/geohub).