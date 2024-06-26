angApp.directive('matterMoreOptions', function (dataService, _, $http) {
  return {
    restrict: 'E',
    transclude: true,
    template: `
      <a ng-href="https://z-wave.me/hardware-capabilities/?uuid={{matterMoreOptionsUUID}}" target="_blank">{{_t('getMoreOptions')}} <i class="fas fa-external-link-alt"></i></a>
      <div ng-if="true || updatable">
        <span class="help-text" style="display: inline"><i class="fa text-info fa-info-circle"></i> {{_t('newLicenceAvailable')}}</span>
        <button class="btn btn-primary" ng-click="setLicense()">{{_t('btn_licence_verify')}}</button>
      </div>
    `,
    link: function ($scope) {
      $scope.matterMoreOptionsUUID = $scope.master['controller.data.uuid'].replace(/^0+/, '');
      const currentCrc = $scope.master['controller.data.firmware.caps.crc.value'];
      $scope.updatable = false;
      $http({
        method: 'get',
        url:  'https://service.z-wave.me/hardware/capabilities/?uuid=' + $scope.matterMoreOptionsUUID
      }).then(
        function (data) {
          if (data) {
            if (data.data.crc && data.data.crc !== '0' && +data.data.crc !== currentCrc) {
              $scope.updatable = true;
            }
            $scope.setLicense = function () {
              dataService.zmeCapabilities(data.data.license).then(console.warn);
            }
          }
        }
      ).catch(console.error)
    }
  }
})
