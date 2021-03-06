angular.module('app.services.map', ['app.services.context'])

    .value('currentView', new ol.View({
        zoom: 6,
        center: ol.proj.transform([2.7246, 47.0874], 'EPSG:4326', 'EPSG:3857'),
        enableRotation: false
    }))

    .value('selection', { list: [], active: null })

    .factory('featureCache', function($cacheFactory) {
        return $cacheFactory('featureCache');
    })

    .service('MapManager', function MapManager($rootScope, $q, $ionicPlatform, $ionicSideMenuDelegate, olMap,
                                               BackLayerService, AppLayersService, EditionService, LocalDocument,
                                               DefaultStyle, RealPositionStyle, sContext, GeolocationService,
                                               SidePanelService, featureCache, currentView, selection, SirsDoc) {

        var self = this;


        // OpenLayers objects
        // ----------

        var wktFormat = new ol.format.WKT();

        var wgs84Sphere = new ol.Sphere(6378137);

        var selectInteraction = new ol.interaction.LongClickSelect({
            circleStyle: new ol.style.Style({
                fill: new ol.style.Fill({ color: [255, 255, 255, 0.5] })
            }),
            layers: function isSelectable(olLayer) {
                var model = olLayer.get('model');
                if (angular.isObject(model)) {
                    return model.selectable === true && model.visible === true && appLayers.getVisible(); // app layer
                }
                return (olLayer.get('name') === 'Edition' && editionLayer.getVisible()); // edition layer
            }
        });

        var backLayers = new ol.layer.Group({
            name: 'Background',
            layers: [createBackLayerInstance(BackLayerService.getActive())]
        });

        var appLayers = new ol.layer.Group({
            name: 'Objects',
            visible: !EditionService.isEnabled(),
            layers: AppLayersService.getFavorites().map(createAppLayerInstance)
        });

        var editionLayer = createEditionLayerInstance();

        var geolocLayer = new ol.layer.Vector({
            name: 'Geolocation',
            visible: GeolocationService.isEnabled(),
            source: new ol.source.Vector({ useSpatialIndex: false }),
            style: function(feature) {
                switch(feature.getGeometry().getType()) {
                    case 'Polygon':
                        return [
                            new ol.style.Style({
                                fill: new ol.style.Fill({ color: [255, 255, 255, 0.2] }),
                                stroke: new ol.style.Stroke({ color: [0, 0, 255, 1], width: 1 })
                            })
                        ];
                    case 'Point':
                        return [
                            new ol.style.Style({
                                image: new ol.style.Icon({
                                    anchor: [0.5, 1],
                                    anchorXUnits: 'fraction',
                                    anchorYUnits: 'fraction',
                                    src: 'img/pin-icon.png'
                                })
                            })
                        ];
                    default:
                        return [];
                }
            }
        });

        // Public methods
        // ----------

        self.buildConfig = function(element) {
            if (!currentView.get('touched')) {
                // Center on module extent.
                LocalDocument.get('$sirs').then(function(result) {
                    if (result.envelope) {
                        var geometry = new ol.format.WKT().readGeometry(result.envelope, {
                            dataProjection: SirsDoc.get().epsgCode,
                            featureProjection: 'EPSG:3857'
                        });
                        currentView.fit(geometry, [element.width(), element.height()]);
                        currentView.set('touched', true);
                    }
                });
            }

            return {
                view: currentView,
                layers: [backLayers, appLayers, editionLayer, geolocLayer],
                controls: [],
                interactions: ol.interaction.defaults({
                    pinchRotate: false,
                    altShiftDragRotate: false,
                    shiftDragZoom: false
                }).extend([selectInteraction])
            };
        };

        // TODO → find a way to do this through event
        self.syncAppLayer = function(layerModel) {
            var olLayer = getAppLayerInstance(layerModel);

            // Update OL layer.
            olLayer.setVisible(layerModel.visible);

            // Load data if necessary.
            olLayer.getSource().getSource().clear();
            if (layerModel.visible === true) {
                setAppLayerFeatures(olLayer);
            }
        };

        // TODO → find a way to do this through event
        self.moveAppLayer = function(from, to) {
            var collection = appLayers.getLayers();
            collection.insertAt(to - 1, collection.removeAt(from));
        };

        // TODO → find a way to do this through event
        self.syncBackLayer = function() {
            var olLayer = createBackLayerInstance(BackLayerService.getActive());
            backLayers.getLayers().setAt(0, olLayer);
        };


        // Private methods
        // ----------

        function createBackLayerInstance(layerModel) {
            var source = angular.copy(layerModel.source),
                extent;

            // Override the source if the layer is available from cache.
            if (angular.isObject(layerModel.cache)) {
                extent = layerModel.cache.extent;
                source.type = 'XYZ';
                source.url = layerModel.cache.url;
            }

            return new ol.layer.Tile({
                name: layerModel.title,
                extent: extent,
                model: layerModel,
                source: new ol.source[source.type](source)
            });
        }

        function createAppLayerInstance(layerModel) {
            var olLayer = new ol.layer.Image({
                name: layerModel.title,
                visible: layerModel.visible,
                model: layerModel,
                source: new ol.source.ImageVector({
                    source: new ol.source.Vector({ useSpatialIndex: false })
                })
            });

            if (layerModel.visible === true) {
                setAppLayerFeatures(olLayer);
            }
            return olLayer;
        }

        function createAppFeatureModel(featureDoc) {
            featureDoc = featureDoc.value || featureDoc; // depending on "include_docs" option when querying docs

            var dataProjection = SirsDoc.get().epsgCode,
                projGeometry = featureDoc.geometry ? wktFormat.readGeometry(featureDoc.geometry).transform(dataProjection, 'EPSG:3857') : undefined;

            if (projGeometry instanceof ol.geom.LineString && projGeometry.getCoordinates().length === 2 &&
                projGeometry.getCoordinates()[0][0] === projGeometry.getCoordinates()[1][0] &&
                projGeometry.getCoordinates()[0][1] === projGeometry.getCoordinates()[1][1]) {
                projGeometry = new ol.geom.Point(projGeometry.getCoordinates()[0]);
            }

            var realGeometry = featureDoc.positionDebut ?
                wktFormat.readGeometry(featureDoc.positionDebut).transform(dataProjection, 'EPSG:3857') : undefined;

            if (realGeometry && featureDoc.positionFin && featureDoc.positionFin !== featureDoc.positionDebut) {
                realGeometry = new ol.geom.LineString([
                    realGeometry.getFirstCoordinate(),
                    wktFormat.readGeometry(featureDoc.positionFin).transform(dataProjection, 'EPSG:3857').getFirstCoordinate()
                ]);
            }

            return {
                id: featureDoc.id || featureDoc._id,
                rev: featureDoc.rev || featureDoc._rev,
                designation: featureDoc.designation,
                title: featureDoc.libelle,
                projGeometry: projGeometry,
                realGeometry: realGeometry
            };
        }

        function createAppFeatureInstances(featureModels, layerModel) {
            var features = [];
            angular.forEach(featureModels, function(featureModel) {
                if ((layerModel.realPosition && featureModel.realGeometry) || (!layerModel.realPosition && featureModel.projGeometry)) {
                    var feature = new ol.Feature();
                    if (layerModel.realPosition) {
                        feature.setGeometry(featureModel.realGeometry);
                        feature.setStyle(RealPositionStyle(layerModel.color, featureModel.realGeometry.getType()));
                    } else {
                        feature.setGeometry(featureModel.projGeometry);
                        feature.setStyle(DefaultStyle(layerModel.color, featureModel.projGeometry.getType()));
                    }
                    feature.set('id', featureModel.id);
                    feature.set('categories', layerModel.categories);
                    feature.set('rev', featureModel.rev);
                    feature.set('designation', featureModel.designation);
                    feature.set('title', featureModel.libelle);
                    features.push(feature);
                }
            });
            return features;
        }

        function setAppLayerFeatures(olLayer) {
            var layerModel = olLayer.get('model'),
                olSource = olLayer.getSource().getSource();

            // Try to get the promise of a previous query.
            var promise = featureCache.get(layerModel.title);
            if (angular.isUndefined(promise)) {

                // Try to get the layer features.
                promise = LocalDocument.query('Element/byClassAndLinear', {
                    startkey: [layerModel.filterValue],
                    endkey: [layerModel.filterValue, {}]
                }).then(
                    function(results) {
                        return results.map(createAppFeatureModel);
                    },
                    function(error) {
                        // TODO → handle error
                    });

                // Set and store the promise.
                featureCache.put(layerModel.title, promise);
            }

            // Wait for promise resolution or rejection.
            promise.then(
                function onSuccess(featureModels) {
                    olSource.addFeatures(createAppFeatureInstances(featureModels, layerModel));
                },
                function onError(error) {
                    // TODO → handle error
                });
        }

        function createEditionLayerInstance() {
            var olLayer = new ol.layer.Image({
                name: 'Edition',
                visible: EditionService.isEnabled(),
                source: new ol.source.ImageVector({
                    source: new ol.source.Vector({ useSpatialIndex: false })
                })
            });

            setEditionLayerFeatures(olLayer);
            return olLayer;
        }

        function createEditionFeatureInstance(featureDoc) {
            // Compute geometry.
            var geometry = wktFormat.readGeometry(featureDoc.positionDebut);
            if (geometry && featureDoc.positionFin && (featureDoc.positionFin !== featureDoc.positionDebut)) {
                geometry = new ol.geom.LineString([
                    geometry.getFirstCoordinate(),
                    wktFormat.readGeometry(featureDoc.positionFin).getFirstCoordinate()
                ]);
            }
            geometry.transform(SirsDoc.get().epsgCode, 'EPSG:3857');

            // Create feature.
            var feature = new ol.Feature({ geometry: geometry });
            feature.setStyle(RealPositionStyle([0, 0, 255, 1], geometry.getType()));
            feature.set('id', featureDoc._id);
            feature.set('rev', featureDoc._rev);
            feature.set('title', featureDoc.libelle);
            return feature;
        }

        function createEditionFeatureInstances(featureDocs) {
            var features = [];
            angular.forEach(featureDocs, function(featureDoc) {
                features.push(createEditionFeatureInstance(featureDoc.value));
            });
            return features;
        }

        function setEditionLayerFeatures(olLayer) {
            var olSource = olLayer.getSource().getSource();

            EditionService.getClosedObjects().then(
                function onSuccess(results) {
                    olSource.clear();
                    olSource.addFeatures(createEditionFeatureInstances(results));
                },
                function onError(error) {
                    // TODO → handle error
                });
        }

        function createGeolocFeatureInstances(location) {
            var pos = [location.longitude, location.latitude];
            return [
                new ol.Feature({
                    geometry: new ol.geom.Point(pos)
                        .transform('EPSG:4326', 'EPSG:3857')
                }),
                new ol.Feature({
                    geometry: ol.geom.Polygon.circular(wgs84Sphere, pos, location.accuracy, 200)
                        .transform('EPSG:4326', 'EPSG:3857')
                })
            ];
        }

        function getAppLayerInstance(layerModel) {
            var layers = appLayers.getLayers(),
                i = layers.getLength();
            while (i--) {
                if (layers.item(i).get('model') === layerModel) {
                    return layers.item(i);
                }
            }
            return null;
        }

        function redrawAppLayers() {
            appLayers.getLayers().forEach(function(layer) {
                layer.getSource().changed();
            });
        }


        // Event listeners
        // ----------

        $rootScope.$watch(function() { return selection.active; }, redrawAppLayers);

        $rootScope.$on('databaseChanged', function() {
            backLayers.getLayers().clear();
            backLayers.getLayers().push(createBackLayerInstance(BackLayerService.getActive()));
            appLayers.getLayers().clear();
            appLayers.getLayers().extend(AppLayersService.getFavorites().map(createAppLayerInstance));
        });

        selectInteraction.on('select', function(event) {
            // Update feature properties.
            angular.forEach(selection.list, function(feature) {
                feature.set('selected', false, true);
                feature.set('visited', false, true);
            });
            angular.forEach(event.selected, function(feature) {
                feature.set('selected', true, true);
                feature.set('visited', false, true);
            });

            // Update selection.
            selection.active = undefined;
            if (event.selected.length) {
                selection.list = event.selected;
                SidePanelService.setTribordView('object_selection');
            } else {
                selection.list = [];
                $ionicSideMenuDelegate.isOpenRight() && $ionicSideMenuDelegate.toggleRight();
            }

            // Redraw layers.
            redrawAppLayers();

            // Trigger event.
            $rootScope.$broadcast('objectSelected', event.selected);

            // Force digest.
            $rootScope.$digest();
        });

        $rootScope.$on('backLayerChanged', function(event, layerModel) {
            backLayers.getLayers().setAt(0, createBackLayerInstance(layerModel));

            var map = olMap.get('main');
            if (angular.isObject(layerModel.cache) && map) {
                currentView.fit(layerModel.cache.extent, map.getSize());
            }
        });

        $rootScope.$on('appLayerAdded', function(event, layerModel) {
            appLayers.getLayers().push(createAppLayerInstance(layerModel));
        });

        $rootScope.$on('appLayerRemoved', function(event, layerModel, index) {
            appLayers.getLayers().removeAt(index);
        });

        $rootScope.$on('geolocationReady', function() {
            geolocLayer.setVisible(true);
        });

        $rootScope.$on('geolocationStopped', function() {
            geolocLayer.setVisible(false);
        });

        $rootScope.$on('geolocationChanged', function(event, location) {
            geolocLayer.getSource().clear();
            geolocLayer.getSource().addFeatures(createGeolocFeatureInstances(location.coords));
        });

        $rootScope.$on('editionModeChanged', function(event, isEnabled) {
            appLayers.setVisible(!isEnabled);
            editionLayer.setVisible(isEnabled);
        });

        $rootScope.$on('editionObjectSaved', function(event, objectDoc) {
            if (objectDoc.positionDebut && objectDoc.positionFin) {
                var source = editionLayer.getSource().getSource(),
                    features = source.getFeatures(), i = features.length;
                while (i--) {
                    if (features[i].get('id') === objectDoc._id) {
                        features.removeAt(i);
                        break;
                    }
                }
                source.addFeature(createEditionFeatureInstance(objectDoc));
            }
        });
    })

    .factory('DefaultStyle', function(selection) {

        function createPointStyle(fillColor, strokeColor, strokeWidth, circleRadius, zIndex) {
            var fill = new ol.style.Fill({ color: fillColor });
            var stroke = new ol.style.Stroke({ color: strokeColor, width: strokeWidth });
            var circle = new ol.style.Circle({ fill: fill, stroke: stroke, radius: circleRadius });
            return new ol.style.Style({ image: circle, zIndex: zIndex });
        }

        function createLineStyle(strokeColor, strokeWidth, zIndex) {
            var stroke = new ol.style.Stroke({ color: strokeColor, width: strokeWidth });
            return new ol.style.Style({ stroke: stroke, zIndex: zIndex });
        }

        function createPointStyleFunc(color) {
            return function() {
                color[3] = computeOpacity(this);

                var highlight = shouldHighlight(this),
                    fillColor = highlight ? color : [255, 255, 255, color[3]],
                    strokeColor = highlight ? [255, 255, 255, color[3]] : color,
                    strokeWidth = 2,
                    pointRadius = 6;
                return [createPointStyle(fillColor, strokeColor, strokeWidth, pointRadius, computeZIndex(this))];
            };
        }

        function createLineStyleFunc(color) {
            return function() {
                color[3] = computeOpacity(this);

                var styles = [],
                    highlight = shouldHighlight(this),
                    zIndex = computeZIndex(this),
                    strokeColor = color,
                    strokeWidth = 5;
                if (highlight) {
                    styles.push(createLineStyle([255, 255, 255, color[3]], strokeWidth + 4, zIndex));
                }
                styles.push(createLineStyle(strokeColor, strokeWidth, zIndex));
                return styles;
            };
        }

        function shouldHighlight(feature) {
            return selection.list.length && ((!selection.active && feature.get('selected')) || (selection.active && selection.active === feature));
        }

        function computeOpacity(feature) {
            if (selection.active && feature !== selection.active) {
                return 0.5;
            } else if (selection.list.length && !feature.get('selected')) {
                return 0.5;
            } else {
                return 1;
            }
        }

        function computeZIndex(feature) {
            if (feature === selection.active) {
                return 3;
            } else if (feature.get('selected')) {
                return 2;
            } else {
                return 1;
            }
        }


        return function(color, type) {
            switch (type) {
                case 'LineString':
                case 'MultiLineString':
                    return createLineStyleFunc(color);
                case 'Point':
                case 'MultiPoint':
                    return createPointStyleFunc(color);
            }
            return null;
        };
    })

    .factory('RealPositionStyle', function(selection) {

        function createPointStyle(fillColor, strokeColor, strokeWidth, circleRadius, zIndex) {
            var fill = new ol.style.Fill({ color: fillColor });
            var stroke = new ol.style.Stroke({ color: strokeColor, width: strokeWidth });
            var circle = new ol.style.Circle({ fill: fill, stroke: stroke, radius: circleRadius });
            return new ol.style.Style({ image: circle, zIndex: zIndex });
        }

        function createLineStyle(strokeColor, strokeWidth, lineDash, zIndex) {
            var stroke = new ol.style.Stroke({ color: strokeColor, width: strokeWidth, lineDash: lineDash });
            return new ol.style.Style({ stroke: stroke, zIndex: zIndex });
        }

        function createPointStyleFunc(color) {
            return function() {
                color[3] = computeOpacity(this);

                var highlight = shouldHighlight(this),
                    fillColor = highlight ? color : [255, 255, 255, color[3]],
                    strokeColor = highlight ? [255, 255, 255, color[3]] : color,
                    strokeWidth = 2,
                    circleRadius = 6;
                return [createPointStyle(fillColor, strokeColor, strokeWidth, circleRadius, computeZIndex(this))];
            };
        }

        function createLineStyleFunc(color) {
            return function() {
                color[3] = computeOpacity(this);

                var styles = [],
                    highlight = shouldHighlight(this),
                    zIndex = computeZIndex(this),
                    pointFillColor = highlight ? color : [255, 255, 255, color[3]],
                    pointStrokeColor = highlight ? [255, 255, 255, color[3]] : color,
                    pointStrokeWidth = 2,
                    pointCircleRadius = 6,
                    lineStrokeColor = color,
                    lineStrokeWidth = 3;

                // Line style(s).
                if (highlight) {
                    styles.push(createLineStyle([255, 255, 255, color[3]], lineStrokeWidth + 4, [20, 30], zIndex));
                }
                styles.push(createLineStyle(lineStrokeColor, lineStrokeWidth, [30, 20], zIndex));

                // Point style.
                var pointStyle = createPointStyle(pointFillColor, pointStrokeColor, pointStrokeWidth, pointCircleRadius, zIndex);
                pointStyle.setGeometry(function(feature) {
                    return new ol.geom.MultiPoint(feature.getGeometry().getCoordinates());
                });
                styles.push(pointStyle);

                return styles;
            };
        }

        function shouldHighlight(feature) {
            return selection.list.length && ((!selection.active && feature.get('selected')) || (selection.active && selection.active === feature));
        }

        function computeOpacity(feature) {
            if (selection.active && feature !== selection.active) {
                return 0.5;
            } else if (selection.list.length && !feature.get('selected')) {
                return 0.5;
            } else {
                return 1;
            }
        }

        function computeZIndex(feature) {
            if (feature === selection.active) {
                return 3;
            } else if (feature.get('selected')) {
                return 2;
            } else {
                return 1;
            }
        }


        return function(color, type) {
            switch (type) {
                case 'LineString':
                    return createLineStyleFunc(color);
                case 'Point':
                    return createPointStyleFunc(color);
            }
            return null;
        };
    });