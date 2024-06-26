/**
 * @overview RSSI report for nodes with background RSSI border.
 * @author Aleksei Itckovich
 */
/**
 * RSSI report for nodes with background RSSI border
 * @class RSSIReportController
 *
 */
appController.controller('RSSIReportController', function ($scope, $filter, $timeout, $interval, dataService, cfg, $q, _) {
    const allSettled = function () {
        var promises = [
            dataService.loadZMatterApiData(),
            dataService.getApi('packet_log', '', true),
            dataService.getApi('rssi_chart','', true)
        ];

        $q.allSettled(promises).then(function (response) {
            var ZMatterAPIData = response[0];
            var packetApi = response[1];
            const rssiChart = response[2];
            // matterData and packet error message
            if (ZMatterAPIData.state === 'rejected' || packetApi.state === 'rejected' || rssiChart.state === 'rejected') {
                alertify.alertError($scope._t('error_load_data'));
                return;
            }

            // Success - matterData
            if (ZMatterAPIData.state === 'fulfilled' && packetApi.state === 'fulfilled' && rssiChart.state === 'fulfilled') {
                const packetsPerDev = {}
                const report = []
                const windowsWidth = 3600000;
                const acc = {};
                rssiChart.value.data.data.
                    filter(e => (cfg.route.time.timestamp - e.time) <= windowsWidth).forEach(function (entry) {
                        for (const key in entry) {
                            if (key.startsWith('channel') && entry[key]) {
                                if (!acc[key]) {
                                    acc[key] = [0, 0];
                                }
                                acc[key][0] += entry[key];
                                ++acc[key][1];
                            }
                        }
                });
                $scope.backgroundRssi = Math.max.apply(null, Object.values(acc).map(function ([value, count]) {
                                    return value/count;
                                }));
                packetApi.value.data.data.forEach(function (p) {
                    var node;
                    var rssi;
                    if (p.returnRSSI) {
                        // outgoing packet
                        node = p.hops.length === 0 ? p.nodeId : p.hops[0]; // direct or first hop
                        rssi = p.returnRSSI[0]; // corresponds to the nearest hop or direct
                    } else {
                        // incoming packet
                        rssi = p.RSSI;
                        if (!p.hops) return; // skip incoming packets with unknown hops - we don't know to which device the RSSI corr
                        node = p.hops.length === 0 ? p.nodeId : p.hops[p.hops.length - 1]; // direct or last hop
                    }
                    if (rssi === 125 || rssi === 126 || rssi === 127) return; // handle only valid values
                    if (rssi > 127) rssi -= 256; // convert to signed
                    if (!packetsPerDev[node]) packetsPerDev[node] = [];
                    packetsPerDev[node].push(rssi);
                })

                for (const node in packetsPerDev) {
                    const [RSSI, std] = stat(packetsPerDev[node]);
                    report.push({nodeId: +node, name: $filter('deviceName')(node, ZMatterAPIData.value.devices[node]), RSSI, std})
                }

                $scope.report = fillWidth(report);
            }
        });

    };
    const stat = function (array) {
        var n = array.length;
        var mean = array.reduce((a, b) => a + b) / n;
        return [Math.round(mean), Math.round(Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n))];
    }

    const fillWidth = function (data) {
        const minRSSI = -90;
        const maxRSSI = Math.max(-10, Math.max.apply(null, data.map(el => el.RSSI + el.std)))
        if ($scope.backgroundRssi) {
            $scope.backgroundRssi = Math.max(0, Math.trunc(($scope.backgroundRssi - minRSSI) / (maxRSSI - minRSSI) * 100));
        }
        return data.map(el => {
            if (el.RSSI || el.RSSI === 0) {
                if (el.RSSI > minRSSI) {
                    el.width = Math.trunc((el.RSSI - minRSSI) / (maxRSSI - minRSSI) * 100);
                } else {
                    el.width = 1;
                }
            } else {
                // no data
                el.width = 100;
                el.RSSI = 0;
            }
            return el;
        })
    }
    allSettled();
})

