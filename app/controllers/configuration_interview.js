/**
 * @overview This controller renders and handles device interview stuff.
 * @author Martin Vach
 */

/**
 * Device interview controller
 * @class ConfigInterviewController
 *
 */
appController.controller('ConfigInterviewController', function ($scope, $routeParams, $route, $location, $cookies, $filter, $http, $timeout, $interval, cfg, dataService, deviceService, myCache) {
  $scope.devices = [];
  $scope.deviceName = '';
  $scope.deviceId = 0;
  //$scope.activeTab = 'interview';
  $scope.activeUrl = 'configuration/interview/';
  $cookies.tab_config = 'interview';
  $scope.modelSelectZddx = false;
  $scope.matterInterview = {
      interval: null,
      progress: 0,
      clustersCnt: 0,
      interviewDoneCnt: 0
    },
    $scope.isController = false;
  $scope.showInterview = true;

  // Interview data
  $scope.descriptionCont;
  $scope.deviceZddx = [];

  /**
   * Cancel interval on page destroy
   */
  $scope.$on('$destroy', function () {
    $interval.cancel($scope.matterInterview.interval);
  });

  // Load data
  $scope.load = function (nodeId) {
    //nodeId = parseInt(nodeId,10);
    dataService.loadZMatterApiData().then(function (ZMatterAPIData) {
      $scope.ZMatterAPIData = ZMatterAPIData;
      $scope.devices = deviceService.configGetNav(ZMatterAPIData);
      if (_.isEmpty($scope.devices)) {
        $scope.alert = {
          message: $scope._t('device_404'),
          status: 'alert-warning',
          icon: 'fa-exclamation-circle'
        };
        return;
      }
      var node = ZMatterAPIData.devices[nodeId];
      if (!node || deviceService.notDevice(ZMatterAPIData, node, nodeId)) {
        return;
      }

      //check if node is controller
      $scope.isController = parseInt(nodeId, 10) === cfg.controller.zmatterNodeId;

      $cookies.configuration_id = nodeId;
      $cookies.config_url = $scope.activeUrl + nodeId;
      $scope.deviceId = nodeId;
      $scope.deviceName = $filter('deviceName')(nodeId, node);
      //hide interview if node is controller
      $scope.showInterview = !$scope.isController;
      checkInterview(node);
      setData(ZMatterAPIData, nodeId);
      $scope.refreshMatterData();
      /* dataService.loadJoinedMatterData(ZMatterAPIData).then(function(response) {
           node = response.data.joined.devices[nodeId];
           refreshData(node, nodeId, response.data.joined);
           $scope.ZMatterAPIData = ZMatterAPIData;
       });*/
    });
  };
  $scope.load($routeParams.nodeId);

  /**
   * Refresh matter data
   * @param {object} ZMatterAPIData
   */
  $scope.refreshMatterData = function () {
    var refresh = function () {
      dataService.loadJoinedMatterData().then(function (response) {
        var node = response.data.joined.devices[$routeParams.nodeId];
        refreshData(node, $routeParams.nodeId, response.data.joined);
      });
    };
    $scope.matterInterview.interval = $interval(refresh, $scope.cfg.interval);
  };

  // Redirect to device
  $scope.redirectToDevice = function (deviceId) {
    if (deviceId) {
      $location.path($scope.activeUrl + deviceId);
    }
  };

  /**
   * Request NIF of a device
   * Node Id to be requested for a NIF
   * @param {string} cmd
   */
  $scope.requestNodeInformation = function (cmd) {
    $scope.runMatterCmd(cmd);
  };

  /**
   * Purge all command classes and start interview based on device's NIF
   * @param {string} cmd
   */
  $scope.interviewForce = function (cmd) {
    $scope.runMatterCmd(cmd);
  };

  /**
   * Purge all command classes and start interview for a device
   * @param {string} cmd
   */
  $scope.interviewForceDevice = function (cmd) {
    $scope.runMatterCmd(cmd);
  };

  /**
   * Show modal CommandClass dialog
   * @param target
   * @param $event
   * @param endpointId
   * @param ccId
   * @param type
   */
  $scope.handleCmdClassModal = function (target, $event, endpointId, ccId, type) {
    var node = $scope.ZMatterAPIData.devices[$routeParams.nodeId];
    var ccData;
    switch (type) {
      case 'cmdData':
        ccData = $filter('hasNode')(node, 'endpoints.' + endpointId + '.clusters.' + ccId + '.data');
        break;
      case 'cmdDataIn':
        ccData = $filter('hasNode')(node, 'endpoints.' + endpointId + '.data');
        break;
      default:
        ccData = $filter('hasNode')(node, 'data');
        break;
    }
    var cc = deviceService.configGetCommandClass(ccData, '/', '');

    $scope.cluster = deviceService.configSetCommandClass(cc);
    $scope.handleModal(target, $event);
    //$(target).modal();
  };

  /**
   * Rename Device action
   */
  $scope.renameDevice = function (form, deviceName, spin) {
    if (!form.$dirty) {
      return;
    }
    var timeout = 1000;
    // encodeURIComponent(myUrl);
    //var cmd = 'devices[' + $scope.deviceId + '].data.givenName.value="' + escape(deviceName) + '"';
    var cmd = 'devices[' + $scope.deviceId + '].data.givenName.value="' + encodeURIComponent(deviceName) + '"';
    $scope.toggleRowSpinner(spin);
    dataService.runMatterCmd(cfg.store_url + cmd).then(function (response) {

      $timeout(function () {
        form.$setPristine();
        $scope.toggleRowSpinner();
        $scope.load($routeParams.nodeId);

      }, timeout);

      dataService.postApi('store_url', null, 'devices.SaveData()');
      
    }, function (error) {
      $scope.toggleRowSpinner();
    });
  };

  /// --- Private functions --- ///
  /**
   * Set matter data
   */
  function setData(ZMatterAPIData, nodeId, refresh) {
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
    if (zddXmlFile && zddXmlFile !== 'undefined') {
      $http.get($scope.cfg.server_url + $scope.cfg.zddx_url + zddXmlFile).then(function (response) {
        var x2js = new X2JS();
        var zddXml = x2js.xml_str2json(response.data);
        myCache.put(zddXmlFile, zddXml);
        $scope.descriptionCont = setCont(node, nodeId, zddXml, ZMatterAPIData, refresh);
      }, function (response) {
        $scope.descriptionCont = setCont(node, nodeId, null, ZMatterAPIData, refresh);
      });
    } else {
      $scope.descriptionCont = setCont(node, nodeId, null, ZMatterAPIData, refresh);
    }
  }

  /**
   * Check interview
   */
  function checkInterview(node) {
    $scope.matterInterview.clustersCnt = 0;
    $scope.matterInterview.interviewDoneCnt = 0;
    if (!node) {
      return;
    }
    for (var iId in node.endpoints) {
      /* if (Object.keys(node.endpoints[iId].clusters).length < 1) {
           return;
       }*/
      //angular.extend($scope.matterInterview, {clustersCnt: Object.keys(node.endpoints[iId].clusters).length});
      $scope.matterInterview.clustersCnt += Object.keys(node.endpoints[iId].clusters).length;
      for (var ccId in node.endpoints[iId].clusters) {
        var cmdClass = node.endpoints[iId].clusters[ccId];
        // Is interview done?
        if (cmdClass.data.interviewDone.value) {

          // If an interview is done deleting from interviewNotDone
          // Extending an interview counter
          angular.extend($scope.matterInterview, {
            interviewDoneCnt: $scope.matterInterview.interviewDoneCnt + 1
          });
        }
      }
    }

    var clustersCnt = $scope.matterInterview.clustersCnt;
    var intervewDoneCnt = $scope.matterInterview.interviewDoneCnt;
    var progress = ((intervewDoneCnt / clustersCnt) * 100).toFixed();
    /*console.log('clustersCnt: ', clustersCnt);
    console.log('intervewDoneCnt: ', intervewDoneCnt);
    console.log('Percent %: ', progress);*/
    $scope.matterInterview.progress = (progress >= 100 ? 100 : progress);

  };

  /**
   * Device description
   */
  function setCont(node, nodeId, zddXml, ZMatterAPIData, refresh) {
    // Set device data
    var deviceImage = 'app/images/no_device_image.png';
    var deviceDescription = '';
    var productName = node.endpoints[1]?.clusters[0]?.data.modelIdentifier?.value || '';
    var inclusionNote = '';
    var brandName = node.endpoints[1]?.clusters[0]?.data.manufacturerName?.value || '';
    var wakeupNote = '';
    var MatterPlusRoles = [];
    var securityInterview = '';
    var deviceDescriptionAppVersion = node.endpoints[1]?.clusters[0]?.data.applicationVersion?.value.toString() || '';
    var isSleepy = node.data.isSleepy.value;
    var manualUrl = "";
    var certNumber = "";
    var productCode = "";

    var hasWakeup = isSleepy;
    var zbNodeName = '';
    if (0x77 in node.endpoints[0].clusters) {
      // NodeNaming
      zbNodeName = node.endpoints[0].clusters[0x77].data.nodename.value;
      if (zbNodeName != '') {
        zbNodeName = ' (' + zbNodeName + ')';
      }


    }

    var sdk = 'TDB';
    /*
    if (!$scope.isController && node.data.SDK.value == '') {
      sdk = '(' + node.data.ZWProtocolMajor.value + '.' + node.data.ZWProtocolMinor.value + ')';
    } else {
      sdk = $scope.isController ? ZMatterAPIData.controller.data.SDK.value : node.data.SDK.value;
    }
    */

    // Command class
    var ccNames = [];
    angular.forEach($scope.interviewCommands, function (v, k) {
      ccNames.push(v.ccName);
    });
    // Has device a zddx XML file
    if (zddXml) {
      deviceDescription = deviceService.configGetZddxLang($filter('hasNode')(zddXml, 'MatterDevice.deviceDescription.description.lang'), $scope.lang);
      inclusionNote = deviceService.configGetZddxLang($filter('hasNode')(zddXml, 'MatterDevice.deviceDescription.inclusionNote.lang'), $scope.lang);
      wakeupNote = deviceService.configGetZddxLang($filter('hasNode')(zddXml, 'MatterDevice.deviceDescription.wakeupNote.lang'), $scope.lang);



      if ('brandName' in zddXml.MatterDevice.deviceDescription) {
        brandName = zddXml.MatterDevice.deviceDescription.brandName;
      }

      if ('productName' in zddXml.MatterDevice.deviceDescription) {
        productName = zddXml.MatterDevice.deviceDescription.productName;
      }

      if ('resourceLinks' in zddXml.MatterDevice && angular.isDefined(zddXml.MatterDevice.resourceLinks.deviceImage)) {
        deviceImage = zddXml.MatterDevice.resourceLinks.deviceImage._url;
      }

      if ('resourceLinks' in zddXml.MatterDevice && angular.isDefined(zddXml.MatterDevice.resourceLinks.manualUrl)) {
        manualUrl = zddXml.MatterDevice.resourceLinks.manualUrl._url;
      }

      if ('deviceData' in zddXml.MatterDevice && angular.isDefined(zddXml.MatterDevice.deviceData.certNumber)) {
        certNumber = zddXml.MatterDevice.deviceData.certNumber;
      }

      if ('productCode' in zddXml.MatterDevice.deviceDescription) {
        productCode = zddXml.MatterDevice.deviceDescription.productCode;
      }



      /**
       * TODO: finish MatterPlusRoles
       */
      if (angular.isDefined(zddXml.MatterDevice.RoleTypes)) {
        angular.forEach(zddXml.MatterDevice.RoleTypes, function (v, k) {
          MatterPlusRoles.push(v);
        });
      }
    }

    // Set device image
    $scope.deviceImage = deviceImage;
    // OBJ
    var obj = {};
    obj["a"] = {
      "key": "device_node_id",
      "val": nodeId
    };
    obj["d"] = {
      "key": "device_description_brand",
      "val": brandName
    };
    /* TBD
    obj["e"] = {
      "key": "device_description_device_type",
      "val": 'TBD' //node.data.deviceTypeString.value
    };
    */
    obj["f"] = {
      "key": "device_description_product",
      "val": productName
    };
    obj["g"] = {
      "key": "device_description_description",
      "val": deviceDescription
    };
    obj["h"] = {
      "key": "device_description_inclusion_note",
      "val": inclusionNote
    };
    if (hasWakeup) {
      obj["i"] = {
        "key": "device_description_wakeup_note",
        "val": wakeupNote
      };
    }

    // obj["j"] = {"key": "device_description_interview", "val": deviceService.configInterviewStage(ZMatterAPIData, nodeId, $scope.languages)};
    //obj["k"] = {"key": "device_interview_indicator", "val": interviewDone};
    
    // don't show it from controller itself
    if (ZMatterAPIData.controller.data.nodeId.value != nodeId) { // non-strict comparison since nodeId is a key string
      obj["l"] = {
        "key": "device_sleep_state",
        "val": deviceService.configDeviceState(node, $scope.languages)
      };
      obj["m"] = {
        "key": "device_description_app_version",
        "val": deviceDescriptionAppVersion
      };
    }
    /* TBD
    obj["o"] = {
      "key": "device_description_sdk_version",
      "val": sdk
    };
    */
    obj["p"] = {
      "key": "command_class",
      "val": ccNames
    };
    /* TBD
    obj["q"] = {
      "key": "matter_role_type",
      "val": MatterPlusRoles.join(', ')
    };
    if (deviceService.isLocalyReset(node)) {
      obj["r"] = {
        "key": "device_reset_locally",
        "val": '<i class="' + $filter('checkedIcon')(true) + '"></i>'
      };
    }
    if (typeof securityInterview === 'boolean') {
      obj["s"] = {
        "key": "device_security_interview",
        "val": '<i class="' + $filter('checkedIcon')(securityInterview) + '"></i>'
      };
    }
    obj["u"] = {
      "key": "granted_keys",
      "val": securityS2Key.join()
    };

    if (certNumber != "") {
      obj["w"] = {
        "key": "Certification-Nr.",
        "val": certNumber
      };
    }
   */

    obj["x"] = {
      "key": "Productcode",
      "val": productCode
    };

    lang = $scope.lang.toUpperCase();

    if (certNumber != "") {
      obj["y"] = {
        "key": "Manual",
        "val": "<a href='http://manuals-backend.matter.info/make.php?lang=" + lang + "&cert=" + certNumber + "' target=_blank> Manual </a>"
      }
    };

    return obj;

  }

  /**
   * Refresh description cont
   */
  function refreshData(node, nodeId, ZMatterAPIData) {
    checkInterview(node);
    $scope.interviewCommands = deviceService.configGetInterviewCommands(node, ZMatterAPIData.updateTime);
    // todo: deprecated
    //$('#device_sleep_state .config-interview-val').html(deviceService.configDeviceState(node, $scope.languages));
    //$('#device_description_interview .config-interview-val').html(deviceService.configInterviewStage(ZMatterAPIData, nodeId, $scope.languages));
  }
});