/**
 * @overview This controller renders and handles device configuration stuff.
 * @author Martin Vach
 */

/**
 * Device configuration configuration controller
 * @class ConfigConfigurationController
 *
 */
appController.controller('ConfigConfigurationController', function ($scope, $routeParams, $location, $cookies, $filter, $http, $timeout, $route, $interval,cfg, dataService, deviceService, myCache, _) {
    $scope.devices = [];
    $scope.deviceId = 0;
    //$scope.activeTab = 'configuration';
    $scope.activeUrl = 'configuration/configuration/';
    $cookies.tab_config = 'configuration';
    $scope.reset = function () {
        $scope.devices = angular.copy([]);
    };
    // Config vars
    $scope.hasConfigurationCc = false;
    $scope.modelSelectZddx = false;
    $scope.deviceZddx = [];
    $scope.configCont;
    $scope.switchAllCont;
    $scope.protectionCont;
    $scope.wakeupCont;

    $scope.configInterval = null;

    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function() {
        $interval.cancel($scope.configInterval);
    });

    // Redirect to device
    $scope.redirectToDevice = function (deviceId) {
        if (deviceId) {
            $location.path($scope.activeUrl + deviceId);
        }
    };

    // Load data
    $scope.loadMatterData = function (nodeId) {
        dataService.loadZMatterApiData().then(function(ZMatterAPIData) {
            $scope.ZMatterAPIData = ZMatterAPIData;
            $scope.devices = deviceService.configGetNav(ZMatterAPIData);
            if(_.isEmpty($scope.devices)){
                $scope.alert = {message: $scope._t('device_404'), status: 'alert-warning', icon: 'fa-exclamation-circle'};
                return;
            }
            var node = ZMatterAPIData.devices[nodeId];
            if (!node || deviceService.notDevice(ZMatterAPIData, node, nodeId)) {
                return;
            }

            $scope.getNodeDevices = function () {
                var devices = [];
                angular.forEach($scope.devices, function (v, k) {
                    if (devices_htmlSelect_filter($scope.ZMatterAPIData, 'span', v.id, 'node')) {
                        return;
                    }
                    devices.push(v);
                });
                //console.log(devices)
                return devices;
            };

            $cookies.configuration_id = nodeId;
            $cookies.config_url = $scope.activeUrl + nodeId;
            $scope.deviceId = nodeId;
            $scope.deviceName = $filter('deviceName')(nodeId, node);

            setData(ZMatterAPIData, nodeId);
            if(!$scope.hasConfigurationCc){
                $scope.refreshMatterData($routeParams.nodeId);
            }


        });
    };
    $scope.loadMatterData($routeParams.nodeId);

    /**
     * Refresh matter data
     */
    $scope.refreshMatterData = function (nodeId) {
        var refresh = function() {
            dataService.loadJoinedMatterData(null).then(function(response) {
                var updateData = false;
                var searchStr = 'devices.' + $routeParams.nodeId + '.'
                angular.forEach(response.data.update, function(v, k) {
                    if (k.indexOf(searchStr) !== -1) {
                        updateData = true;
                        return;
                    }
                });
                if (updateData) {
                    //$scope.loadMatterData($routeParams.nodeId, false);
                    setData(response.data.joined,nodeId);
                }
                //setData(response.data.joined,nodeId);
            }, function(error) {});
        };
        $scope.configInterval = $interval(refresh, $scope.cfg.interval);
    };



    /**
     * Update from device action
     *
     * @param {string} cmd
     * @returns {undefined}
     */
    $scope.updateFromDevice = function (cmd, hasBattery, deviceId, form,spin) {
        if (hasBattery) {
            deviceService.showNotifier({message: $scope._t('conf_apply_battery'),type: 'warning'});
        }
        $scope.toggleRowSpinner(spin);
        dataService.runMatterCmd(cfg.store_url + cmd);
        //$scope.refreshMatterData(deviceId);

        $('#' + form + ' .cfg-control-content :input').prop('disabled', true);
        $timeout(function () {
            $scope.toggleRowSpinner();
           //$interval.cancel($scope.configInterval);
            $scope.loadMatterData($routeParams.nodeId);
            $('#' + form + ' .cfg-control-content :input').prop('disabled', false);
        }, 3000);
        return;
    };

    /**
     * Update from device - configuration section
     */
    $scope.updateFromDeviceCfg = function (cmd, config, deviceId, form,spin) {
        var request = cfg.store_url + cmd;
        $scope.toggleRowSpinner(spin);
        angular.forEach(config, function (v, k) {
            if (v.confNum) {
                dataService.runMatterCmd(request + '(' + v.confNum + ')');
            }
        });
        //$scope.refreshMatterData(deviceId);
        $('#' + form + ' .cfg-control-content :input').prop('disabled', true);
        $timeout(function () {
           //$interval.cancel($scope.configInterval);
            $scope.loadMatterData($routeParams.nodeId);
            $scope.toggleRowSpinner();
        }, 3000);
        return;
    };

    /**
     * Set all values to default
     */
    $scope.setAllToDefault = function (cmd, cfgValues, hasBattery, form,spin) {
        var dataArray = {};
        angular.forEach(cfgValues, function (v, k) {
            dataArray[v.confNum] = {
                value: $filter('setConfigValue')(v.showDefaultValue),
                name: v.name
                //cfg: v
            };
        });
        //console.log(dataArray)
        $scope.submitApplyConfigCfg(form, cmd, cfgValues, hasBattery, false, false, dataArray,spin);

    };


    /**
     * Apply Config action
     */
    $scope.submitApplyConfigCfg = function (form, cmd, cfgValues, hasBattery, confNum, setDefault, hasData,spin) {
        var xmlData = [];
        var configValues = [];
        if (hasBattery) {
            //alert($scope._t('conf_apply_battery'));
            deviceService.showNotifier({message: $scope._t('conf_apply_battery'),type: 'warning'});
        }

        var dataArray = _.isObject(hasData) ? hasData : {};
        $scope.toggleRowSpinner(spin);
        //var bitrangeCnt = [];
        var bitcheckCnt = [];
        if (!_.isObject(hasData)) {
            data = $('#' + form).serializeArray();
            //console.log(data)
            //console.log(data)
            angular.forEach(data, function (v, k) {
                if (v.value === 'N/A') {
                    return;
                }
                var value = $filter('setConfigValue')(v.value);
                var inputConfNum = v.name.match(/\d+$/)[0];
                if (!inputConfNum) {
                    return;
                }
                var inputType = v.name.split('_')[0];
                var cfg = _.findWhere(cfgValues, {confNum: inputConfNum.toString()});
                if (cfg) {
                    if ('bitset' in cfg.type) {
                         if (inputType === 'bitrange') {
                             value = (value === '' ? 0 : parseInt(value));
                             if(value < 1){
                                 return;
                             }
                            var bitRange = _.findWhere(cfg.type.bitset, {name: v.name});
                             if (value < bitRange.type.bitrange.bit_from && value > 0) {
                                 value = bitRange.type.bitrange.bit_from;
                             } else if (value > bitRange.type.bitrange.bit_to) {
                                 value = bitRange.type.bitrange.bit_to;
                             }
                             value = Math.pow(2, value);
                             //var bitArray = $filter('getBitArray')(value, 8);

                             /*if(!bitrangeCnt[inputConfNum]){
                                 bitrangeCnt[inputConfNum] = 0;
                             }
                             bitrangeCnt[inputConfNum] = (value === '' ? 0 : parseInt(value));
                            if (value < bitRange.type.bitrange.bit_from && value > 0) {
                                bitrangeCnt[inputConfNum] += bitRange.type.bitrange.bit_from;
                                value = bitrangeCnt[inputConfNum];
                            } else if (value > bitRange.type.bitrange.bit_to) {
                                bitrangeCnt[inputConfNum] += bitRange.type.bitrange.bit_to;
                                value = bitrangeCnt[inputConfNum];
                            }*/
                            /*value = (value === '' ? 0 : parseInt(value));
                            if (value < bitRange.type.bitrange.bit_from && value > 0) {
                                value = bitRange.type.bitrange.bit_from;
                            } else if (value > bitRange.type.bitrange.bit_to) {
                                value = bitRange.type.bitrange.bit_to;
                            }*/
                        } else {
                             value = (value === '' ? 0 : parseInt(value));
                            if(!bitcheckCnt[inputConfNum]){
                                bitcheckCnt[inputConfNum] = 0;
                            }
                            bitcheckCnt[inputConfNum] += Math.pow(2, value);
                            value =  bitcheckCnt[inputConfNum];

                            //value = Math.pow(2, value);

                        }

                    }
                }
                if (dataArray[inputConfNum]) {
                    //dataArray[inputConfNum].value += ',' + value;
                    dataArray[inputConfNum].value = value;
                } else {
                    dataArray[inputConfNum] = {
                        value: value,
                        name: v.name
                        //cfg: cfg
                    };


                }

            });
        }
        angular.forEach(dataArray, function (n, nk) {
            var obj = {};
            var parameter;
            var lastNum = n.name.match(/\d+$/);
            if (!lastNum) {
                return;
            }

            var num = lastNum[0];
            //console.log('num', num)
            var confSize = 0;
            var value = n.value;

            if (angular.isObject(setDefault) && setDefault.confNum == num) {
                value = setDefault.showDefaultValue;
            }
            configValues.push(value)
            angular.forEach(cfgValues, function (cv, ck) {
                if (!cv) {
                    return;
                }
                if (cv.confNum == num) {
                    confSize = cv.confSize;
                }


            });
            if (num > 0) {
                parameter = num + ',' + value + ',' + confSize;
            } else {
                parameter = value;
            }

            obj['id'] = cmd['id'];
            obj['endpoint'] = cmd['endpoint'];
            obj['cluster'] = cmd['cluster'];
            obj['command'] = cmd['command'];
            obj['parameter'] = '[' + parameter + ']';
            obj['parameterValues'] = parameter;
            obj['confNum'] = num;

            xmlData.push(obj);


        });
        //console.log(xmlData)
        //return;

        // Send command
        var request = 'devices[' + cmd.id + '].endpoints[' + cmd.endpoint + '].clusters[0x' + cmd.cluster + '].';
        switch (cmd['cluster']) {
            case '70':// Config
                angular.forEach(xmlData, function (v, k) {

                    var configRequest = request;
                    configRequest += cmd.command + '(' + v.parameterValues + ')';
                    if (confNum) {
                        if (confNum == v.confNum) {
                            dataService.runMatterCmd(cfg.store_url + configRequest);
                        }
                    } else {
                        dataService.runMatterCmd(cfg.store_url + configRequest);
                    }

                });
                break;
            case '75':// Protection
                request += cmd.command + '(' + configValues.join(",") + ')';
                dataService.runMatterCmd(cfg.store_url + request);
                break;
            case '84':// Wakeup
                request += cmd.command + '(' + configValues.join(",") + ')';
                dataService.runMatterCmd(cfg.store_url + request);
                break;
            case '27':// Switch all
                request += cmd.command + '(' + configValues.join(",") + ')';
                dataService.runMatterCmd(cfg.store_url + request);
                break;
            default:
                break;
        }

        dataService.getCfgXml().then(function (cfgXml) {
            var xmlFile = deviceService.buildCfgXml(xmlData, cfgXml, cmd['id'], cmd['cluster']);
            dataService.putCfgXml(xmlFile);
        });


        //$scope.refreshMatterData(cmd['id']);
        if (confNum) {
            $('#cfg_control_' + confNum + ' :input').prop('disabled', true);
        } else {
            $('#' + form + ' .cfg-control-content :input').prop('disabled', true);
        }
        $timeout(function () {
            $scope.loadMatterData($routeParams.nodeId);
            $('#' + form + ' .cfg-control-content :input').prop('disabled', false);
           //$interval.cancel($scope.configInterval);
            $scope.toggleRowSpinner();
        }, 3000);
        return;
    };

    /**
     * Set Wakeup and Protection
     */
    $scope.storeSettings = function (form, cmd, hasBattery,spin) {
        // Show a notifier for battery operated device
        if (hasBattery) {
            deviceService.showNotifier({message: $scope._t('conf_apply_battery'),type: 'warning'});
        }
        $scope.toggleRowSpinner(spin);

        var xmlData = [];
        var data = $('#' + form).serializeArray();
        var paramArr = [];
        var parameter;
        var request = 'devices[' + cmd.id + '].endpoints[' + cmd.endpoint + '].clusters[0x' + cmd.cluster + '].';
        var cnt =0;
        angular.forEach(data, function (v, k) {
            cnt++;
            v.value = parseInt(v.value);
            // There must be two params
            if(cnt < 3){
                paramArr.push(v.value);
            }

        });
        parameter = paramArr.join(',');
        // Data for XML
        var obj = {};
        obj['id'] = cmd['id'];
        obj['endpoint'] = cmd['endpoint'];
        obj['cluster'] = cmd['cluster'];
        obj['command'] = cmd['command'];
        obj['parameter'] = '[' + parameter + ']';
        obj['parameterValues'] = parameter;
        obj['confNum'] = 0;
        xmlData.push(obj);

        // Load a XML
        dataService.getCfgXml().then(function (cfgXml) {
            var xmlFile = deviceService.buildCfgXml(xmlData, cfgXml, cmd['id'], cmd['cluster']);
            dataService.putCfgXml(xmlFile);
        });

        // Run matter command
        request += cmd.command + '(' + parameter + ')';
        dataService.runMatterCmd(cfg.store_url + request);
        $('#' + form + ' .cfg-control-content :input').prop('disabled', true);

        // Reload data and remove spinner
        $timeout(function () {
            $scope.loadMatterData($routeParams.nodeId);
            $('#' + form + ' .cfg-control-content :input').prop('disabled', false);
            $scope.toggleRowSpinner();
        }, 3000);
    };


    /// --- Private functions --- ///
    /**
     * Set matter data
     */
    function setData(ZMatterAPIData, nodeId) {
        var node = ZMatterAPIData.devices[nodeId];
        if (!node) {
            return;
        }
        $scope.showDevices = true;
        $scope.deviceName = $filter('deviceName')(nodeId, node);
        $scope.deviceNameId = $filter('deviceName')(nodeId, node) + ' (#' + nodeId + ')';
        $scope.hasBattery = 0x80 in node.endpoints[0].clusters;
        var zddXmlFile = null;
        if (angular.isDefined(node.data.ZDDXMLFile)) {
            zddXmlFile = node.data.ZDDXMLFile.value;
            $scope.deviceZddxFile = node.data.ZDDXMLFile.value;
        }
        $scope.interviewCommands = deviceService.configGetInterviewCommands(node, ZMatterAPIData.updateTime);
        $scope.interviewCommandsDevice = node.data;
        new Promise(function (resolve) {
            resolve(zddXmlFile)
        }).then(function (configName) {
                if (configName) {
                    return myCache.get(zddXmlFile) || $http.get($scope.cfg.server_url + $scope.cfg.zddx_url + configName)
                        .then(function (response) {
                            const zddXml = new X2JS().xml_str2json(response.data);
                            myCache.put(zddXmlFile, zddXml);
                            return zddXml
                        }).catch(function (error) {
                            return null;
                        })
                }
                return null
            }
        ).then(function (config) {
            setCont(node, nodeId, config, ZMatterAPIData);
        })
        // TODO Deprecated to remove 8/12/2021
        // if (zddXmlFile && zddXmlFile !== 'undefined') {
        //     var cachedZddXml = myCache.get(zddXmlFile);
        //     // Uncached file
        //     if (!cachedZddXml) {
        //         $http.get($scope.cfg.server_url + $scope.cfg.zddx_url + zddXmlFile).then(function (response) {
        //             var x2js = new X2JS();
        //             var zddXml = x2js.xml_str2json(response.data);
        //             myCache.put(zddXmlFile, zddXml);
        //             setCont(node, nodeId, zddXml, ZMatterAPIData);
        //         },
        //             function (error) {
        //                 setCont(node, nodeId, null, ZMatterAPIData);
        //             });
        //     } else {
        //         setCont(node, nodeId, cachedZddXml, ZMatterAPIData);
        //     }
        // } else {
        //     setCont(node, nodeId, null, ZMatterAPIData);
        // }
    }
    /**
     * Set all conts
     */
    function setCont(node, nodeId, zddXml, ZMatterAPIData) {
        if (!zddXml) {
            $scope.noZddx = true;
            // Loop throught endpoints
            angular.forEach(node.endpoints, function (endpoint, endpointId) {
                if (endpoint.clusters[112]) {
                    $scope.hasConfigurationCc =  configurationCc(endpoint.clusters[112], endpointId,nodeId, ZMatterAPIData);
                }
            });
        }
        dataService.getCfgXml().then(function (cfgXml) {
            $scope.configCont = deviceService.configConfigCont(node, nodeId, zddXml, cfgXml, $scope.lang, $scope.languages);
            $scope.wakeupCont = deviceService.configWakeupCont(node, nodeId, ZMatterAPIData, cfgXml);
            $scope.protectionCont = deviceService.configProtectionCont(node, nodeId, ZMatterAPIData, cfgXml);
            $scope.switchAllCont = deviceService.configSwitchAllCont(node, nodeId, ZMatterAPIData, cfgXml);
            if (!$scope.configCont && !$scope.wakeupCont && !$scope.protectionCont && !$scope.switchAllCont) {
                $scope.alert = {message: $scope._t('configuration_not_supported'), status: 'alert-warning', icon: 'fa-exclamation-circle'};
            }

        }, function(error) {
            var cfgXml = {};
            $scope.configCont = deviceService.configConfigCont(node, nodeId, zddXml, cfgXml, $scope.lang, $scope.languages);
            $scope.wakeupCont = deviceService.configWakeupCont(node, nodeId, ZMatterAPIData, cfgXml);
            $scope.protectionCont = deviceService.configProtectionCont(node, nodeId, ZMatterAPIData, cfgXml);
            $scope.switchAllCont = deviceService.configSwitchAllCont(node, nodeId, ZMatterAPIData, cfgXml);
            if (!$scope.configCont && !$scope.wakeupCont && !$scope.protectionCont && !$scope.switchAllCont) {
              $scope.alert = {message: $scope._t('no_device_service'), status: 'alert-warning', icon: 'fa-exclamation-circle'};
          }
        });
    }
    function configurationCc(cluster, endpointId,nodeId, ZMatterAPIData) {
        var ccId = 112;
        var methods = getMethodSpec(ZMatterAPIData, nodeId, endpointId, ccId, null);
        var command = deviceService.configGetCommands(methods, ZMatterAPIData);
        var obj = {};
        obj['nodeId'] = nodeId;
        obj['rowId'] = 'row_' + nodeId + '_' + endpointId + '_' + ccId;
        obj['endpointId'] = endpointId;
        obj['ccId'] = ccId;
        obj['cmd'] = 'devices[' + nodeId + '].endpoints[' + endpointId + '].clusters[' + ccId + ']';
        obj['cmdData'] = ZMatterAPIData.devices[nodeId].endpoints[endpointId].clusters[ccId].data;
        obj['cmdDataIn'] = ZMatterAPIData.devices[nodeId].endpoints[endpointId].data;
        obj['cluster'] = cluster.name;
        obj['command'] = command;
        obj['updateTime'] = ZMatterAPIData.updateTime;
        return obj;
    }
});
