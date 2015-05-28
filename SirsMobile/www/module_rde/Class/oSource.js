/**
 * Created by roch dardie on 11/05/15.
 */

//require('oWmsParams');


    /**
     * @constructor for TMS
     * @param {ol.SourceType, URI }
     *
     */

function oSource(type, uri){
        this.type= type;
        this.url= uri;
    }

    /**
     * @constructor for WMS
     * @param {ol.SourceType, URI, oWmsParams }
     *
     */

    oSource.prototype.WMSconstructor(type, uri, params){
        this.type= type;
        this.url= uri;
        this.params = params;
    }

    /**
     * @constructor for Bing
     * @param {ol.SourceType, URI, BingKey, imagerySet  }
     *
     */

    oSource.prototype.BingConstructor = function(type, uri, key, imagerySet){
        this.type= type;
        this.url= uri;
        this.key = key;
        this.imagerySet = imagerySet;
    }


/**
 * @constructor
 * @param {oSource }
 *
 */

oSource.prototype.patch = function(sourceObject){
    angular.extend(this,sourceObject);
}


