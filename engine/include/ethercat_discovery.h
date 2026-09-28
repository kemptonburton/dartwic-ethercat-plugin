#pragma once

#include <sdk/sdk_api.h>

#include <chrono>
#include <future>
#include <memory>
#include <mutex>
#include <nlohmann/json.hpp>
#include <string>
#include <unordered_map>
#include <unordered_set>

namespace EtherCAT {
    nlohmann::json buildDiscoveryCandidate(
        const nlohmann::json& adapter,
        const nlohmann::json& topology,
        int receive_timeout_us,
        bool create_cycle_task,
        size_t maximum_suggested_channels);

    class EthercatDeviceFinder {
    public:
        EthercatDeviceFinder(DARTWIC::API::SDK_API* api, const nlohmann::json& plugin_config);

        void tick();
        nlohmann::json settings() const;
        nlohmann::json scanNow();

    private:
        void startScanLocked();
        void collectScanLocked();
        void announce(const nlohmann::json& bus);
        void reconcileAnnouncements();
        std::unordered_set<std::string> configuredAdapters() const;
        bool hasConfiguredModule(const std::string& adapter_id) const;
        bool isDiscoveryMuted(const std::string& discovery_id) const;

        DARTWIC::API::SDK_API* api_{};
        bool enabled_{true};
        bool create_cycle_task_{true};
        int receive_timeout_us_{100000};
        int cycle_receive_timeout_us_{10000};
        std::unordered_set<std::string> adapter_ids_;
        size_t maximum_suggested_channels_{512};
        std::chrono::seconds scan_interval_{5};
        std::chrono::steady_clock::time_point next_scan_{};
        std::future<nlohmann::json> scan_future_;
        bool scan_in_progress_{false};
        nlohmann::json last_adapters_ = nlohmann::json::array();
        nlohmann::json last_buses_ = nlohmann::json::array();
        nlohmann::json last_scan_errors_ = nlohmann::json::array();
        std::string last_error_;
        std::unordered_set<std::string> announced_ids_;
        std::unordered_map<std::string, std::string> request_ids_;
        std::unordered_map<std::string, bool> last_mute_states_;
        mutable std::mutex mutex_;
    };

    std::shared_ptr<EthercatDeviceFinder> createEthercatDeviceFinder(
        DARTWIC::API::SDK_API* api,
        const nlohmann::json& plugin_config);
}
