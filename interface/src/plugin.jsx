import {definePlugin} from "../sdk/index.ts";
import React from "../sdk/react.ts";
import {moduleMap, cycleMap, EthercatConfigLayout} from './configMaps.jsx';
import {EthercatTaskCard} from "./taskCards.jsx";

function EthercatIcon(props) {
    return <svg viewBox="0 0 24 24" role="img" aria-label="EtherCAT" {...props}>
        <path fill="#e63032" d="M2 4h13V1l7 5.5-7 5.5V9H2z"/>
        <path fill="currentColor" d="M22 15H9v-3l-7 5.5L9 23v-3h13z"/>
    </svg>;
}

export default definePlugin({
    id: "ethercat",
    name: "EtherCAT",
    register(registry) {
        registry.addTaskUi({id: "cycle", name: "EtherCAT Cyclic I/O", card: EthercatTaskCard, configMap: cycleMap, editor: EthercatConfigLayout});
        registry.addModuleUi({
            id: "master",
            name: "EtherCAT Master",
            icon: EthercatIcon,
            configMap: moduleMap,
            connection: ({instanceConfig}) => ({
                channel: `${instanceConfig.name}.info.connected`,
                label: "EtherCAT Master",
                endpoint: instanceConfig.parameters?.adapter || "NO ADAPTER",
                connectedValue: 1,
            }),
        });
    },
});
