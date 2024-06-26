/**
 * Application Home controller
 * @author Martin Vach
 */

/**
 * Report controller
 */
// Home controller
appController.controller('HomeController', function ($scope, $filter, $timeout, $route, $interval, dataService, deviceService, cfg) {
    $scope.home = {
        show: false,
        interval: null,
        devices: {},
        localyReset:[],
        devicesCnt: {
            mains: 0,
            battery: 0,
            sum: 0
        },
        networkInformation: {
            mains: 0,
            battery: 0,
        },
        networkSum: 0
    };
    $scope.ZMatterAPIData;
    $scope.controller = {
        controllerState: 0,
        startLearnMode: false
    };


    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function () {
        $interval.cancel($scope.home.interval);
    });

    /**
     * Load matter data
     */
    $scope.loadMatterData = function () {
        dataService.loadZMatterApiData().then(function (ZMatterAPIData) {
            $scope.home.show = true;
            // TDB var isRealPrimary = ZMatterAPIData.controller.data.isRealPrimary.value;
            var hasDevices = Object.keys(ZMatterAPIData.devices).length;
            $scope.ZMatterAPIData = ZMatterAPIData;
            setData(ZMatterAPIData);
            $scope.controller.controllerState = ZMatterAPIData.controller.data.controllerState.value;
            $scope.controller.startLearnMode = false; // in Matter we never allow learn mode
            $scope.refreshMatterData();
        }, function (error) {
            alertify.alertError($scope._t('error_load_data'));
        });
    };

    /**
     * Refresh matter data
     */
    $scope.refreshMatterData = function () {
        var refresh = function () {
            dataService.loadJoinedMatterData().then(function (response) {
                setData(response.data.joined);
                $scope.controller.controllerState = response.data.joined.controller.data.controllerState.value;
            });
        };
        $scope.home.interval = $interval(refresh, $scope.cfg.interval);
    };
    if (!cfg.custom_ip) {
        $scope.loadMatterData();
    } else {
        if (cfg.server_url != '') {
            $scope.loadMatterData();
        }
    }


    /**
     * Set custom IP
     */
    $scope.setIP = function (ip) {
        if (!ip || ip == '') {
            $('.custom-ip-error').show();
            return;
        }
        $interval.cancel($scope.home.interval);
        $('.custom-ip-success,.custom-ip-true .home-page').hide();
        var setIp = 'http://' + ip + ':8083';
        cfg.server_url = setIp;
        $scope.loadHomeData = true;
        $route.reload();
    };

    // Run Matter Command
    $scope.runMatterCmdConfirm = function (cmd, confirm) {
        if (confirm) {
            alertify.confirm(confirm, function () {
                _runMatterCmd(cmd);
            });
        } else {
            _runMatterCmd(cmd);
        }
    };

    /// --- Private functions --- ///

    /**
     * Run matter cmd
     */
    function _runMatterCmd(cmd) {
        dataService.runMatterCmd(cfg.store_url + cmd).then(function (response) {
        }, function (error) {
            alertify.alertError($scope._t('error_load_data') + '\n' + cmd);
        });
    }
    ;

    /**
     * Set matter data
     * @param {object} ZMatterAPIData
     */
    function setData(ZMatterAPIData) {
        var networkInformation = {
            mains: 0,
            battery: 0
        };
        var controllerNodeId = ZMatterAPIData.controller.data.nodeId.value;
        var networkSum = 0;
        /**
         * Loop through nodes
         */
        angular.forEach(ZMatterAPIData.devices, function (node, nodeId) {
            if (deviceService.notDevice(ZMatterAPIData, node, nodeId)) {
                return;
            }
            var report = [];
            var batteryCharge = '';
            var hasBattery = false;
            var allInterviewsDone = deviceService.allInterviewsDone(node.endpoints);
            if(!allInterviewsDone){
                report.push('txt_interview_not');
            }
            var isFailed = deviceService.isFailed(node);
            if(isFailed){
                report.push('txt_failed');
            }
            //console.log(nodeId,allInterviewsDone)
            var assocRemoved = deviceAssocRemoved(node, ZMatterAPIData);
            if (assocRemoved.length > 0) {
                report.push('txt_assoc_removed');
            }
            var isLocalyReset = deviceService.isLocalyReset(node);
             /**
             * Set network information
             */
            // Count mains devices
            if (!node.data.isSleepy.value) {
                networkInformation.mains++;
            }
            // Count battery devices
            else {
                if (node.endpoints[0].clusters[0x80]) {
                    batteryCharge = parseInt(node.endpoints[0].clusters[0x80].data.last.value);
                    if ( batteryCharge <= 20 && allInterviewsDone) {
                        report.push('txt_low_battery')
                    }
                }
                networkInformation.battery++;
            }

            var obj = {};
            obj['name'] = $filter('deviceName')(nodeId, node);
            obj['id'] = nodeId;
            obj['isController'] = controllerNodeId == nodeId;
            obj['report'] = report;
            obj['batteryCharge'] = batteryCharge;
            if(!$scope.home.devices[nodeId]){
                $scope.home.devices[nodeId] = obj;
            }
            if (isLocalyReset) {
             var findIndexR = _.findIndex($scope.home.localyReset, {id: obj.id});
             if (findIndexR > -1) {
             angular.extend($scope.home.localyReset[findIndexR], obj);

             } else {
             $scope.home.localyReset.push(obj);
             }
             }
        });

        for (var key in networkInformation) {
            networkSum += networkInformation[key];
        };
        $scope.home.networkSum = networkSum;
        $scope.home.networkInformation = networkInformation;
    }

    /**
     * Device changed vonfiguration
     */
    function deviceChangedConfig(ZMatterAPIData) {
        // Loop throught devices
        dataService.xmlToJson(cfg.server_url + '/config/Configuration.xml').then(function (response) {
            angular.forEach(response.config.devices.deviceconfiguration, function (cfg, cfgId) {
                var node = ZMatterAPIData.devices[cfg['_id']];
                if (!node || !$filter('hasNode')(node, 'endpoints.0.clusters.112')) {
                    return;
                }
                var nodeId = cfg['_id'];
                var array = JSON.parse(cfg['_parameter']);
                var cfgNum = 0;
                var cfgVal;
                var devVal;
                if (array.length > 2) {
                    cfgNum = array[0];
                    cfgVal = array[1];
                    if(node.endpoints[0].clusters[0x70] && node.endpoints[0].clusters[0x70].data[cfgNum]){
                        devVal = node.endpoints[0].clusters[0x70].data[cfgNum].val.value;
                    }
                    if ($scope.home.devices[nodeId] && (cfgVal != devVal)) {
                        if($scope.home.devices[nodeId].report.indexOf('device_changed_configuration') === -1){
                            $scope.home.devices[nodeId].report.push('device_changed_configuration');
                        }

                    }

                }
            });
        });
    }
    /**
     * Device assoc removed
     */
    function deviceAssocRemoved(node, ZMatterAPIData) {
        var assocDevices = [];
        var data;
        if (0x85 in node.endpoints[0].clusters) {
            var cc = node.endpoints[0].clusters[0x85].data;
            if (cc.groups.value >= 1) {
                for (var grp_num = 1; grp_num <= parseInt(cc.groups.value, 10); grp_num++) {
                    data = cc[grp_num];
                    for (var i = 0; i < data.nodes.value.length; i++) {
                        var targetNodeId = data.nodes.value[i];
                        if (!(targetNodeId in ZMatterAPIData.devices)) {
                            assocDevices.push(targetNodeId);
                        }
                    }

                }
            }
        }

        if (0x8e in node.endpoints[0].clusters) {
            var cc = node.endpoints[0].clusters[0x8e].data;
            if (cc.groups.value >= 1) {
                for (var grp_num = 1; grp_num <= parseInt(cc.groups.value, 10); grp_num++) {

                    data = cc[grp_num];

                    for (var i = 0; i < data.nodesInstances.value.length; i += 2) {
                        var targetNodeId = data.nodesInstances.value[i];
                        var targetInstanceId = data.nodesInstances.value[i + 1];
                        var endpointId = (targetInstanceId > 0 ? '.' + targetInstanceId : '');
                        if (!(targetNodeId in ZMatterAPIData.devices)) {
                            assocDevices.push(targetNodeId);
                        }

                    }
                }
            }
        }
        if (assocDevices.length > 0) {
            //console.log(assocDevices)
        }

        return assocDevices;
    }
});
