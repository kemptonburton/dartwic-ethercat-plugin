#include "ethercat_discovery.h"

#include "ethercat_bridge_loader.h"

#include <sdk/modules/BaseModule.h>

#include <algorithm>
#include <cctype>
#include <chrono>
#include <cstdint>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <string_view>
#include <utility>
#include <vector>

namespace EtherCAT {
namespace {
std::string safeSegment(std::string value) {
    for (char& character : value) {
        if (!std::isalnum(static_cast<unsigned char>(character))) character = '_';
        else character = static_cast<char>(std::tolower(static_cast<unsigned char>(character)));
    }
    while (value.find("__") != std::string::npos) value.replace(value.find("__"), 2, "_");
    while (!value.empty() && value.front() == '_') value.erase(value.begin());
    while (!value.empty() && value.back() == '_') value.pop_back();
    return value.empty() ? "value" : value;
}

std::string shortHash(const std::string& value) {
    uint32_t hash = 2166136261u;
    for (const unsigned char character : value) {
        hash ^= character;
        hash *= 16777619u;
    }
    std::ostringstream stream;
    stream << std::hex << std::setfill('0') << std::setw(8) << hash;
    return stream.str();
}

std::string adapterLabel(const nlohmann::json& adapter) {
    auto label = adapter.value("name", adapter.value("id", std::string{"Ethernet"}));
    constexpr std::string_view prefix = "Network adapter '";
    constexpr std::string_view suffix = "' on local host";
    if (label.starts_with(prefix) && label.ends_with(suffix) &&
        label.size() > prefix.size() + suffix.size()) {
        label = label.substr(prefix.size(), label.size() - prefix.size() - suffix.size());
    }
    return label;
}

std::string safeInstanceName(const nlohmann::json& adapter) {
    const auto id = adapter.value("id", std::string{});
    auto label = safeSegment(adapterLabel(adapter));
    if (label.size() > 40) label.resize(40);
    return "ethercat_" + label + "_" + shortHash(id);
}

std::string objectAddress(const nlohmann::json& entry) {
    std::ostringstream stream;
    stream << "0x" << std::hex << std::setfill('0') << std::setw(4)
           << std::max(entry.value("index", 0), 0) << '_' << std::dec
           << std::max(entry.value("subindex", 0), 0);
    return stream.str();
}

std::string channelName(const std::string& instance_name,
    const nlohmann::json& slave,
    const nlohmann::json& entry,
    const char* direction_segment) {
    return instance_name + ".slave_" + std::to_string(slave.value("position", 0)) + "." +
        direction_segment + "." + safeSegment(entry.value("name", std::string{"pdo"})) + "_" +
        objectAddress(entry);
}

nlohmann::json scanEthercatBuses(const std::unordered_set<std::string>& configured_adapters,
    const std::unordered_set<std::string>& allowed_adapters,
    int receive_timeout_us) {
    BridgeLibrary bridge;
    const auto adapters = bridge.listAdapters();
    auto buses = nlohmann::json::array();
    auto errors = nlohmann::json::array();
    for (const auto& adapter : adapters) {
        const auto adapter_id = adapter.value("id", std::string{});
        const bool explicit_selection = !allowed_adapters.empty();
        if (adapter_id.empty() || configured_adapters.contains(adapter_id) ||
            (explicit_selection && !allowed_adapters.contains(adapter_id)) ||
            (!explicit_selection && !adapter.value("scan_eligible", true))) continue;
        try {
            BridgeLibrary::Master master(bridge, {
                {"adapter", adapter_id},
                {"receive_timeout_us", receive_timeout_us},
            });
            auto topology = master.scan();
            const auto slaves = topology.value("slaves", nlohmann::json::array());
            if (slaves.empty()) continue;
            buses.push_back({{"adapter", adapter}, {"topology", std::move(topology)}});
        } catch (const std::exception& error) {
            errors.push_back({
                {"adapter_id", adapter_id},
                {"adapter_name", adapter.value("name", adapter_id)},
                {"error", error.what()},
            });
        }
    }
    return {{"adapters", adapters}, {"buses", std::move(buses)}, {"errors", std::move(errors)}};
}
} // namespace

nlohmann::json buildDiscoveryCandidate(const nlohmann::json& adapter,
    const nlohmann::json& topology,
    int receive_timeout_us,
    bool create_cycle_task,
    size_t maximum_suggested_channels) {
    const auto adapter_id = adapter.value("id", std::string{});
    if (adapter_id.empty()) throw std::invalid_argument("A discovered EtherCAT adapter requires an ID.");
    const auto slaves = topology.value("slaves", nlohmann::json::array());
    if (!slaves.is_array() || slaves.empty()) {
        throw std::invalid_argument("An EtherCAT discovery candidate requires at least one slave.");
    }

    const auto instance_name = safeInstanceName(adapter);
    auto channels = nlohmann::json::array();
    auto mappings = nlohmann::json::array();
    auto editor_entries = nlohmann::json::array();
    size_t input_count = 0;
    size_t output_count = 0;
    bool truncated = false;
    const auto append_entries = [&](const nlohmann::json& slave,
        const char* source_key,
        const char* mapping_direction,
        const char* channel_direction,
        const char* channel_segment,
        size_t& count) {
        const auto entries = slave.value(source_key, nlohmann::json::array());
        if (!entries.is_array()) return;
        size_t entry_number = 0;
        for (const auto& entry : entries) {
            ++entry_number;
            ++count;
            if (mappings.size() >= maximum_suggested_channels) {
                truncated = true;
                continue;
            }
            const auto channel = channelName(instance_name, slave, entry, channel_segment);
            nlohmann::json channel_definition = {
                {"name", channel},
                {"direction", channel_direction},
                {"data_type", entry.value("data_type", "uint16")},
                {"bit_offset", entry.value("bit_offset", 0)},
                {"bit_length", entry.value("bit_length", 0)},
                {"slave_position", slave.value("position", 0)},
                {"index", entry.value("index", 0)},
                {"subindex", entry.value("subindex", 0)},
            };
            auto mapping = entry;
            mapping["slave_position"] = slave.value("position", 0);
            mapping["slave_name"] = slave.value("name", std::string{});
            mapping["direction"] = mapping_direction;
            mapping["channel"] = channel;
            mapping["scale"] = 1.0;
            mapping["offset"] = 0.0;
            nlohmann::json readback_definition;
            std::string readback_segment;
            if (std::string_view(mapping_direction) == "channel_to_device") {
                const auto readback = channel + "_state";
                readback_segment = readback.substr(instance_name.size() + 1);
                mapping["readback_channel"] = readback;
                mapping["readback_kind"] = "transmitted_output_image";
                readback_definition = channel_definition;
                readback_definition["name"] = readback;
                readback_definition["direction"] = "input";
                readback_definition["observe_only"] = true;
                readback_definition["readback_kind"] = "transmitted_output_image";
            } else {
                channel_definition["observe_only"] = true;
            }
            const auto entry_id = "slave_" + std::to_string(slave.value("position", 0)) + "_" +
                channel_segment + "_" + objectAddress(entry);
            auto editor_entry = nlohmann::json{
                {"id", entry_id},
                {"label", slave.value("type", slave.value("name", std::string{"Device"})) + " · " +
                    entry.value("name", std::string{"Channel"}) + " " + std::to_string(entry_number)},
                {"task_id", "cycle"},
                {"channel_segment", channel.substr(instance_name.size() + 1)},
                {"default_enabled", true},
                {"channel", channel_definition},
                {"mapping", mapping},
            };
            if (!readback_segment.empty()) {
                editor_entry["readback_channel_segment"] = readback_segment;
                editor_entry["readback_channel"] = readback_definition;
            }
            editor_entries.push_back(std::move(editor_entry));
            channels.push_back(std::move(channel_definition));
            if (!readback_definition.is_null()) channels.push_back(std::move(readback_definition));
            mappings.push_back(std::move(mapping));
        }
    };
    for (const auto& slave : slaves) {
        append_entries(slave, "outputs", "channel_to_device", "output", "output", output_count);
        append_entries(slave, "inputs", "device_to_channel", "input", "input", input_count);
    }

    auto tasks = nlohmann::json::array();
    if (create_cycle_task && !mappings.empty()) {
        tasks.push_back({
            {"name_suffix", "_cycle"},
            {"task_type", "cycle"},
            {"arguments", {{"mappings", mappings}}},
        });
    }
    const auto adapter_name = adapterLabel(adapter);
    const auto process_image = topology.value("process_image", nlohmann::json::object());
    return {
        {"discovery_id", "adapter:" + adapter_id},
        {"device_type", "ethercat_bus"},
        {"display_name", "EtherCAT bus"},
        {"endpoint", {{"host", adapter_name}, {"port", 0}, {"unit_id", 0}}},
        {"metadata", {
            {"protocol", "EtherCAT"},
            {"adapter", adapter},
            {"topology", topology},
            {"node_count", slaves.size()},
            {"slave_count", slaves.size()},
            {"input_pdo_count", input_count},
            {"output_pdo_count", output_count},
            {"suggestions_truncated", truncated},
            {"process_image", process_image},
            {"endpoint_label", adapter_name},
            {"module_map_summary", std::to_string(slaves.size()) +
                (slaves.size() == 1 ? " bus component" : " bus components") + " · " +
                std::to_string(input_count + output_count) + " channels"},
        }},
        {"channels", std::move(channels)},
        {"provisioning", {
            {"module_type", "master"},
            {"suggested_instance_name", instance_name},
            {"parameters", {
                {"adapter", adapter_id},
                {"receive_timeout_us", receive_timeout_us},
            }},
            {"module_identity", {{"parameter_keys", nlohmann::json::array({"adapter"})}}},
            {"channel_suggestion_editor", {
                {"kind", "explicit_mappings"},
                {"maximum_channels", maximum_suggested_channels * 2},
                {"entries", std::move(editor_entries)},
                {"tasks", nlohmann::json::array({{
                    {"id", "cycle"},
                    {"label", "Cyclic I/O"},
                    {"name_suffix", "_cycle"},
                    {"task_type", "cycle"},
                    {"argument_key", "mappings"},
                }})},
            }},
            {"tasks", std::move(tasks)},
        }},
    };
}

EthercatDeviceFinder::EthercatDeviceFinder(DARTWIC::API::SDK_API* api,
    const nlohmann::json& plugin_config) : api_(api) {
    const auto discovery = plugin_config.value("device_discovery", nlohmann::json::object());
    enabled_ = discovery.value("enabled", true);
    create_cycle_task_ = discovery.value("create_cycle_task", true);
    receive_timeout_us_ = std::clamp(discovery.value("receive_timeout_us", 100000), 50, 5000000);
    cycle_receive_timeout_us_ = std::clamp(
        discovery.value("cycle_receive_timeout_us", 10000), 50, 100000);
    for (const auto& adapter : discovery.value("adapter_ids", nlohmann::json::array())) {
        if (adapter.is_string() && !adapter.get<std::string>().empty()) {
            adapter_ids_.insert(adapter.get<std::string>());
        }
    }
    maximum_suggested_channels_ = static_cast<size_t>(std::clamp(
        discovery.value("maximum_suggested_channels", 512), 1, 4096));
    scan_interval_ = std::chrono::seconds(std::clamp(
        discovery.value("scan_interval_seconds", 5), 1, 300));
}

void EthercatDeviceFinder::tick() {
    std::scoped_lock lock(mutex_);
    if (!enabled_ || api_ == nullptr) return;
    reconcileAnnouncements();
    collectScanLocked();
    if (!scan_in_progress_ && std::chrono::steady_clock::now() >= next_scan_) startScanLocked();
}

nlohmann::json EthercatDeviceFinder::settings() const {
    std::scoped_lock lock(mutex_);
    return {
        {"enabled", enabled_},
        {"scan_interval_seconds", scan_interval_.count()},
        {"receive_timeout_us", receive_timeout_us_},
        {"cycle_receive_timeout_us", cycle_receive_timeout_us_},
        {"adapter_ids", adapter_ids_},
        {"create_cycle_task", create_cycle_task_},
        {"maximum_suggested_channels", maximum_suggested_channels_},
        {"adapters", last_adapters_},
        {"buses", last_buses_},
        {"bus_count", last_buses_.size()},
        {"scan_errors", last_scan_errors_},
        {"scan_in_progress", scan_in_progress_},
        {"last_error", last_error_},
    };
}

nlohmann::json EthercatDeviceFinder::scanNow() {
    {
        std::scoped_lock lock(mutex_);
        if (enabled_ && api_ != nullptr) {
            reconcileAnnouncements();
            collectScanLocked();
            if (!scan_in_progress_) startScanLocked();
        }
    }
    return settings();
}

std::unordered_set<std::string> EthercatDeviceFinder::configuredAdapters() const {
    std::unordered_set<std::string> adapters;
    if (api_ == nullptr) return adapters;
    for (const auto& summary : api_->getModuleInstances("ethercat")) {
        const auto module = api_->getModuleInstance(summary.name);
        if (!module) continue;
        const auto adapter = module->getParameter<std::string>("adapter", "");
        if (!adapter.empty()) adapters.insert(adapter);
    }
    return adapters;
}

bool EthercatDeviceFinder::hasConfiguredModule(const std::string& adapter_id) const {
    return configuredAdapters().contains(adapter_id);
}

bool EthercatDeviceFinder::isDiscoveryMuted(const std::string& discovery_id) const {
    if (api_ == nullptr) return false;
    try {
        return api_->isNotificationMuted("device-discovery:" + discovery_id);
    } catch (...) {
        return false;
    }
}

void EthercatDeviceFinder::reconcileAnnouncements() {
    for (auto announced = announced_ids_.begin(); announced != announced_ids_.end();) {
        const auto request_id = request_ids_.find(*announced);
        if (request_id == request_ids_.end()) {
            announced = announced_ids_.erase(announced);
            continue;
        }
        try {
            const auto request = api_->getInterfaceUiRequest(request_id->second);
            if (request.value("status", "pending") == "pending") {
                const bool muted = request.value("muted", false);
                const bool was_muted = last_mute_states_[*announced];
                last_mute_states_[*announced] = muted;
                if (was_muted && !muted) {
                    request_ids_.erase(request_id);
                    announced = announced_ids_.erase(announced);
                    continue;
                }
                ++announced;
                continue;
            }
            request_ids_.erase(request_id);
            last_mute_states_.erase(*announced);
            announced = announced_ids_.erase(announced);
        } catch (...) {
            ++announced;
        }
    }
}

void EthercatDeviceFinder::startScanLocked() {
    scan_in_progress_ = true;
    try {
        auto excluded = configuredAdapters();
        const auto allowed = adapter_ids_;
        const auto receive_timeout_us = receive_timeout_us_;
        scan_future_ = std::async(std::launch::async,
            [excluded = std::move(excluded), allowed, receive_timeout_us]() {
                return scanEthercatBuses(excluded, allowed, receive_timeout_us);
            });
    } catch (const std::exception& error) {
        scan_in_progress_ = false;
        next_scan_ = std::chrono::steady_clock::now() + scan_interval_;
        last_error_ = std::string("Unable to start EtherCAT discovery: ") + error.what();
    }
}

void EthercatDeviceFinder::collectScanLocked() {
    if (!scan_in_progress_ || !scan_future_.valid() ||
        scan_future_.wait_for(std::chrono::seconds(0)) != std::future_status::ready) return;
    scan_in_progress_ = false;
    next_scan_ = std::chrono::steady_clock::now() + scan_interval_;
    try {
        auto result = scan_future_.get();
        last_adapters_ = result.value("adapters", nlohmann::json::array());
        last_buses_ = result.value("buses", nlohmann::json::array());
        last_scan_errors_ = result.value("errors", nlohmann::json::array());
        last_error_.clear();
        for (const auto& bus : last_buses_) {
            try {
                announce(bus);
            } catch (const std::exception& error) {
                if (!last_error_.empty()) last_error_ += "; ";
                last_error_ += std::string("Notification: ") + error.what();
            }
        }
    } catch (const std::exception& error) {
        last_buses_ = nlohmann::json::array();
        last_scan_errors_ = nlohmann::json::array();
        last_error_ = std::string("EtherCAT discovery failed: ") + error.what();
    }
}

void EthercatDeviceFinder::announce(const nlohmann::json& bus) {
    const auto adapter = bus.value("adapter", nlohmann::json::object());
    const auto topology = bus.value("topology", nlohmann::json::object());
    const auto adapter_id = adapter.value("id", std::string{});
    if (adapter_id.empty() || hasConfiguredModule(adapter_id)) return;
    const auto discovery_id = "adapter:" + adapter_id;
    const bool muted = isDiscoveryMuted(discovery_id);
    const bool was_muted = last_mute_states_[discovery_id];
    last_mute_states_[discovery_id] = muted;
    if (was_muted && !muted) {
        request_ids_.erase(discovery_id);
        announced_ids_.erase(discovery_id);
    }
    if (muted || announced_ids_.contains(discovery_id)) return;

    auto candidate = buildDiscoveryCandidate(adapter, topology, cycle_receive_timeout_us_,
        create_cycle_task_, maximum_suggested_channels_);
    auto discovery_request = api_->requestInterfaceUi("dartwic.module-discovery", std::move(candidate), {
        {"request_key", discovery_id},
        {"merge_key", "module-discovery"},
        {"silenceable", true},
        {"mute_scope", "engine"},
        {"notification_id", "ethercat:device-discovery:" + discovery_id},
        {"reopen_completed", true},
    });
    const auto request_id = discovery_request.value("request_id", std::string{});
    if (request_id.empty()) throw std::runtime_error(
        "The interface request broker did not return an EtherCAT discovery request ID.");
    request_ids_[discovery_id] = request_id;
    announced_ids_.insert(discovery_id);
}

std::shared_ptr<EthercatDeviceFinder> createEthercatDeviceFinder(
    DARTWIC::API::SDK_API* api,
    const nlohmann::json& plugin_config) {
    return std::make_shared<EthercatDeviceFinder>(api, plugin_config);
}
} // namespace EtherCAT
