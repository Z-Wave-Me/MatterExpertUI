/**
 * Application ControllerInfo controller
 * @author Martin Vach
 */
appController.controller('ControllerController', function($scope, $window, $filter, $interval,$timeout,cfg,dataService,deviceService) {
    $scope.funcList;
    $scope.ZMatterAPIData;
    $scope.builtInfo = '';
    $scope.info = {};
    $scope.master = {};
    $scope.runQueue = false;
    $scope.controllerInfo = {
        interval: null
    }

    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function() {
        $interval.cancel($scope.controllerInfo.interval);
    });
    /**
     * Load app built info
     */
    $scope.loadAppBuiltInfo = function() {
        dataService.getAppBuiltInfo().then(function(response) {
            $scope.builtInfo = response.data;
        }, function(error) {});
    };
    $scope.loadAppBuiltInfo();

    /**
     * Load matter data
     */
    $scope.loadMatterData = function() {
        dataService.loadZMatterApiData().then(function(ZMatterAPIData) {
            setData(ZMatterAPIData);
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
                setData(response.data.joined);
            });
        };
        $scope.controllerInfo.interval = $interval(refresh, $scope.cfg.interval);
    };
    
     /**
     *
     * Set debug mode
     */
    $scope.setDebugMode = function(status,spin) {
        var input = {
            debug: status
        };
        $scope.toggleRowSpinner(spin);
        dataService.postApi('configupdate_url', input).then(function (response) {
             $timeout($scope.toggleRowSpinner, 1000);
            $scope.loadMatterConfig(true);
        }, function (error) {
            $scope.toggleRowSpinner();
            alertify.alertError($scope._t('error_update_data'));
            return;
        });
    };

    /// --- Private functions --- ///
    /**
     * Set matter data
     * @param {object} ZMatterAPIData
     */
    function setData(ZMatterAPIData) {
        var nodeLimit = function(str) {
            return str === 'ff' ? $scope._t('unlimited') : str;
        };
        var caps = function(arr) {
            var cap = '';
            if (angular.isArray(arr)) {
                cap += (arr[3] & 0x01 ? 'S' : 's');
                cap += (arr[3] & 0x02 ? 'L' : 'l');
                cap += (arr[3] & 0x04 ? 'M' : 'm');
            }
            return cap;

        };
        $scope.ZMatterAPIData = ZMatterAPIData;
        $scope.master['controller.data.nodeId'] = ZMatterAPIData.controller.data.nodeId.value;
        $scope.master['controller.data.panId'] = ZMatterAPIData.controller.data.panId.value;
        $scope.master['controller.data.radioManufacturer'] = ZMatterAPIData.controller.data.radioManufacturer.value;
        $scope.master['controller.data.radioBoardName'] = ZMatterAPIData.controller.data.radioBoardName.value;
        $scope.master['controller.data.EzspVersion'] = ZMatterAPIData.controller.data.EzspVersion.value;
        $scope.master['controller.data.APIVersion'] = ZMatterAPIData.controller.data.EmberZNetVersionMajor.value + "." + ZMatterAPIData.controller.data.EmberZNetVersionMinor.value;
        // TBD $scope.master['controller.data.uuid'] = ZMatterAPIData.controller.data.uuid.value;
        // TBD $scope.master['controller.data.uuid16'] = ZMatterAPIData.controller.data.uuid.value ? ZMatterAPIData.controller.data.uuid.value.substring(16) : null;
        /* TBD
        if (ZMatterAPIData.controller.data.firmware.caps.maxNodes.value) {
            $scope.master['controller.data.firmware.caps.subvendor'] = '0x' + dec2hex((ZMatterAPIData.controller.data.firmware.caps.value[0] << 8) + ZMatterAPIData.controller.data.firmware.caps.value[1]);
            $scope.master['controller.data.firmware.caps.nodes'] = ZMatterAPIData.controller.data.firmware.caps.maxNodes.value;
            $scope.master['controller.data.firmware.caps.staticApi'] = ZMatterAPIData.controller.data.firmware.caps.staticApi.value;
            $scope.master['controller.data.firmware.caps.maxPower'] = ZMatterAPIData.controller.data.firmware.caps.maxPower.value;
            $scope.master['controller.data.firmware.caps.backup'] = ZMatterAPIData.controller.data.firmware.caps.backup.value;
            $scope.master['controller.data.firmware.caps.wup'] = ZMatterAPIData.controller.data.firmware.caps.wup.value;
            $scope.master['controller.data.firmware.caps.advancedIMA'] = ZMatterAPIData.controller.data.firmware.caps.advancedIMA.value;
            $scope.master['controller.data.firmware.caps.longRange'] = ZMatterAPIData.controller.data.firmware.caps.longRange.value;
            $scope.master['controller.data.firmware.caps.ultraUART'] = ZMatterAPIData.controller.data.firmware.caps.ultraUART.value;
            $scope.master['controller.data.firmware.caps.swapSubvendor'] = ZMatterAPIData.controller.data.firmware.caps.swapSubvendor.value;
            $scope.master['controller.data.firmware.caps.promisc'] = ZMatterAPIData.controller.data.firmware.caps.promisc.value;
            $scope.master['controller.data.firmware.caps.zniffer'] = ZMatterAPIData.controller.data.firmware.caps.zniffer.value;
            $scope.master['controller.data.firmware.caps.jammingDetection'] = ZMatterAPIData.controller.data.firmware.caps.jammingDetection.value;
            $scope.master['controller.data.firmware.caps.pti'] = ZMatterAPIData.controller.data.firmware.caps.pti.value;
            $scope.master['controller.data.firmware.caps.modem'] = ZMatterAPIData.controller.data.firmware.caps.modem.value;
        } else {
            if (ZMatterAPIData.controller.data.firmware.caps.value) {
                $scope.master['controller.data.firmware.caps.subvendor'] = '0x' + dec2hex((ZMatterAPIData.controller.data.firmware.caps.value[0] << 8) + ZMatterAPIData.controller.data.firmware.caps.value[1]);
                $scope.master['controller.data.firmware.caps.nodes'] = nodeLimit(dec2hex(ZMatterAPIData.controller.data.firmware.caps.value[2]).slice(-2));
                $scope.master['controller.data.firmware.caps.cap'] = caps(ZMatterAPIData.controller.data.firmware.caps.value);
            }
        }
        */
        $scope.master['controller.data.softwareRevisionVersion'] = ZMatterAPIData.controller.data.softwareRevisionVersion.value;
        //$scope.master['controller.data.firmware.caps.crc.value'] = ZMatterAPIData.controller.data.firmware.caps.crc.value;
        $scope.master['controller.data.softwareRevisionId'] = ZMatterAPIData.controller.data.softwareRevisionId.value;
        $scope.master['controller.data.softwareRevisionDate'] = ZMatterAPIData.controller.data.softwareRevisionDate.value;
        $scope.master['controller.data.softwareRevisionDate'] = ZMatterAPIData.controller.data.softwareRevisionDate.value;

        /* TBD
        // Function list
        var funcList = '';
        var _fc = array_unique(ZMatterAPIData.controller.data.capabilities.value.concat(ZMatterAPIData.controller.data.functionClasses.value));
        _fc.sort(function(a, b) {
            return a - b
        });

        angular.forEach(_fc, function(func, index) {
            var fcIndex = ZMatterAPIData.controller.data.functionClasses.value.indexOf(func);
            var capIndex = ZMatterAPIData.controller.data.capabilities.value.indexOf(func);
            var fcName = (fcIndex != -1) ? ZMatterAPIData.controller.data.functionClassesNames.value[fcIndex] : 'Not implemented';
            funcList += '<span style="color: ' + ((capIndex != -1) ? ((fcIndex != -1) ? '' : 'gray') : 'red') + '">' + fcName + ' (0x' + ('00' + func.toString(16)).slice(-2) + ')</span>  &#8226; ';
        });
        $scope.funcList = funcList;
        */
    }
    function dec2hex(i)
    {
        //return  ("0"+(Number(i).toString(16))).slice(-2).toUpperCase()
        var result = "0000";
        if (i >= 0 && i <= 15) {
            result = "000" + i.toString(16);
        }
        else if (i >= 16 && i <= 255) {
            result = "00" + i.toString(16);
        }
        else if (i >= 256 && i <= 4095) {
            result = "0" + i.toString(16);
        }
        else if (i >= 4096 && i <= 65535) {
            result = i.toString(16);
        }
        return result;
    }
});
