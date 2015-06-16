/**
 * Created by dardie roch on 03/04/15.
 */
angular.module('module_rde.data.services.dbManager', [])

    .service('sPouch', function sPouch (pouchDB, $log, $rootScope, $timeout, $http,$ionicPopup,$state ) {

        var me = this;

//FIXME require
        //PouchDB.plugin(require('pouchdb-load'));
        //PouchDB.plugin('pouchdb-load');

        /**
         * instanciation de tte les base
         * @type {pouchDB}
         */
        me.localDb =  null;
        me.confDb =  null;

        me.contextDb = new pouchDB('context');



        //objet pour couper la syncro
        me.syncInstanceColector = {};
        //me.dbs = {list:[]};
        me.dbs = [];

        me.syncState = {actual:0.0, total:0.0, ratio:0.0 ,  clonning:false, runNextSync:false}



        //instancie une syncro bi-directionelle avec support de l'interuption, et propagation des evenement change
            //les evenements sont nome comme la base
        me.initiateSync = function (oUrlCdb, UpToDateCallBack) {
            var onlyOnce = true;

            $log.info("RUN_db_SYNC");
            me.syncInstanceColector[oUrlCdb.db] = PouchDB.sync("" + oUrlCdb.db, oUrlCdb.getUrlString(), {
                live: true,
                retry: true
            }).on('change', function (info) {
                // handle change
                $log.info(oUrlCdb.db +'_Sync_'+ '_change');
                $log.debug(info);
                if (info.direction == "pull") {
                    $rootScope.$broadcast(oUrlCdb.db + "_change"); //FIXME  ne pas declacher l'event lorsque la modification vien du local.
                }
            }).on('paused', function () {
                // replication paused (e.g. user went offline)
                $log.info(oUrlCdb.db +'_Sync_'+ '_paused');
            }).on('active', function () {
                // replicate resumed (e.g. user went back online)
                $log.info(oUrlCdb.db + '_Sync_'+'_active');
            }).on('denied', function (info) {
                // a document failed to replicate, e.g. due to permissions
                $log.error(oUrlCdb.db +'_Sync_'+ '_denied');
                $log.error(info);
            }).on('complete', function (info) {
                // handle complete
                $log.info(oUrlCdb.db +'_Sync_'+ '_complete');
                $log.info(info);
            }).on('error', function (err) {
                // handle error
                $log.error(oUrlCdb.db +'_Sync_'+ '_error');
                $log.error(err);
            }).on('uptodate', function (err) {
                $log.error(oUrlCdb.db +'_Sync_'+ '_uptodate');

    $log.error("onlyOnce : "+onlyOnce)
    $log.error("UpToDateCallBack : "+UpToDateCallBack)


                if(UpToDateCallBack != null && onlyOnce==true){ //only once time
                    //FIXME cas ou le get renvoie une erreur, gerrer l'auto reload
                    onlyOnce = false;
                    UpToDateCallBack();
                }
            });
        };

    //FIXME nom de base peut il etre distinct (local - remote?)
        me.instantiateRep = function(RemoteDbDesc,LocalDbName,syncMe){
            $log.info("RUN_db_REP");
            me.syncState.clonning=true;

            //var RemoteDb = new PouchDB(oUrlCdb.getUrlString());
            //me.localDb.replicate.from
            PouchDB.replicate( RemoteDbDesc.getUrlString(), LocalDbName, {
                live: false,
                retry: true
            }).on('change', function (info) {
                $log.info(RemoteDbDesc.db +'_Repliation_'+ '_paused');
            }).on('paused', function () {
                // replication paused (e.g. user went offline)
                $log.info(RemoteDbDesc.db +'_Repliation_'+ '_paused');
            }).on('active', function () {
                // replicate resumed (e.g. user went back online)
                $log.info(RemoteDbDesc.db +'_Repliation_'+ '_active');
            }).on('denied', function (info) {
                // a document failed to replicate, e.g. due to permissions
                $log.error(RemoteDbDesc.db +'_Repliation_'+ '_denied');
                $log.error(info);
            }).on('complete', function (info) {
                // handle complete
                $log.info(RemoteDbDesc.db + '_Repliation_'+'_complete');
                $log.info(info);

                me.syncState.clonning = false

                if(syncMe === true) me.syncLocalDb(RemoteDbDesc);



            }).on('error', function (err) {
                // handle error
                $log.error(RemoteDbDesc.db + '_Repliation_'+'_error');
                $log.error(error);

                me.syncState.clonning = false
            });


            me._recursiveRegularGetState();



        }



        me._recursiveRegularGetState =  function(){
           $log.debug("RUN__recursiveRegularGetState")
           $log.debug("RUN__recursiveRegularGetState")


            me.localDb.info().then( function(result){
                $log.debug("RUN__info")
                $log.debug( result)
                $log.debug(me.syncState.clonning)
                $log.debug(me.syncState.actual)
                $log.debug(result.doc_count);

                if ((result.doc_count / me.syncState.ratio) != NaN ){
                    me.syncState.actual = (result.doc_count / me.syncState.ratio).toFixed(2);
                }

                if(me.syncState.clonning == true){
                    $timeout( me._recursiveRegularGetState,500);

                }


            });


       }

        //TODO need reduce
        me.syncLocalDb = function(oUrlCdb){
            //me.syncState.runNextSync =true; //permet l'execution du callback unique apres le

            me.localDb = new pouchDB(oUrlCdb.db);
            me.initiateSync(oUrlCdb,  me.roadRunner);
            $log.debug("instance de base");
            $log.debug(me.syncInstanceColector);


        };
        me.roadRunner = function(){
            $log.debug('GOTO SIGN IN')
            $state.go('signin')
        };


        me.syncConfDb = function(oUrlCdb){
            //accept refresh
            //me.syncState.runNextSync= true;


            me.confDb = new pouchDB(oUrlCdb.db);
            me.initiateSync(oUrlCdb,me.getDbs);
            $log.debug("instance de base");
            $log.debug(me.syncInstanceColector);


            //ecriture du secripteur de base dans le contexte
            me.contextDb.put({
                _id: 'confdb',
                db: oUrlCdb
            }).then(function (response) {
                // handle response
            }).catch(function (err) {
                console.log(err);
            });


        };

        me.getDbs = function(){

            $log.debug("RUN_GetDbs");
            //me.confDb.query('databases/available/dbs').then(function (res) {
            //
            //    $log.debug(res);
            //    $log.debug(res.rows[0].value);
            //    //me.dbs.list.concat(me.dbs,res.rows[0].value )
            //    me.dbs.list = res.rows[0].value;
            //}).catch(function (err) {
            //    //$log.debug(err);
            //});

            me.confDb.get('dbsList').then(function (res) {

                $log.debug(res);
                //$log.debug(res.rows[0].value);
                //me.dbs.list.concat(me.dbs,res.rows[0].value )
                //me.dbs.list = res.dbs;
                me.dbs = res.dbs;
            }).catch(function (err) {
                //$log.debug(err);
            });


        }


        me.dbInit = function(oUrlCdb){

            $log.error(oUrlCdb);

            $http.get(oUrlCdb.getUrlString()).
                success(function(data, status, headers, config) {
                    $log.debug("gettotal")
                    $log.debug(data);
                    me.syncState.total = data.doc_count;
                    me.syncState.ratio = data.doc_count / 100;
                }).
                error(function(data, status, headers, config) {});

            //
            me.localDb = new pouchDB(oUrlCdb.db);
            me.instantiateRep( oUrlCdb,oUrlCdb.db,true  );


            //ecriture du secripteur de base dans le contexte
          me.contextDb.put({
                    _id: 'activedb',
                    db: oUrlCdb
            }).then(function (response) {
                // handle response
            }).catch(function (err) {
                console.log(err);
            });

            //FIXME debug pares resolution de require
            //me.syncState.clonning=true;
            //me.localDb.load( RemoteDbDesc.getUrlString()+'/_all_docs?include_docs=true').then(function () {
            //    me.syncState.clonning = false
            //    if(syncMe === true) me.syncLocalDb(RemoteDbDesc);
            //}).catch(function (err) {
            //    me.syncState.clonning = false
            //});
            //
            //me._recursiveRegularGetState();


        };

        me.destroyDb = function(oUrlCdb){
            $log.debug("RUN__clear")

            me.localDb = new pouchDB(oUrlCdb.db);
            me.localDb.destroy().then(function () {
                $log.debug("db_clear")



                    $ionicPopup.alert({
                        title: 'Base de donnée effacée ',
                        template: 'source'+oUrlCdb.db
                    });




            }).catch(function (error) {
                console.log(error);
            });

        };





        //Skip init view if context exist
        //TODO ajouter gestion de base dans l'applis

        //run sync on config db
        me.contextDb.get('confdb').then(function (response) {
            //fixme pk une var temporaire obligatoire??
            var dbDesc = new oUrlCouchDb();
            dbDesc.patch(response.db);

            me.syncConfDb(dbDesc);
        })

        //run sync on sirs target db
        me.contextDb.get('activedb').then(function (response) {
            var dbDesc = new oUrlCouchDb();
            dbDesc.patch(response.db);

            me.syncLocalDb(dbDesc); //==> declenche le roadRunner
        })



    })

