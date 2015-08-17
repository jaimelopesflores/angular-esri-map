(function(angular) {
    'use strict';

    angular.module('esri.map').directive('esriSimpleRenderer', function ($q) {
        // this object will tell angular how our directive behaves
        return {
            // only allow esriFeatureLayer to be used as an element (<esri-simple-renderer>)
            restrict: 'E',

            // require the esriSimpleRenderer to have its own controller as well an esriGraphicsLayer controller
            // you can access these controllers in the link function
            //require: ['esriSimpleRenderer', '^esriFeatureLayer'],
            require: ['esriSimpleRenderer'],
            
            // replace this element with our template.
            // since we aren't declaring a template this essentially destroys the element
            replace: true,

            // define an interface for working with this directive
            controller: function () {
                var rendererDeferred = $q.defer();

                require([
                    'esri/renderers/SimpleRenderer'], function (SimpleRenderer) {
                    var renderer = new SimpleRenderer();

                    rendererDeferred.resolve(renderer);
                });

                // return the defered that will be resolved with the feature layer
                this.getRenderer = function () {
                    return rendererDeferred.promise;
                };
            },

            // now we can link our directive to the scope, but we can also add it to the map..
            link: function (scope, element, attrs, controllers) {

                // controllers is now an array of the controllers from the 'require' option
                var layerDirectives = ['esriFeatureLayer', 'esriGraphicsLayer'],
                    rendererController = controllers[0],
                    layerController;
                
                // searchs for every layer directive found in array, if it's undefined, 
                // go to the next.
                for (var i in layerDirectives){
                    layerController = element.parent().controller(layerDirectives[i]);
                    if (layerController){ break; }
                }

                // gets the renderer controller
                rendererController.getRenderer().then(function(renderer){

                    // validates if the layer controller was found
                    if (layerController){
                        layerController.getLayer().then(function (layer) {                
                            layer.setRenderer(renderer);
                        });
                    }

                    // return the layer
                    return renderer;
                });
            }
        };
    });

})(angular);