#include "ethercat_discovery.h"

#include <iostream>

int main() {
    try {
        const nlohmann::json adapter = {
            {"id", "sim-adapter"}, {"name", "TwinCAT Simulation"}, {"kind", "hardware"},
        };
        const nlohmann::json topology = {
            {"process_image", {{"inputs_bytes", 2}, {"outputs_bytes", 1}}},
            {"slaves", nlohmann::json::array({{
                {"position", 0}, {"name", "Simulated I/O"}, {"vendor_id", 2},
                {"product_code", 123}, {"serial", 456},
                {"outputs", nlohmann::json::array({{
                    {"pdo_index", 5632}, {"index", 28672}, {"subindex", 1},
                    {"name", "Control Word"}, {"data_type", "uint8"},
                    {"bit_offset", 0}, {"bit_length", 8},
                }})},
                {"inputs", nlohmann::json::array({{
                    {"pdo_index", 6656}, {"index", 24576}, {"subindex", 1},
                    {"name", "Status Word"}, {"data_type", "uint16"},
                    {"bit_offset", 0}, {"bit_length", 16},
                }})},
            }})},
        };
        const auto candidate = EtherCAT::buildDiscoveryCandidate(adapter, topology, 750, true, 512);
        if (candidate.at("device_type") != "ethercat_bus" ||
            candidate.at("metadata").at("slave_count") != 1 ||
            candidate.at("channels").size() != 3) return 1;
        const auto& provisioning = candidate.at("provisioning");
        if (provisioning.at("module_type") != "master" ||
            provisioning.at("parameters").at("adapter") != "sim-adapter" ||
            provisioning.at("parameters").at("receive_timeout_us") != 750 ||
            provisioning.at("tasks").size() != 1) return 1;
        const auto& mappings = provisioning.at("tasks").at(0).at("arguments").at("mappings");
        if (mappings.size() != 2 || mappings.at(0).at("direction") != "channel_to_device" ||
            !mappings.at(0).contains("readback_channel") ||
            !mappings.at(0).at("readback_channel").get<std::string>().ends_with("_state") ||
            mappings.at(1).at("direction") != "device_to_channel") return 1;
        if (candidate.at("channels").at(0).at("direction") != "output" ||
            candidate.at("channels").at(1).at("direction") != "input" ||
            candidate.at("channels").at(1).at("readback_kind") != "transmitted_output_image" ||
            candidate.at("channels").at(2).at("direction") != "input" ||
            !candidate.at("channels").at(2).at("observe_only").get<bool>()) return 1;
        const auto& editor = provisioning.at("channel_suggestion_editor");
        if (editor.at("kind") != "explicit_mappings" || editor.at("entries").size() != 2 ||
            editor.at("tasks").at(0).at("task_type") != "cycle" ||
            editor.at("entries").at(0).at("mapping").at("direction") != "channel_to_device" ||
            editor.at("entries").at(1).at("mapping").at("direction") != "device_to_channel") return 1;
        const auto limited = EtherCAT::buildDiscoveryCandidate(adapter, topology, 500, true, 1);
        if (limited.at("channels").size() != 2 ||
            !limited.at("metadata").at("suggestions_truncated").get<bool>() ||
            limited.at("provisioning").at("tasks").at(0).at("arguments").at("mappings").size() != 1 ||
            limited.at("provisioning").at("channel_suggestion_editor").at("entries").size() != 1) return 1;
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
