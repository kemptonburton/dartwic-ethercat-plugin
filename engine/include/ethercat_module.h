#pragma once

#include "ethercat_bridge_loader.h"

#include <modules/BaseModule.h>

#include <chrono>
#include <memory>
#include <mutex>
#include <span>
#include <string>
#include <vector>

namespace EtherCAT {
    class EthercatModule final : public DARTWIC::Modules::BaseModule {
    public:
        EthercatModule(nlohmann::json config, DARTWIC::API::SDK_API* api);
        ~EthercatModule() override;

        const std::string& instanceName() const noexcept { return instance_name_; }
        nlohmann::json bridgeConfig() const;
        nlohmann::json listAdapters();
        nlohmann::json scan();
        void monitorConnection();
        nlohmann::json start(const std::string& task_name);
        dw_ec_exchange_status exchange(std::span<const uint8_t> outputs,
            std::span<uint8_t> inputs);
        void stop(const std::string& task_name) noexcept;
        bool isOwnedBy(const std::string& task_name) const;
        bool isConnected() const;
        size_t outputSize() const;
        size_t inputSize() const;

    private:
        void connectAndVerify();
        void discardMaster() noexcept;
        void setConnected(bool connected) noexcept;
        void publishConnectionState() noexcept;
        void publishConnectionError(const std::string& message) noexcept;

        std::string instance_name_;
        mutable std::mutex mutex_;
        std::string task_owner_;
        std::unique_ptr<BridgeLibrary> bridge_;
        std::unique_ptr<BridgeLibrary::Master> master_;
        nlohmann::json cached_topology_ = nlohmann::json::object();
        std::vector<uint8_t> monitor_output_image_;
        std::vector<uint8_t> monitor_input_image_;
        std::chrono::steady_clock::time_point next_reconnect_attempt_{};
        std::chrono::steady_clock::time_point last_exchange_{};
        bool connected_ = false;
    };
}
