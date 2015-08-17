(function(angular) {
    'use strict';

    angular.module('esri.map', []);

    angular.module('esri.map').factory('esriLoader', function ($q) {
        return function (moduleName, callback) {
            var deferred = $q.defer();
            if (angular.isString(moduleName)) {
                require([moduleName], function (module) {
                    if (callback !== null && callback !== undefined) {
                        callback(module);
                    }

                    deferred.resolve(module);
                });
            }
            else if (angular.isArray(moduleName)) {
                require(moduleName, function () {
                    if (callback !== null && callback !== undefined) {
                        callback.apply(this, arguments);
                    }

                    deferred.resolve(arguments);
                });
            }
            else {
                deferred.reject('An Array<String> or String is required to load modules.');
            }
            return deferred.promise;
        };
    });

})(angular);

(function (angular) {
  'use strict';

  angular.module('esri.map').service('esriRegistry', function ($q) {
    var registry = {};

    return {
      _register: function(name, deferred){
        // if there isn't a promise in the registry yet make one...
        // this is the case where a directive is nested higher then the controller
        // needing the instance
        if (!registry[name]){
          registry[name] = $q.defer();
        }

        var instance = registry[name];

        // when the deferred from the directive is rejected/resolved
        // reject/resolve the promise in the registry with the appropriate value
        deferred.promise.then(function(arg){
          instance.resolve(arg);
          return arg;
        }, function(arg){
          instance.reject(arg);
          return arg;
        });

        return function(){
          delete registry[name];
        };
      },

      get: function(name){
        // is something is already in the registry return its promise ASAP
        // this is the case where you might want to get a registry item in an
        // event handler
        if(registry[name]){
          return registry[name].promise;
        }

        // if we dont already have a registry item create one. This covers the
        // case where the directive is nested inside the controler. The parent
        // controller will be executed and gets a promise that will be resolved
        // later when the item is registered
        var deferred = $q.defer();

        registry[name] = deferred;

        return deferred.promise;
      }
    };
  });

})(angular);
/*
    Changes made by Edwin Sheldon (eas604@github) per Apache license:
    Added support for the following ESRI JavaScript API attributes for the map constructor:
        attributionWidth, autoResize, displayGraphicsOnPan, fadeOnZoom, fitExtent, force3DTransforms,
        logo, maxScale, maxZoom, minScale, minZoom, nav, navigationMode, optimizePanAnimation,
        resizeDelay, scale, showAttribution, showInfoWindowOnClick, slider, sliderOrientation,
        sliderPosition, sliderStyle, smartNavigation, wrapAround180
 */
