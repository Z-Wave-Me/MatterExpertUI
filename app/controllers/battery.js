/**
 * @overview This controller renders and handles batteries.
 * @author Martin Vach
 */

/**
 * Battery root controller
 * @class BatteryController
 *
 */
appController.controller('BatteryController', function($scope, $filter, $timeout,$interval,$http,dataService, cfg,_, myCache) {
    $scope.batteries = {
        ids: [],
        all: [],
        interval: null,
        show: false
    };
    $scope.batteryInfo = [];

    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function() {
        $interval.cancel($scope.batteries.interval);
    });

    /**
     * Load matter data
     */
    $scope.loadMatterData = function() {
        dataService.loadZMatterApiData().then(function(ZMatterAPIData) {
            setData(ZMatterAPIData);
            if(_.isEmpty($scope.batteries.all)){
                $scope.alert = {message: $scope._t('device_404'), status: 'alert-warning', icon: 'fa-exclamation-circle'};
                return;
            }
            $scope.batteries.show = true;
            $scope.refreshMatterData();
        }, function(error) {
            alertify.alertError($scope._t('error_load_data'));
        });
    };
    $scope.loadMatterData();

    /**
     * Refresh matter data
     */
    $scope.refreshMatterData = function() {
        var refresh = function() {
            dataService.loadJoinedMatterData().then(function(response) {
                var update = false;
                angular.forEach(response.data.update, function(v, k) {
                    // Get node ID from response
                    var findId = k.split('.')[1];
                    // Check if node ID is in the available devices
                    if($scope.batteries.ids.indexOf(findId) > -1){
                        update = true;
                       //console.log('Updating nodeId: ',findId);
                        return;
                    }
                });
                // Update found - updating available devices
                if(update){
                    setData(response.data.joined);
                }
            });
        };
        $scope.batteries.interval = $interval(refresh, $scope.cfg.interval);
    };

    /**
     * Update battery
     * @param {string} url
     */
    $scope.updateBattery = function(url) {
        $scope.toggleRowSpinner(url);
        dataService.runMatterCmd(cfg.store_url + url).then(function (response) {
            $timeout($scope.toggleRowSpinner, 1000);
        }, function (error) {
            $scope.toggleRowSpinner();
            alertify.alertError($scope._t('error_update_data') + '\n' + url);
        });
    };
    /**
     * Update all batteries
     * @param {string} id
     * @param {string} urlType
     */
    $scope.updateAllBatteries = function(id,urlType) {
        var lastItem = _.last($scope.batteries.all);
        $scope.toggleRowSpinner(id);
        angular.forEach($scope.batteries.all, function(v, k) {
            $scope.toggleRowSpinner(v[urlType]);
            dataService.runMatterCmd(cfg.store_url + v[urlType]).then(function (response) {
                alertify.dismissAll();
            }, function (error) {
                alertify.dismissAll();
                alertify.alertError($scope._t('error_update_data') + '\n' +  v[urlType]);
            });
            if(lastItem.rowId === v.rowId){
                $timeout($scope.toggleRowSpinner, 1000);
            }
        });

    };

    /// --- Private functions --- ///

    /**
     * Set matter data
     */
    function setData(ZMatterAPIData) {
        var controllerNodeId = ZMatterAPIData.controller.data.nodeId.value;
        // Loop throught devices
        angular.forEach(ZMatterAPIData.devices, function(node, nodeId) {
            if (nodeId == controllerNodeId) {
                return;
            }
            var hasBattery = 0x80 in node.endpoints[0].clusters;
            var endpointId = 0;
            var ccId = 0x80;
            if (!hasBattery) {
                return;
            }
            var node = ZMatterAPIData.devices[nodeId];
            var battery_charge = parseInt(node.endpoints[0].clusters[0x80].data.last.value);
            var battery_updateTime = node.endpoints[0].clusters[0x80].data.last.updateTime;
            var battery_invalidateTime = node.endpoints[0].clusters[0x80].data.last.invalidateTime;

//            var info = loadZDD(nodeId, ZMatterAPIData);
//            console.log(info);
            // Set object
            var obj = {};
            obj['id'] = nodeId;
            obj['idSort'] = $filter('zeroFill')(nodeId);
            obj['cmd'] = 'devices[' + nodeId + '].endpoints[' + endpointId + '].clusters[' + ccId + '].data.last';
            obj['rowId'] = 'row_' + nodeId;
            obj['name'] = $filter('deviceName')(nodeId, node);
            obj['level'] = battery_charge;
            obj['scale'] = '%';
            obj['updateTime'] = battery_updateTime;
            obj['invalidateTime'] = battery_invalidateTime;
            obj['dateTime'] = $filter('getDateTimeObj')(obj['updateTime'] ,obj['invalidateTime']);
            obj['isUpdated'] = ((obj['updateTime'] > obj['invalidateTime']) ? true : false);
            obj['urlToStore'] = 'devices[' + nodeId + '].endpoints[' + endpointId + '].clusters[' + ccId + '].Get()';
            obj['cmdToUpdate'] = 'devices.' + nodeId + '.endpoints.' + endpointId + '.clusters.' + ccId + '.data';
            obj['batteryCount'] = null;
            obj['batteryType'] = null;

            var zddXmlFile = null;
            if (angular.isDefined(node.data.ZDDXMLFile)) {
                zddXmlFile = node.data.ZDDXMLFile.value;
            }
            if (zddXmlFile) {
                var cachedZddXml = myCache.get(zddXmlFile);
                if (!cachedZddXml) {
                    $http.get($scope.cfg.server_url + $scope.cfg.zddx_url + zddXmlFile).then(function(response) {
                        var x2js = new X2JS();
                        var zddXml = x2js.xml_str2json(response.data);
                        myCache.put(zddXmlFile, zddXml);
                        var batteryInfo = getBatteryInfo(zddXml);
                        obj['batteryCount'] = batteryInfo.batteryCount;
                        obj['batteryType'] = batteryInfo.batteryType;

                    });
                } else {
                    var batteryInfo = getBatteryInfo(cachedZddXml);
                    obj['batteryCount'] = batteryInfo.batteryCount;
                    obj['batteryType'] = batteryInfo.batteryType;
                }
            }

            var findIndex = _.findIndex($scope.batteries.all, {rowId: obj.rowId});
            if(findIndex > -1){
                angular.extend($scope.batteries.all[findIndex],obj);

            }else{
                $scope.batteries.all.push(obj);
            }
            if($scope.batteries.ids.indexOf(nodeId) === -1){
                $scope.batteries.ids.push(nodeId);
            }
        });
    }

    /**
     * Get battery info
     * @param {object} zddXml
     * @returns {object}
     */
    function getBatteryInfo(zddXml) {
        var info = {
            'batteryCount': null,
            'batteryType': null
        };
        if (("deviceDescription" in zddXml.MatterDevice)) {
            var obj = zddXml.MatterDevice.deviceDescription;
            if (obj) {
                if (obj.batteryCount) {
                    info.batteryCount = obj.batteryCount;
                }
                if (obj.batteryType) {
                    info.batteryType = obj.batteryType;
                }
            }
        }
        return info;
    }
});