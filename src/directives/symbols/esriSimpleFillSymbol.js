(function(angular) {
    'use strict';

        angular.module('esri.map').directive('esriSimpleFillSymbol', function ($q) {
        // this object will tell angular how our directive behaves
        return {
            // only allow esriGraphicsLayer to be used as an element (<esri-graphics-layer>)
            restrict: 'E',

            // require the esriSimpleFillSymbol to have its own controller as well an esriSimpleRenderer controller
            // you can access these controllers in the link function
            require: ['esriSimpleFillSymbol', '^esriSimpleRenderer'],

            // replace this element with our template.
            // since we aren't declaring a template this essentially destroys the element
            replace: true,

            // define an interface for working with this directive
            controller: function ($scope, $element, $attrs) {
                var symbolDeferred = $q.defer();

                require([
                    'esri/Color',
                    'esri/symbols/SimpleLineSymbol',
                    'esri/symbols/SimpleFillSymbol'], function (
                        Color, 
                        SimpleLineSymbol,
                        SimpleFillSymbol) {

                    var symbol = new SimpleFillSymbol(
                        $attrs.style ? $attrs.style : 'solid',
                        new SimpleLineSymbol(
                            SimpleLineSymbol.STYLE_SOLID, 
                            new Color($attrs.lineColor ? $attrs.lineColor : '#000' ), 
                            $attrs.lineSize ? $attrs.lineSize : 1),
                        new Color($attrs.color ? $attrs.color : '#F00' ));

                    symbolDeferred.resolve(symbol);
                });

                // return the defered that will be resolved with the feature layer
                this.getSymbol = function () {
                    return symbolDeferred.promise;
                };
            },

            // now we can link our directive to the scope, but we can also add it to the map..
            link: function (scope, element, attrs, controllers) {                
                
                // controllers is now an array of the controllers from the 'require' option
                var rendererDirectives = ['esriSimpleRenderer'],
                    rendererDirective,
                    symbolController = controllers[0],
                    rendererController;
                
                // searchs for every layer directive found in array, if it's undefined, 
                // go to the next.
                for (var i in rendererDirectives){
                    rendererDirective = rendererDirectives[i];
                    rendererController = element.parent().controller(rendererDirective);
                    if (rendererController) { break; }
                }
                
                // gets the renderer controller
                symbolController.getSymbol().then(function(symbol){

                    // validates if the renderer controller was found
                    if (rendererController){
                        rendererController.getRenderer().then(function (renderer) {
                            renderer.symbol = symbol;
                        });
                    }

                    // return the layer
                    return symbol;
                });
            }
        };
    });

})(angular);