(function(angular) {
    'use strict';

    angular.module('esri.map').directive('esriMap', function($q, $timeout, esriRegistry) {

        return {
            // element only
            restrict: 'E',

            // isolate scope
            scope: {
                // two-way binding for center/zoom
                // because map pan/zoom can change these
                center: '=?',
                zoom: '=?',
                itemInfo: '=?',
                // one-way binding for other properties
                basemap: '@',
                // function binding for event handlers
                load: '&',
                extentChange: '&'
            },

            // replace tag with div with same id
            compile: function($element, $attrs) {
                // remove the id attribute from the main element
                $element.removeAttr('id');

                // append a new div inside this element, this is where we will create our map
                $element.append('<div id=' + $attrs.id + '></div>');

                // since we are using compile we need to return our linker function
                // the 'link' function handles how our directive responds to changes in $scope
                /*jshint unused: false*/
                return function(scope, element, attrs, controller) {
                };
            },

            // directive api
            controller: function($scope, $element, $attrs) {
                // only do this once per directive
                // this deferred will be resolved with the map
                var mapDeferred = $q.defer();

                // add this map to the registry
                if($attrs.registerAs){
                    var deregister = esriRegistry._register($attrs.registerAs, mapDeferred);

                    // remove this from the registry when the scope is destroyed
                    $scope.$on('$destroy', deregister);
                }

                require(['esri/map','esri/arcgis/utils'], function(Map, arcgisUtils)
                {
                    if($attrs.webmapId)
                    {
                        arcgisUtils.createMap($attrs.webmapId,$attrs.id).then(function(response)
                        {
                            mapDeferred.resolve(response.map);

                            var geoCenter = response.map.geographicExtent.getCenter();
                            $scope.center.lng = geoCenter.x;
                            $scope.center.lat = geoCenter.y;
                            $scope.zoom = response.map.getZoom();
                            $scope.itemInfo = response.itemInfo;
                        });
                    }
                    else
                    {
                        // setup our map options based on the attributes and scope
                        var mapOptions = {};

                        // center/zoom/extent
                        // check for convenience extent attribute
                        // otherwise get from scope center/zoom
                        if ($attrs.extent) {
                            mapOptions.extent = $scope[$attrs.extent];
                        } else {
                            if ($scope.center.lng && $scope.center.lat) {
                                mapOptions.center = [$scope.center.lng, $scope.center.lat];
                            } else if ($scope.center) {
                                mapOptions.center = $scope.center;
                            }
                            if ($scope.zoom) {
                                mapOptions.zoom = $scope.zoom;
                            }
                        }

                        // basemap
                        if ($scope.basemap) {
                            mapOptions.basemap = $scope.basemap;
                        }

                        // strings
                        if ($attrs.navigationMode) {
                            if ($attrs.navigationMode !== 'css-transforms' && $attrs.navigationMode !== 'classic') {
                                throw new Error('navigationMode must be \'css-transforms\' or \'classic\'.');
                            } else {
                                mapOptions.navigationMode = $attrs.navigationMode;
                            }
                        }

                        if ($attrs.sliderOrientation) {
                            if ($attrs.sliderOrientation !== 'horizontal' && $attrs.sliderOrientation !== 'vertical') {
                                throw new Error('sliderOrientation must be \'horizontal\' or \'vertical\'.');
                            } else {
                                mapOptions.sliderOrientation = $attrs.sliderOrientation;
                            }
                        }

                        if ($attrs.sliderPosition) {
                            var allowed = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
                            if (allowed.indexOf($attrs.sliderPosition) < 0) {
                                throw new Error('sliderPosition must be in ' + allowed);
                            } else {
                                mapOptions.sliderPosition = $attrs.sliderPosition;
                            }
                        }

                        // This attribute does not seem to have any effect on the underlying map slider.
                        // Not sure if it is being passed to the API correctly.
                        if ($attrs.sliderStyle) {
                            if ($attrs.sliderStyle !== 'large' && $attrs.sliderStyle !== 'small') {
                                throw new Error('sliderStyle must be \'large\' or \'small\'.');
                            } else {
                                mapOptions.sliderStyle = $attrs.sliderStyle;
                            }
                        }

                        // booleans
                        var bools = [
                            'autoResize', 'displayGraphicsOnPan', 'fadeOnZoom', 'fitExtent', 'force3DTransforms',
                            'logo', 'nav', 'optimizePanAnimation', 'showAttribution', 'showInfoWindowOnClick',
                            'slider', 'smartNavigation', 'wrapAround180'
                        ];
                        angular.forEach(bools, function (key) {
                            if (typeof $attrs[key] !== 'undefined') {
                                mapOptions[key] = $attrs[key].toString() === 'true';
                            }
                        });

                        // numeric attributes
                        var numeric = [
                            'attributionWidth', 'maxScale', 'maxZoom', 'minScale', 'minZoom', 'resizeDelay', 'scale'
                        ];
                        angular.forEach(numeric, function (key) {
                            if ($attrs[key]) {
                                mapOptions[key] = $attrs[key];
                            }
                        });

                        // initialize map and resolve the deferred
                        var map = new Map($attrs.id, mapOptions);
                        mapDeferred.resolve(map);
                    }

                    mapDeferred.promise.then(function(map)
                    {
                        // make a reference to the map object available
                        // to the controller once it is loaded.
                        map.on('load', function() {
                            if (!$attrs.load) {
                                return;
                            }
                            $scope.$apply(function() {
                                $scope.load()(map);
                            });
                        });

                        // listen for changes to scope and update map
                        $scope.$watch('basemap', function(newBasemap, oldBasemap) {
                            if (map.loaded && newBasemap !== oldBasemap) {
                                map.setBasemap(newBasemap);
                            }
                        });

                        $scope.inUpdateCycle = false;

                        $scope.$watch(function(scope){ return [scope.center.lng,scope.center.lat, scope.zoom].join(',');}, function(newCenterZoom,oldCenterZoom)
                        // $scope.$watchGroup(['center.lng','center.lat', 'zoom'], function(newCenterZoom,oldCenterZoom) // supported starting at Angular 1.3
                        {
                            if( $scope.inUpdateCycle ) {
                                return;
                            }

                            console.log('center/zoom changed', newCenterZoom, oldCenterZoom);
                            newCenterZoom = newCenterZoom.split(',');
                            if( newCenterZoom[0] !== '' && newCenterZoom[1] !== '' && newCenterZoom[2] !== '' )
                            {
                                $scope.inUpdateCycle = true;  // prevent circular updates between $watch and $apply
                                map.centerAndZoom([newCenterZoom[0], newCenterZoom[1]], newCenterZoom[2]).then(function()
                                {
                                    console.log('after centerAndZoom()');
                                    $scope.inUpdateCycle = false;
                                });
                            }
                        });

                        map.on('extent-change', function(e)
                        {
                            if( $scope.inUpdateCycle ) {
                                return;
                            }

                            $scope.inUpdateCycle = true;  // prevent circular updates between $watch and $apply

                            console.log('extent-change geo', map.geographicExtent);

                            $scope.$apply(function()
                            {
                                var geoCenter = map.geographicExtent.getCenter();

                                $scope.center.lng = geoCenter.x;
                                $scope.center.lat = geoCenter.y;
                                $scope.zoom = map.getZoom();

                                // we might want to execute event handler even if $scope.inUpdateCycle is true
                                if( $attrs.extentChange ) {
                                    $scope.extentChange()(e);
                                }

                                $timeout(function(){
                                    // this will be executed after the $digest cycle
                                    console.log('after apply()');
                                    $scope.inUpdateCycle = false;
                                },0);
                            });
                        });

                        // clean up
                        $scope.$on('$destroy', function () {
                            map.destroy();
                            // TODO: anything else?
                        });
                    });
                });

                // method returns the promise that will be resolved with the map
                this.getMap = function() {
                    return mapDeferred.promise;
                };

                // adds the layer, returns the promise that will be resolved with the result of map.addLayer
                this.addLayer = function(layer) {
                    return this.getMap().then(function(map) {
                        return map.addLayer(layer);
                    });
                };

                // array to store layer info, needed for legend
                // TODO: is this the right place for this?
                // can it be done on the legend directive itself?
                this.addLayerInfo = function(lyrInfo) {
                    if (!this.layerInfos) {
                        this.layerInfos = [lyrInfo];
                    } else {
                        this.layerInfos.push(lyrInfo);
                    }
                };
                this.getLayerInfos = function() {
                    return this.layerInfos;
                };
            }
        };
    });

})(angular);

