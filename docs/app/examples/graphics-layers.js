'use strict';

angular.module('esri-map-docs')
    .controller('GraphicsLayersCtrl', function($scope, esriRegistry) {
         $scope.map = {
            center: {
                lng: -122.676207,
                lat: 45.523452
            },
            zoom: 12
        };
    
        // adds the onclick event on the map to test the 
        esriRegistry.get('myMap').then(function(map){
            require(['esri/graphic',
                     'esri/renderers/SimpleRenderer',
                     'esri/symbols/SimpleMarkerSymbol'
                     ], function(Graphic, SimpleRenderer, SimpleMarkerSymbol){
                
                var layer = map.getLayer('demoLayer');
                layer.setRenderer(new SimpleRenderer(new SimpleMarkerSymbol()));
                
                map.on('click', function(evt){
                    layer.add(new Graphic( evt.mapPoint ));
                });
            });
        })
    });
