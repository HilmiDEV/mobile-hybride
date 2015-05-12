/**
 * Created by roch Dardie on 03/04/15.
 *
 *
 */
angular.module('data.services.pipe', [])

    .service('sContext', function (sPouch, pouchDB, $rootScope, $log) {
        var rscptt = $rootScope.$new();


        this.param = {action: null, mskUUID: null}
        this.auth = {user: null}


        this.saveUser = function () {
            $log.debug("reception event UptateUser")
            sPouch.usr.put(this.auth.user)
                .then(function (response) {
                    //propagation pour remise a jour de l'user
                    $rootScope.$broadcast("userChange"); //TODO faire des type d'event specifique pour les notification de contexte

                }).catch(function (err) {
                    $log.debug(err);
                });
        }


        ////mise a jour de l'utilisateur via un event.'
        //rscptt.$on("updateUser",  function() {
        //    $log.debug("reception event UptateUser")
        //    sPouch.usr.put(this.auth.user)
        //        .then(function (response) {
        //            //propagation pour remise a jour de l'user
        //            $rootScope.$broadcast("userChange"); //TODO faire des type d'event specifique pour les notification de contexte
        //
        //        }).catch(function (err) {
        //            $log.debug(err);
        //        });
        //
        //});
    })
    .service('sLayer', function (sPouch, $log, $rootScope) {
        //carcan
        var me = this;

        //attribut
        me.list = null;
        me._layersStateList = null;
        var rscp = $rootScope.$new(); //FIXME le $on est focement dans un scope? pk route scope de la catch pas?


        /**
         *  FIXME les calque sorte direct de la db, du coup les variable de contexte ne doivent plus etre porter par ces objet
         *  TODO créer un json UUID - Layer Context Value
         *
         */


        me.updateLayer = function(layers){



            //pour chaque calque de la db
            for(var i = 0; i < layers.length; i++) {

                var tmpState =  {idf:layers[i].idf,active:false};

                //on verifie si il existe dans la liste de reference locale
               if(me.list !== null) {
                   for (var j = 0; j < me.list.length; j++) {

                       //si oui on affecte la valeur.
                       if (me.list[j].idf === layers[i].idf) {
                           layers[i].active = me.list[j].active;
                       }
                   }
               }
            }


            me.list = layers;
        };


            //methode de mise a jour de l'objet layers
        me.update = function () {
            $log.debug("update")
            sPouch.layer.get(cLayerBase).then(function (doc) {
                $log.debug("slayer init");
                $log.debug(doc);

                me.updateLayer( doc.layers);
                $log.debug(me.list);
                $log.debug("slayer end");
                $rootScope.$broadcast("layersListUpdated");
            }).catch(function (err) {
                $log.debug(err);
            });

        }

        //recepteur d'evenement
        //
        rscp.$on("moskito_layer_change", function () {
            $log.debug("event recus");
            me.update();
        });


        document.addEventListener("updateListCache", function(aCaDe){
            $log.debug("eventListCache recus");
            $log.debug(aCaDe);

            aCaDe.forEach(function(item){
                    var tLayer = {
                        idf: item.idf,
                        active: false,
                        name: item.nom,
                        isCache: true,
                        opacity: 0.6,
                        source: {
                            "type": "OSM",
                            "url": "file:///storage/emulated/0/Android/data/com.ionic.Map03/files/Tile/cstl-demo/essaiWMS/{z}/{x}/{y}.png"
                        }

                    }

                }

            )

        }


        //initialisation
        me.update();
        CacheMapPlugin.CaDeListReQuest();





    })


    .service('sMask', function (sPouch, $log, $rootScope, sContext) {
        //carcan
        var me = this;

        //attribut
        //me.GeoJson = null;
        me.doc = null;
        me.currentObs = [];
        me.obsUUID = '';
        me.form = null;
        var rscpMsk = $rootScope.$new(); //FIXME le $on est focement dans un scope? pk route scope de la catch pas?


        /**
         *  FIXME les calque sorte direct de la db, du coup les variable de contexte ne doivent plus etre porter par ces objet
         *  TODO créer un json UUID - Layer Context Value
         *
         */



            //methode de mise a jour de l'objet layers
        me.update = function () {
            $log.debug("update")
            $log.debug(sContext.param.mskUUID)
            sPouch.layer.get(sContext.param.mskUUID).then(function (doc) {
                $log.debug("reloadMsk");
                $log.debug(doc);

                //me.GeoJson = doc.GeoJson;
                me.doc = doc;
                me.currentObs = [];
                $log.debug(me.doc);
                $rootScope.$broadcast("maskGeoJsonUpdate");
            }).catch(function (err) {
                $log.debug(err);
            });
        }

        me.getObs = function (featurePos, ObsUUID) {
            sPouch.obs.get(ObsUUID).then(function (doc) {
                    me.currentObs.push({
                        'featurePos': featurePos,
                        'doc': doc
                    });
                }).catch(function (err) {
                    $log.debug(err);

                });
            };


        me.writeObsOnDB = function (obs) {
            $log.debug("=============ECRITURE OBS ==============")
            sPouch.obs.post({
                    'obs': obs
                }).then(function (response) {
                $log.debug("=============result ECRITURE OBS ==============")
                    me.obsUUID = response.id;
                    $rootScope.$broadcast("ObsCreated");
                }).catch(function (err) {
                $log.debug("============= errorECRITURE OBS ==============")
                    $log.error(err);
                });
            };



        me.writeDocOnDb = function () {
            sPouch.layer.put(me.doc)
                .then(function (response) {
                    // handle response
                    //propagation pour remise a jour du layer
                    $rootScope.$broadcast("msk_change"); //TODO faire des type d'event specifique pour les notification de contexte

                }).catch(function (err) {
                    $log.debug(err);
                });

        };


        me.searchFormByLayerUUID = function (layerUUID) {
            $log.debug('searchFormByLayerUUID: _' + layerUUID+"_");


            sPouch.layer.get(""+layerUUID).then(function (layer) {
                var formUUID = layer.formUUID;
                $log.debug('formUUID: '+layer.formUUID)
                sPouch.form.get(""+formUUID).then(function (formDoc) {
                        me.form = formDoc;
                    $log.debug(formDoc);
                        $rootScope.$broadcast("formUpdate");
                    }).catch(function (err) {
                        $log.debug(err);
                    });
            }).catch(function (err) {
                $log.debug(err);
            });



        };

        //me.searchFormByLayerUUID = function (formUUID) {
        //    $log.debug('FORM UUID: _' + formUUID+"_");
        //
        //    sPouch.form.get(""+formUUID).then(function (formDoc) {
        //        me.form = formDoc;
        //        $rootScope.$broadcast("formUpdate");
        //        $log.debug(formDoc);
        //    }).catch(function (err) {
        //        $log.debug(err);
        //    });
        //
        //};


        //recepteur d'evenement
        rscpMsk.$on("moskito_layer_change", function () {
            $log.debug("event recus");
            me.update();
        });

        //rscpMsk.$on("moskito_layer_change", function () {
        //    $log.debug("event recus");
        //    me.updateObs();
        //});

        rscpMsk.$on("msk_change", function () {
            $log.debug("event recus");
            me.update();
        });


        //initialisation
        //me.update();

    })
