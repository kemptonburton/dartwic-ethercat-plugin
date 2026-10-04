#include "ethercat_module.h"

#include <chrono>
#include <stdexcept>

namespace EtherCAT {
EthercatModule::EthercatModule(nlohmann::json config, DARTWIC::API::SDK_API* api)
    : BaseModule(std::move(config), api),
      instance_name_(getConfig<std::string>("name")),
      connected_channel_(instance_name_ + ".info.connected"),
      connection_error_title_("ETHERCAT CONNECTION ERROR [" + instance_name_ + "]"),
      connection_error_channels_{connected_channel_} {
    const auto& channel = connected_channel_;
    dartwic->upsertChannelField(channel, DARTWIC::API::ChannelField::VALUE,
        0.0, DARTWIC::API::ChannelStorage::Fixed);
    dartwic->upsertChannelField(channel, DARTWIC::API::ChannelField::UNITS,
        std::string{"bool"}, DARTWIC::API::ChannelStorage::Fixed);
    connected_ = false;
}

EthercatModule::~EthercatModule() {
    std::scoped_lock lock(mutex_);
    discardMaster();
}

void EthercatModule::setConnected(bool connected) noexcept {
    connected_ = connected;
}

void EthercatModule::publishConnectionState() noexcept {
    try {
        dartwic->setChannel(connected_channel_,
            DARTWIC::API::ChannelValue{connected_ ? 1.0 : 0.0});
    } catch (...) {
        // Connection telemetry must never interfere with connection monitoring.
    }
}

void EthercatModule::publishConnectionError(const std::string& message) noexcept {
    try {
        dartwic->consoleError(
            connection_error_title_,
            message.empty() ? "Unable to exchange EtherCAT process data." : message,
            connection_error_channels_,
            "Verify that the selected adapter, EtherCAT network, and devices are available.",
            0);
    } catch (...) {
        // Error reporting must never stop connection monitoring.
    }
}

void EthercatModule::discardMaster() noexcept {
    if (master_) master_->stop();
    master_.reset();
    monitor_output_image_.clear();
    monitor_input_image_.clear();
    last_exchange_ = {};
    setConnected(false);
}

void EthercatModule::connectAndVerify() {
    if (!bridge_) bridge_ = std::make_unique<BridgeLibrary>();
    auto candidate = std::make_unique<BridgeLibrary::Master>(*bridge_, bridgeConfig());
    auto topology = candidate->scan();
    candidate->start();

    // discardMaster clears sizes but retains capacity for the next verified
    // connection. Reinitialize outputs so a reconnect never transmits stale data.
    monitor_output_image_.assign(candidate->outputSize(), uint8_t{0});
    monitor_input_image_.assign(candidate->inputSize(), uint8_t{0});
    const auto status = candidate->exchange(monitor_output_image_, monitor_input_image_);
    if (status.expected_wkc <= 0 || status.actual_wkc != status.expected_wkc) {
        throw std::runtime_error("EtherCAT working counter mismatch: expected " +
            std::to_string(status.expected_wkc) + ", received " +
            std::to_string(status.actual_wkc) + ".");
    }

    cached_topology_ = std::move(topology);
    master_ = std::move(candidate);
    next_reconnect_attempt_ = {};
    last_exchange_ = std::chrono::steady_clock::now();
    setConnected(true);
}

void EthercatModule::monitorConnection() {
    std::scoped_lock lock(mutex_);
    const auto now = std::chrono::steady_clock::now();
    if (!master_) {
        if (now >= next_reconnect_attempt_) {
            next_reconnect_attempt_ = now + std::chrono::seconds(1);
            try {
                connectAndVerify();
            } catch (const std::exception& error) {
                discardMaster();
                publishConnectionError(error.what());
            } catch (...) {
                discardMaster();
                publishConnectionError("Unknown error while opening the EtherCAT connection.");
            }
        }
        publishConnectionState();
        return;
    }

    // A running cyclic task already verifies the bus on every exchange. Avoid
    // injecting a second frame while its latest successful exchange is fresh.
    if (!task_owner_.empty() && connected_ && last_exchange_.time_since_epoch().count() != 0 &&
        now - last_exchange_ < std::chrono::seconds(2)) {
        publishConnectionState();
        return;
    }

    try {
        const auto status = master_->exchange(monitor_output_image_, monitor_input_image_);
        if (status.expected_wkc <= 0 || status.actual_wkc != status.expected_wkc) {
            throw std::runtime_error("EtherCAT working counter mismatch: expected " +
                std::to_string(status.expected_wkc) + ", received " +
                std::to_string(status.actual_wkc) + ".");
        }
        last_exchange_ = now;
        setConnected(true);
    } catch (const std::exception& error) {
        discardMaster();
        next_reconnect_attempt_ = now + std::chrono::seconds(1);
        publishConnectionError(error.what());
    } catch (...) {
        discardMaster();
        next_reconnect_attempt_ = now + std::chrono::seconds(1);
        publishConnectionError("Unknown error during the EtherCAT connection check.");
    }
    publishConnectionState();
}

nlohmann::json EthercatModule::bridgeConfig() const {
    return {
        {"adapter", getParameter<std::string>("adapter", "")},
        {"receive_timeout_us", getParameter<int>("receive_timeout_us", 10000)},
    };
}

nlohmann::json EthercatModule::listAdapters() {
    std::scoped_lock lock(mutex_);
    if (!bridge_) bridge_ = std::make_unique<BridgeLibrary>();
    return bridge_->listAdapters();
}

nlohmann::json EthercatModule::scan() {
    std::scoped_lock lock(mutex_);
    if (master_ && cached_topology_.is_object() && cached_topology_.contains("slaves")) {
        return cached_topology_;
    }
    if (!task_owner_.empty()) {
        if (cached_topology_.is_object() && cached_topology_.contains("slaves")) {
            return cached_topology_;
        }
        throw std::runtime_error(
            "Cannot scan EtherCAT module `" + instance_name_ + "` while task `" + task_owner_ + "` owns it.");
    }
    if (!bridge_) bridge_ = std::make_unique<BridgeLibrary>();
    auto candidate = std::make_unique<BridgeLibrary::Master>(*bridge_, bridgeConfig());
    cached_topology_ = candidate->scan();
    return cached_topology_;
}

nlohmann::json EthercatModule::start(const std::string& task_name) {
    std::scoped_lock lock(mutex_);
    if (!task_owner_.empty() && task_owner_ != task_name) throw std::runtime_error(
        "EtherCAT module `" + instance_name_ + "` is already owned by task `" + task_owner_ + "`.");
    task_owner_ = task_name;
    return cached_topology_;
}

dw_ec_exchange_status EthercatModule::exchange(std::span<const uint8_t> outputs,
    std::span<uint8_t> inputs) {
    std::scoped_lock lock(mutex_);
    if (!master_) {
        throw std::runtime_error("EtherCAT master is not running.");
    }
    try {
        const auto status = master_->exchange(outputs, inputs);
        if (status.expected_wkc <= 0 || status.actual_wkc != status.expected_wkc) {
            throw std::runtime_error("EtherCAT working counter mismatch: expected " +
                std::to_string(status.expected_wkc) + ", received " +
                std::to_string(status.actual_wkc) + ".");
        }
        monitor_output_image_.assign(outputs.begin(), outputs.end());
        monitor_input_image_.assign(inputs.begin(), inputs.end());
        last_exchange_ = std::chrono::steady_clock::now();
        setConnected(true);
        return status;
    } catch (...) {
        // A cyclic task may lose an individual process-data frame without the
        // device disappearing. Leave connection ownership and recovery to the
        // independent connection monitor; the task runner reports this failed
        // cycle to the operator through its normal error path.
        throw;
    }
}

void EthercatModule::stop(const std::string& task_name) noexcept {
    std::scoped_lock lock(mutex_);
    if (task_owner_ != task_name) return;
    task_owner_.clear();
}

bool EthercatModule::isOwnedBy(const std::string& task_name) const {
    std::scoped_lock lock(mutex_);
    return task_owner_ == task_name;
}

bool EthercatModule::isConnected() const {
    std::scoped_lock lock(mutex_);
    return connected_;
}

size_t EthercatModule::outputSize() const {
    std::scoped_lock lock(mutex_);
    return master_ ? master_->outputSize() : 0;
}

size_t EthercatModule::inputSize() const {
    std::scoped_lock lock(mutex_);
    return master_ ? master_->inputSize() : 0;
}
} // namespace EtherCAT
