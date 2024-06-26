appController.controller('PacketsController', function ($scope, dataService, $filter,) {
  $scope.statistics = [];
  $scope.statisticsHead = [];
  $scope.predicate = 'id';
  $scope.stats = {};
  const TIMEOUT = 5;
  const FIELDS = ['id',
    'name',
    'packetsIn',
    'rssi',
    'duplicate',
    'explore',
    'period',
    'packetsOut',
    'delivered',
    'rerouted',
    '_isFailed',]

  function extractPackages(data) {
    return Object.fromEntries(Object.entries(data
      .filter(el => !el.returnRSSI)
      .reduce((acc, cur) => {
        const extract = {updateTime: cur.updateTime}
        const last = acc[cur.nodeId]?.at(-1)
        const node = +cur.nodeId
        if (last) {
          if ((cur.updateTime - last.at(-1).updateTime) < TIMEOUT) {
            last.push(extract)
          } else {
            acc[node].push([extract])
          }
        } else {
          acc[node] = [[extract]]
        }
        return acc
      }, {}))
      .map(([id, data]) => ([
        id,
        {period: (data.at(-1).at(0).updateTime - data.at(0).at(0).updateTime) / (data.length - 1),}
      ])))
  }

  function extractRSSI(data) {
    return Object.fromEntries(Object.entries(data
      .filter(el => !el.returnRSSI)
      .reduce((acc, cur) => {
        const node = +cur.nodeId;
        if (!(node in acc)) {
          acc[node] = {packets: 0, rssi: [], duplicate: 0, explore: 0};
        }
        ++acc[node].packets;
        if (cur.duplicate)
          ++acc[node].duplicate;
        if (cur.frameType === 'Explore Frame') {
          ++acc[node].explore;
        }
        const rssi = cur.RSSI > 127 ? cur.RSSI - 256 : cur.RSSI;
        if (![125, 126, 127].includes(rssi) && cur.hops) {
          const rssiNode = +(cur.hops.at(-1) ?? cur.nodeId);
          if (rssiNode in acc) {
            acc[rssiNode].rssi.push(rssi);
          } else {
            acc[rssiNode] = {packets: 0, rssi: [rssi], duplicate: 0, explore: 0};
          }
        }
        return acc;
      }, {}))
      .map(([id, data]) => ([
        id, {
          packetsIn: data.packets,
          rssi: data.rssi.reduce((acc, cur) => acc + cur, 0) / data.rssi.length,
          duplicate: data.duplicate / data.packets,
          explore: data.explore / data.packets
        }
      ])))
  }

  const filterDevices = (devices, controllerNodeId) =>
    (id) => !(+id === 255 ||
      +id === controllerNodeId ||
      devices[+id].data.isVirtual.value);

  function outgoingStatistics(data) {
    return Object.fromEntries(Object.entries(data
      .filter(el => el.returnRSSI)
      .reduce((acc, cur) => {
        const node = +cur.nodeId;
        if (!(node in acc)) {
          acc[node] = {total: 0, delivered: 0, rerouted: 0}
        }
        if (cur.delivered)
          ++acc[node].delivered;
        if (cur.tries > 1)
          ++acc[node].rerouted;
        ++acc[node].total;
        return acc;
      }, {}))
      .map(([id, data]) => ([
        id,
        {
          packetsOut: data.total,
          delivered: data.delivered / data.total,
          rerouted: data.rerouted / data.total,
        }
      ])))
  }

  (function () {
    Promise.all([dataService.getApi('packet_log', '', true), dataService.loadZMatterApiData()])
      .then(([response, ZMatterAPIData]) => {
        return [response.data.data, ZMatterAPIData.devices, ZMatterAPIData.controller.data.nodeId.value]
      }).then(function ([data, devices, controllerNodeId]) {
      $scope.stats.packetsNum = data.length;
      $scope.stats.gatheringPeriod = $scope.stats.packetsNum ? ((data.at(-1).updateTime - data.at(0).updateTime) / 60 / 60).toFixed(0) : 0;
      const packages = extractPackages(data);
      const outgoing = outgoingStatistics(data);
      const rssi = extractRSSI(data);
      const defaultValue = Object.fromEntries(FIELDS.map(key => [key, NaN]))
      $scope.statistics = Object.keys(devices).filter(filterDevices(devices, controllerNodeId)).map((id) => ({
        ...defaultValue,
        id: +id,
        name: $filter('deviceName')(id, devices[id]),
        ...rssi[id],
        ...packages[id],
        ...outgoing[id],
        _isFailed: devices[id].data.isFailed.value
      }))
      $scope.statisticsHead = FIELDS.filter(key => !key.startsWith('_'))
    })
      .catch(console.error)
  })()
})
