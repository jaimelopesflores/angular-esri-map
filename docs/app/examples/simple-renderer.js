'use strict';

angular.module('esri-map-docs')
    .controller('SimpleRendererCtrl', function($scope, esriRegistry){
        $scope.map = {
            center: {
                lng: -45.867133,
                lat: -23.250400
            },
            zoom: 8
        };

        esriRegistry.get('myMap').then(function(map){
            require(['esri/graphic'], function(Graphic){
                map.on('click', function(evt){
                    map.getLayer('testLayer').add(new Graphic( evt.mapPoint ));
                })
            });
        })
    });