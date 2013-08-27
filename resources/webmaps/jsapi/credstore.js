var cred = "esri_jsapi_id_manager_data";

function loadCredentials() {
  var idJson, idObject;

  if ( supports_local_storage() ) {
    // read from local storage
    idJson = window.localStorage.getItem(cred);
  } else {
    // read from a cookie
    idJson = dojo.cookie(cred);
  }

  if ( idJson && idJson != "null" && idJson.length > 4) {
    idObject = dojo.fromJson(idJson);
    esri.id.initialize(idObject);
  } else {
    // console.log("didn't find anything to load :(");
  }
}

function storeCredentials() {
  // make sure there are some credentials to persist
  if ( esri.id.credentials.length === 0 ) {
    return;
  }

  // serialize the ID manager state to a string
  var idString = dojo.toJson(esri.id.toJson());
  // store it client side
  if ( supports_local_storage() ) {
    // use local storage
    window.localStorage.setItem(cred, idString);
    // console.log("wrote to local storage");
  } else {
    // use a cookie
    dojo.cookie(cred, idString, { expires: 1 });
    // console.log("wrote a cookie :-/");
  }
}

function supports_local_storage() {
  try {
    return "localStorage" in window && window["localStorage"] !== null;
  } catch( e ) {
    return false;
  }
}