(function(angular) {
    'use strict';

    angular.module('esri.map').directive('esriGraphicsLayer', function ($q) {
        // this object will tell angular how our directive behaves
        return {
            // only allow esriGraphicsLayer to be used as an element (<esri-graphics-layer>)
            restrict: 'E',

            // require the esriGraphicsLayer to have its own controller as well an esriMap controller
            // you can access these controllers in the link function
            require: ['esriGraphicsLayer', '^esriMap'],

            // replace this element with our template.
            // since we aren't declaring a template this essentially destroys the element
            replace: true,

            // define an interface for working with this directive
            controller: function ($scope, $element, $attrs) {
                var layerDeferred = $q.defer();

                require([
                    'esri/layers/GraphicsLayer'], function (GraphicsLayer) {
                    var layer = new GraphicsLayer({id:$attrs.id});

                    layerDeferred.resolve(layer);
                });

                // return the defered that will be resolved with the feature layer
                this.getLayer = function () {
                    return layerDeferred.promise;
                };

                // set the visibility of the feature layer
                this.setVisible = function (isVisible) {
                    var visibleDeferred = $q.defer();

                    this.getLayer().then(function (layer) {
                        if (isVisible) {
                            layer.show();
                        } else {
                            layer.hide();
                        }

                        visibleDeferred.resolve();
                    });

                    return visibleDeferred.promise;
                };
            },

            // now we can link our directive to the scope, but we can also add it to the map..
            link: function (scope, element, attrs, controllers) {

                // controllers is now an array of the controllers from the 'require' option
                var layerController = controllers[0];
                var mapController = controllers[1];

                var visible = attrs.visible || 'true';
                var isVisible = scope.$eval(visible);

                // set the initial visible state of the feature layer
                layerController.setVisible(isVisible);

                // add a $watch condition on the visible attribute, if it changes and the new value is different than the previous, then use to
                // set the visibility of the feature layer
                scope.$watch(function () { return scope.$eval(attrs.visible); }, function (newVal, oldVal) {
                    if (newVal !== oldVal) {
                        layerController.setVisible(newVal);
                    }
                });

                layerController.getLayer().then(function (layer) {
                    // add layer
                    mapController.addLayer(layer);

                    //look for layerInfo related attributes. Add them to the map's layerInfos array for access in other components
                    mapController.addLayerInfo({
                      title: attrs.title || layer.name,
                      layer: layer,
                      defaultSymbol: (attrs.defaultSymbol) ? JSON.parse(attrs.defaultSymbol) : true
                    });

                    // return the layer
                    return layer;
                });
            }
        };
    });

})(angular);
(function(angular) {
    'use strict';

    angular.module('esri.map').directive('esriFeatureLayer', function ($q) {
        // this object will tell angular how our directive behaves
        return {
            // only allow esriFeatureLayer to be used as an element (<esri-feature-layer>)
            restrict: 'E',

            // require the esriFeatureLayer to have its own controller as well an esriMap controller
            // you can access these controllers in the link function
            require: ['esriFeatureLayer', '^esriMap'],

            // replace this element with our template.
            // since we aren't declaring a template this essentially destroys the element
            replace: true,

            // define an interface for working with this directive
            controller: function ($scope, $element, $attrs) {
                var layerDeferred = $q.defer();

                require([
                    'esri/layers/FeatureLayer'], function (FeatureLayer) {
                    var layer = new FeatureLayer($attrs.url);

                    layerDeferred.resolve(layer);
                });

                // return the defered that will be resolved with the feature layer
                this.getLayer = function () {
                    return layerDeferred.promise;
                };

                // set the visibility of the feature layer
                this.setVisible = function (isVisible) {
                    var visibleDeferred = $q.defer();

                    this.getLayer().then(function (layer) {
                        if (isVisible) {
                            layer.show();
                        } else {
                            layer.hide();
                        }

                        visibleDeferred.resolve();
                    });

                    return visibleDeferred.promise;
                };
            },

            // now we can link our directive to the scope, but we can also add it to the map..
            link: function (scope, element, attrs, controllers) {
                // controllers is now an array of the controllers from the 'require' option
                var layerController = controllers[0];
                var mapController = controllers[1];

                var visible = attrs.visible || 'true';
                var isVisible = scope.$eval(visible);

                // set the initial visible state of the feature layer
                layerController.setVisible(isVisible);

                // add a $watch condition on the visible attribute, if it changes and the new value is different than the previous, then use to
                // set the visibility of the feature layer
                scope.$watch(function () { return scope.$eval(attrs.visible); }, function (newVal, oldVal) {
                    if (newVal !== oldVal) {
                        layerController.setVisible(newVal);
                    }
                });

                layerController.getLayer().then(function (layer) {
                    // add layer
                    mapController.addLayer(layer);

                    //look for layerInfo related attributes. Add them to the map's layerInfos array for access in other components
                    mapController.addLayerInfo({
                      title: attrs.title || layer.name,
                      layer: layer,
                      hideLayers: (attrs.hideLayers) ? attrs.hideLayers.split(',') : undefined,
                      defaultSymbol: (attrs.defaultSymbol) ? JSON.parse(attrs.defaultSymbol) : true
                    });

                    // return the layer
                    return layer;
                });
            }
        };
    });

})(angular);

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
(function(angular) {
    'use strict';

        angular.module('esri.map').directive('esriSimpleLineSymbol', function ($q) {
        // this object will tell angular how our directive behaves
        return {
            // only allow esriGraphicsLayer to be used as an element (<esri-graphics-layer>)
            restrict: 'E',

            // require the esriSimpleLineSymbol to have its own controller as well an esriSimpleRenderer controller
            // you can access these controllers in the link function
            require: ['esriSimpleLineSymbol', '^esriSimpleRenderer'],

            // replace this element with our template.
            // since we aren't declaring a template this essentially destroys the element
            replace: true,

            // define an interface for working with this directive
            controller: function ($scope, $element, $attrs) {
                var symbolDeferred = $q.defer();

                require([
                    'esri/Color',
                    'esri/symbols/SimpleLineSymbol'], function (
                        Color, 
                        SimpleLineSymbol) {

                    var symbol = new SimpleLineSymbol(
                        $attrs.style ? $attrs.style : 'solid',
                        new Color($attrs.color ? $attrs.color : '#000' ), 
                        $attrs.size ? $attrs.size : 1);

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
                    if (rendererController) {
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
(function(angular) {
    'use strict';

        angular.module('esri.map').directive('esriSimpleMarkerSymbol', function ($q) {
        // this object will tell angular how our directive behaves
        return {
            // only allow esriGraphicsLayer to be used as an element (<esri-graphics-layer>)
            restrict: 'E',

            // require the esriSimpleMarkerSymbol to have its own controller as well an esriSimpleRenderer controller
            // you can access these controllers in the link function
            require: ['esriSimpleMarkerSymbol', '^esriSimpleRenderer'],

            // replace this element with our template.
            // since we aren't declaring a template this essentially destroys the element
            replace: true,

            // define an interface for working with this directive
            controller: function ($scope, $element, $attrs) {
                var symbolDeferred = $q.defer();

                require([
                    'esri/Color',
                    'esri/symbols/SimpleLineSymbol',
                    'esri/symbols/SimpleMarkerSymbol'], function (
                        Color, 
                        SimpleLineSymbol,
                        SimpleMarkerSymbol) {

                    var symbol = new SimpleMarkerSymbol(
                        $attrs.style ? $attrs.style : 'circle',
                        $attrs.size ? $attrs.size : 10,
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
                    if (rendererController) {
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
(function(angular) {
    'use strict';

    /**
     * @ngdoc directive
     * @name esriApp.directive:esriLegend
     * @description
     * # esriLegend
     */
    angular.module('esri.map')
      .directive('esriLegend', function ($document, $q) {
        return {
          //run last
          priority: -10,
          scope:{},
          replace: true,
          // require the esriMap controller
          // you can access these controllers in the link function
          require: ['^esriMap'],

          // now we can link our directive to the scope, but we can also add it to the map..
          link: function(scope, element, attrs, controllers){
            // controllers is now an array of the controllers from the 'require' option
            var mapController = controllers[0];
            var targetId = attrs.targetId || attrs.id;
            var legendDeferred = $q.defer();

            require(['esri/dijit/Legend', 'dijit/registry'], function (Legend, registry) {
              mapController.getMap().then(function(map) {
                var opts = {
                    map: map
                };
                var layerInfos = mapController.getLayerInfos();
                if (layerInfos) {
                  opts.layerInfos = layerInfos;
                }
                // NOTE: need to come up w/ a way to that is not based on id
                // or handle destroy at end of this view's lifecyle
                var legend = registry.byId(targetId);
                if (legend) {
                  legend.destroyRecursive();
                }
                legend = new Legend(opts, targetId);
                legend.startup();
                scope.layers = legend.layers;
                angular.forEach(scope.layers, function(layer, i) {
                  scope.$watch('layers['+i+'].renderer',function() {
                    legend.refresh();
                  });
                });
                legendDeferred.resolve(legend);
              });
            });
          }
        };
      });

})(angular);
