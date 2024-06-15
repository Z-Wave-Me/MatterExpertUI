/**
 * UzbController
 * @author Martin Vach
 */
appController.controller('UzbController', function ($scope, $timeout, $window, cfg, dataService, deviceService) {
    $scope.uzbUpgrade = [];
    $scope.uzbFromUrl = [];
    $scope.alert = {message: false, status: 'is-hidden', icon: false};
    $scope.token = {
        input:{
            token: ''
        },
        load: false
    };
    /**
     * Load data
     *
     */
    $scope.loadMatterData = function (token) {
        dataService.loadZMatterApiData().then(function(ZMatterAPIData) {
            $scope.token.load = token;
            var vendorId = parseInt(ZMatterAPIData.controller.data.manufacturerId.value, 10);
            //0x0115 = 277, 0x0147 = 327
            // Todo: add vendor white list to config
            var allowedVendors = [0, 277, 327];
            if (allowedVendors.indexOf(vendorId) === -1) {
                $scope.alert = {
                    message: $scope._t('noavailable_firmware_update'),
                    status: 'alert-info',
                    icon: 'fa-info-circle'
                };
                return;
            }
            $scope.currentVersion = ZMatterAPIData.controller.data.APIVersion.value.replace(/^0+/, '');
            $scope.bootloaderVersion = ZMatterAPIData.controller.data.bootloader.crc.value;
            var tokenParam = (token ? '&token=' + token : '');
            var appVersion = ZMatterAPIData.controller.data.APIVersion.value.split('.');
            var appVersionMajor = parseInt(appVersion[0], 10);
            var appVersionMinor = parseInt(appVersion[1], 10);
            var bootloaderCRC = ZMatterAPIData.controller.data.bootloader.crc.value;
            var urlParams = '?vendorId=' + vendorId + '&appVersionMajor=' + appVersionMajor + '&appVersionMinor=' + appVersionMinor+ '&bootloaderCRC=' + bootloaderCRC + tokenParam + '&zmatter=' + ZMatterAPIData.controller.data.softwareRevisionVersion.value + '&uuid=' + ZMatterAPIData.controller.data.uuid.value;
            //return;
            // Load uzb
            loadUzb(urlParams);
        });
    };
    $scope.loadMatterData();

    // Upgrade bootloader/firmware
    $scope.upgrade = function (action, url) {
        $scope.toggleRowSpinner(action);
        var cmd = $scope.cfg.server_url + cfg[action];
        var data = {
            url: url
        };
        $scope.alert = {
            message: $scope._t('upgrade_bootloader_proccess'),
            status: 'alert-warning',
            icon: 'fa-spinner fa-spin'
        };
        dataService.updateUzb(cmd, data).then(function (response) {
            deviceService.showNotifier({message: $scope._t('reloading')});
            $scope.alert = false;
            $timeout(function () {
                $scope.toggleRowSpinner();
                $window.location.reload();
            }, 2000);
        }, function (error) {
            $scope.alert = false;
            $timeout($scope.toggleRowSpinner, 1000);
            alertify.alertError($scope._t('error_update_data') + '\n' + cmd);

        });
    };

    /**
     * Upload a firmware/bootloader file
     * @param {object} files
     * @returns {undefined}
     */
    $scope.uploadFile = function (action, files) {
        // Form data init
        var fd = new FormData();
        if (!fd) {
            return;
        }
        $scope.toggleRowSpinner(action);
        var cmd = $scope.cfg.server_url + cfg[action];
        fd.append('file', files[0]);

        $scope.alert = {
            message: $scope._t('upgrade_bootloader_proccess'),
            status: 'alert-warning',
            icon: 'fa-spinner fa-spin'
        };
        dataService.uploadApiFile(cmd, fd).then(function (response) {
            deviceService.showNotifier({message: $scope._t('reloading')});
            $scope.alert = false;
            $timeout(function () {
                $scope.toggleRowSpinner();
                $window.location.reload();
            }, 2000);
        }, function (error) {
            $scope.alert = false;
            $timeout($scope.toggleRowSpinner, 1000);
            alertify.alertError($scope._t('error_update_data') + '\n' + cmd);
        });
    };

    /**
     * Add token
     * @param {object} input
     */
    $scope.addToken = function (input) {
        /*if (input.token === '') {
            return;
        }*/
        $scope.toggleRowSpinner('add_token');
        $scope.loadMatterData(input.token);

        $timeout(function () {
            $scope.toggleRowSpinner();
        }, 1000);


    };

    /// --- Private functions --- ///

    /**
     * Load uzb data
     */
    function loadUzb(urlParams) {
        //$scope.alert = {message: $scope._t('loading_data_remote'), status: 'alert-warning', icon: 'fa-spinner fa-spin'};
        $scope.loading = {status: 'loading-spin', icon: 'fa-spinner fa-spin'};
        dataService.getUzb(urlParams).then(function (response) {
            if (response.length > 0) {
                $scope.uzbUpgrade = response;

            }else{
                $scope.alert = {
                    message: $scope._t('noavailable_firmware_update'),
                    status: 'alert-info',
                    icon: 'fa-info-circle'
                };
            }
            $scope.loading = false;
        }, function (error) {
            $scope.loading = false;
            alertify.alertError($scope._t('error_handling_data_remote'));
        });
    }
    ;

});
