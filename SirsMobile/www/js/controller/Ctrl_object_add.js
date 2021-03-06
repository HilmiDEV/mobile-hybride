angular.module('app.controllers.object_add', [])

    .controller('ObjectAddController', function ObjectAddController($filter, $location, $ionicScrollDelegate, LocalDocument, AuthService, GeolocationService, EditionService, AppLayersService) {

        var self = this;


        self.tab = 'layers';

        self.allLayers = AppLayersService.getFavorites();

        self.closable = [];

        self.selectedLayer = undefined;

        self.selectedClosable = undefined;


        self.setTab = function(name) {
            if (name !== self.tab) {
                self.tab = name;
                $ionicScrollDelegate.$getByHandle('editScroll').scrollTop(false);
            }
        };

        self.newObject = function() {
            if (angular.isDefined(self.selectedLayer)) {
                var type = self.selectedLayer.filterValue.substring(
                    self.selectedLayer.filterValue.lastIndexOf('.') + 1); // TODO → improve type detection
                $location.path('/object/' + encodeURIComponent(type));
            }
        };

        self.closeObject = function() {
            if (angular.isDefined(self.selectedClosable)) {
                var type = self.selectedClosable['@class'].substring(
                    self.selectedClosable['@class'].lastIndexOf('.') + 1); // TODO → improve type detection
                $location.path('/object/' + encodeURIComponent(type) + '/' + self.selectedClosable._id);
            }
        };


        EditionService.getClosableObjects().then(function(results) {
            self.closable = results.map(function(row) {
                return row.doc;
            });
        });
    });