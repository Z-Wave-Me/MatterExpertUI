/**
 * @overview This controller renders and handles device statuses.
 * @author Martin Vach
 */

/**
 * Status root controller
 * todo: remove commented stuff
 * @class StatusController
 *
 */
appController.controller('StatusController', function ($scope, $filter, $timeout, $interval, dataService, cfg, _, deviceService) {
    $scope.statuses = {
        ids: [],
        all: [],
        interval: null,
        show: false
    };
    $scope.interviewCommandsDevice = [];
    $scope.interviewCommands = [];
    $scope.deviceInfo = {
        "index": null,
        "id": null,
        "name": null
    };
    $scope.ZMatterAPIData;
    $scope.interviewDeviceId = null;

    /**
     * Cancel interval on page destroy
     */
    $scope.$on('$destroy', function () {
        $interval.cancel($scope.statuses.interval);
    });


    /**
     * Load matter data
     */
    $scope.loadMatterData = function () {
        dataService.loadZMatterApiData().then(function (ZMatterAPIData) {
            $scope.ZMatterAPIData = ZMatterAPIData;
            setData(ZMatterAPIData);
            if (_.isEmpty($scope.statuses.all)) {
                $scope.alert = {
                    message: $scope._t('device_404'),
                    status: 'alert-warning',
                    icon: 'fa-exclamation-circle'
                };
                return;
            }
            $scope.statuses.show = true;
            $scope.refreshMatterData();
        }, function (error) {
            alertify.alertError($scope._t('error_load_data'));
        });
    };
    $scope.loadMatterData();

    /**
     * Refresh matter data
     */
    $scope.refreshMatterData = function () {
        var refresh = function () {
            dataService.loadJoinedMatterData().then(function (response) {
                //setData(response.data.joined);
                var update = false;
                angular.forEach(response.data.update, function(v, k) {
                    // Get node ID from response
                    var findId = k.split('.')[1];
                    // Check if node ID is in the available devices
                    if($scope.statuses.ids.indexOf(findId) > -1){
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
        $scope.statuses.interval = $interval(refresh, $scope.cfg.interval);
    };

    /**
     * Ping device
     * @param {string} url
     */
    $scope.pingDevice = function (url) {
        $scope.toggleRowSpinner(url);
        dataService.runMatterCmd(cfg.store_url + url).then(function (response) {
            $timeout($scope.toggleRowSpinner, 1000);
        }, function (error) {
            $scope.toggleRowSpinner();
            alertify.alertError($scope._t('error_update_data') + '\n' + url);
        });
    };

    /**
     * Ping all devices
     * @param {string} id
     * @param {string} urlType
     */
    $scope.pingAllDevices = function (id, urlType) {
        var lastItem = _.last($scope.statuses.all);
        $scope.toggleRowSpinner(id);
        angular.forEach($scope.statuses.all, function (v, k) {
            if (v.urlToStore) {
                $scope.toggleRowSpinner(v[urlType]);
                dataService.runMatterCmd(cfg.store_url + v[urlType]).then(function (response) {
                    alertify.dismissAll();
                }, function (error) {
                    alertify.dismissAll();
                    alertify.alertError($scope._t('error_update_data') + '\n' + v[urlType]);
                });

            }
            if (lastItem.rowId === v.rowId) {
                $timeout($scope.toggleRowSpinner, 1000);
            }
        });

    };

    /**
     * Handle modal interview
     * @param {string} target
     * @param $event - angular event
     * @param {int} index - object index
     * @param {object id} id
     * @param name
     */
    $scope.handleModalInterview = function (target, $event, index, id, name) {
        $scope.deviceInfo = {
            "index": index,
            "id": id,
            "name": name
        };
        $scope.interviewDeviceId = id;
        var node = $scope.ZMatterAPIData.devices[id];
        $scope.interviewCommands = deviceService.configGetInterviewCommands(node);
        $scope.handleModal(target, $event)

    };
    /**
     * Purge all command classes and start interview for a device
     * @param {string} cmd
     */
    $scope.interviewForceDevice = function (cmd) {
        $scope.runMatterCmd(cmd);
    };
    /// --- Private functions --- ///

    /**
     * Set matter data
     * @param {object} ZMatterAPIData
     */
    function setData(ZMatterAPIData) {
        //var controllerNodeId = ZMatterAPIData.controller.data.nodeId.value;
        // Loop throught devices
        angular.forEach(ZMatterAPIData.devices, function (node, nodeId) {
            if (deviceService.notDevice(ZMatterAPIData, node, nodeId)) {
                return;
            }
            var isSleepy = node.data.isSleepy.value;
            var isFailed = node.data.isFailed.value;
            var isAwake = node.data.isAwake.value;
            var prefixD = 'devices.' + nodeId + '.data.';
            var prefixIC = 'devices.' + nodeId + '.endpoints.0.clusters';
            var bindPath = prefixD + 'isFailed,' + prefixD + 'isAwake,' + prefixD + 'lastSend,' + prefixD + 'lastReceived,' + prefixD + 'queueLength,devices.' + nodeId + '.endpoints[*].clusters[*].data.interviewDone,' + prefixIC + '.' + 0x84 + '.data.lastWakeup,' + prefixIC + '.' + 0x84 + '.data.lastSleep,' + prefixIC + '.' + 0x84 + '.data.interval,' + prefixIC + '.' + 0x80 + '.data.last';

            var isController = (ZMatterAPIData.controller.data.nodeId.value == nodeId);
            var lastReceive = parseInt(node.data.lastReceived.updateTime, 10) || 0;
            var lastSend = parseInt(node.data.lastSend.updateTime, 10) || 0;
            var lastCommunication = (lastSend > lastReceive) ? lastSend : lastReceive;
            var sleepingSince = 0;
            var lastWakeup = 0;
            var interval = 0;
            var type = deviceService.deviceType(node);
            var sleeping;
            if (isSleepy) {

                sleepingSince = parseInt(node.endpoints[0].clusters[0x84].data.lastSleep.value, 10);
                lastWakeup = parseInt(node.endpoints[0].clusters[0x84].data.lastWakeup.value, 10);
                interval = parseInt(node.endpoints[0].clusters[0x84].data.interval.value, 10);
                //hasSleeping = getSleeping(sleepingSince, lastWakeup, interval);
                sleeping = setSleeping(sleepingSince, lastWakeup, interval);
            }

            var obj = {};
            obj['id'] = nodeId;
            obj['idSort'] = $filter('zeroFill')(nodeId);
            obj['rowId'] = 'row_' + nodeId;
            obj['isController'] = isController;
            obj['cmd'] = bindPath.split(',');
            obj['name'] = $filter('deviceName')(nodeId, node);
            obj['sleeping'] = sleeping;
            obj['updateTime'] = lastCommunication;
            obj['dateTime'] = $filter('getDateTimeObj')(lastCommunication);
            obj['isFailed'] = node.data.isFailed.value;
            obj['type'] = type;
            obj['icon'] = $filter('getDeviceTypeIcon')(type);
            obj['urlToStore'] = !isSleepy ? 'devices[' + nodeId + '].SendNoOperation()' : false;
            obj['interviewDone'] = interviewDone(node);
            var findIndex = _.findIndex($scope.statuses.all, {rowId: obj.rowId});
            if (findIndex > -1) {
                //console.log('Updating nodeId: ',obj.rowId);
                angular.extend($scope.statuses.all[findIndex], obj);

            } else {
                $scope.statuses.all.push(obj);
            }
            if( $scope.statuses.ids.indexOf(nodeId) === -1){
                $scope.statuses.ids.push(nodeId);
            }
            $scope.interviewCommandsDevice.push(node.data);
        });
    }

    /**
     * Check if is an interview done
     * @param {object} node
     * @returns {boolean}
     */
    function interviewDone(node) {
        var interview_cont = true;
        if (node.data.nodeInfoFrame.value && node.data.nodeInfoFrame.value.length) {
            for (var iId in node.endpoints)
                for (var ccId in node.endpoints[iId].clusters)
                    if (!node.endpoints[iId].clusters[ccId].data.interviewDone.value) {
                        interview_cont = false;
                    }
        } else {
            interview_cont = false;
        }
        return interview_cont;

    }

    /**
     * Set sleeping data
     * @param {int} sleepingSince
     * @param {int} lastWakeup
     * @param {int} interval
     * @returns {string}
     */
    function setSleeping(sleepingSince, lastWakeup, interval) {
        var sleeping = {
            approx: false,
            lastSleep: '',
            nextWakeup: ''
        };
        if (isNaN(sleepingSince) || sleepingSince < lastWakeup) {
            sleepingSince = lastWakeup
            if (!isNaN(lastWakeup)) {
                sleeping.approx = '~';
            }

        }
        ;
        // to indicate that interval and hence next wakeup are unknown
        if (interval == 0) {
            interval = NaN;
        }
        sleeping.lastSleep = $filter('isTodayFromUnix')(sleepingSince);
        sleeping.nextWakeup = $filter('isTodayFromUnix')(sleepingSince + interval);
        return sleeping;
    }
});