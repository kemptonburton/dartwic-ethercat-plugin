#include "dartwic_ethercat_bridge.h"

#include <algorithm>
#include <array>
#include <chrono>
#include <cctype>
#include <cstdio>
#include <cstring>
#include <functional>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2ipdef.h>
#include <iphlpapi.h>
#include <netioapi.h>
#ifdef interface
#undef interface
#endif
#endif

#include <nlohmann/json.hpp>

#include "kickcat/AbstractSocket.h"
#include "kickcat/Bus.h"
#include "kickcat/CoE/OD.h"
#include "kickcat/Link.h"
#include "kickcat/helpers.h"

using namespace std::chrono_literals;

struct dw_ec_context {
    nlohmann::json config;
    std::string error;
    nlohmann::json topology = nlohmann::json::object();
    std::shared_ptr<kickcat::AbstractSocket> nominal_socket;
    std::shared_ptr<kickcat::AbstractSocket> redundant_socket;
    std::shared_ptr<kickcat::Link> link;
    std::unique_ptr<kickcat::Bus> bus;
    std::vector<uint8_t> iomap;
    size_t input_size = 0;
    size_t output_size = 0;
    uint32_t expected_wkc = 0;
    uint64_t cycle_count = 0;
    bool scanned = false;
    bool running = false;

};

namespace {
using nlohmann::json;

#ifdef _WIN32
struct WindowsAdapterInfo {
    std::array<uint8_t, 6> mac{};
    bool ethernet = false;
    bool hardware = false;
    bool up = false;
};

std::optional<WindowsAdapterInfo> windowsAdapterInfo(const std::string& pcap_name) {
    const auto open = pcap_name.find('{');
    const auto close = open == std::string::npos ? std::string::npos : pcap_name.find('}', open);
    if (open == std::string::npos || close == std::string::npos) return std::nullopt;

    auto normalize = [](std::string value) {
        value.erase(std::remove(value.begin(), value.end(), '{'), value.end());
        value.erase(std::remove(value.begin(), value.end(), '}'), value.end());
        std::transform(value.begin(), value.end(), value.begin(),
            [](unsigned char character) { return static_cast<char>(std::tolower(character)); });
        return value;
    };
    const auto requested = normalize(pcap_name.substr(open, close - open + 1));

    ULONG size = 0;
    auto result = GetAdaptersAddresses(AF_UNSPEC, GAA_FLAG_INCLUDE_ALL_INTERFACES,
        nullptr, nullptr, &size);
    if (result != ERROR_BUFFER_OVERFLOW || size == 0) return std::nullopt;

    std::vector<uint8_t> storage(size);
    auto* adapters = reinterpret_cast<IP_ADAPTER_ADDRESSES*>(storage.data());
    result = GetAdaptersAddresses(AF_UNSPEC, GAA_FLAG_INCLUDE_ALL_INTERFACES,
        nullptr, adapters, &size);
    if (result != NO_ERROR) return std::nullopt;

    for (auto* adapter = adapters; adapter != nullptr; adapter = adapter->Next) {
        if (adapter->AdapterName == nullptr || adapter->PhysicalAddressLength < 6) continue;
        if (normalize(adapter->AdapterName) != requested) continue;
        WindowsAdapterInfo info;
        std::copy_n(adapter->PhysicalAddress, info.mac.size(), info.mac.begin());
        info.ethernet = adapter->IfType == IF_TYPE_ETHERNET_CSMACD;
        info.up = adapter->OperStatus == IfOperStatusUp;
        MIB_IF_ROW2 row{};
        row.InterfaceLuid = adapter->Luid;
        info.hardware = GetIfEntry2(&row) == NO_ERROR &&
            row.InterfaceAndOperStatusFlags.HardwareInterface;
        return info;
    }
    return std::nullopt;
}

std::optional<std::array<uint8_t, 6>> adapterMac(const std::string& pcap_name) {
    const auto info = windowsAdapterInfo(pcap_name);
    if (!info) return std::nullopt;
    return info->mac;
}
#endif

dw_ec_result guard(dw_ec_context* context, const std::function<void()>& action) {
    try {
        action();
        if (context != nullptr) context->error.clear();
        return DW_EC_OK;
    } catch (const std::exception& error) {
        if (context != nullptr) context->error = error.what();
        return DW_EC_INTERNAL_ERROR;
    } catch (...) {
        if (context != nullptr) context->error = "Unknown EtherCAT bridge error.";
        return DW_EC_INTERNAL_ERROR;
    }
}

dw_ec_result writeJson(const json& value, char* destination, size_t destination_size,
    size_t* required_size) {
    if (required_size == nullptr) return DW_EC_INVALID_ARGUMENT;
    const auto text = value.dump();
    *required_size = text.size() + 1;
    if (destination == nullptr || destination_size == 0) return DW_EC_OK;
    if (destination_size < *required_size) return DW_EC_INVALID_ARGUMENT;
    std::memcpy(destination, text.c_str(), *required_size);
    return DW_EC_OK;
}

std::string dataType(uint8_t code, uint8_t bits) {
    using kickcat::CoE::DataType;
    switch (static_cast<DataType>(code)) {
        case DataType::BOOLEAN: return "bool";
        case DataType::INTEGER8: return "int8";
        case DataType::INTEGER16: return "int16";
        case DataType::INTEGER32: return "int32";
        case DataType::INTEGER64: return "int64";
        case DataType::UNSIGNED8: return "uint8";
        case DataType::UNSIGNED16: return "uint16";
        case DataType::UNSIGNED32: return "uint32";
        case DataType::UNSIGNED64: return "uint64";
        case DataType::REAL32: return "float32";
        case DataType::REAL64: return "float64";
        default:
            if (bits == 1) return "bool";
            if (bits <= 8) return "uint8";
            if (bits <= 16) return "uint16";
            if (bits <= 32) return "uint32";
            return "uint64";
    }
}

json pdoEntries(const kickcat::Slave& slave, bool inputs, size_t process_image_bit_base) {
    const auto& pdos = inputs ? slave.sii.TxPDO : slave.sii.RxPDO;
    json result = json::array();
    size_t cursor = process_image_bit_base;
    for (const auto& pdo : pdos) {
        for (const auto& entry : pdo.entries) {
            if (entry.index != 0) {
                result.push_back({
                    {"pdo_index", pdo.index},
                    {"index", entry.index},
                    {"subindex", entry.subindex},
                    {"name", std::string(slave.sii.getString(entry.name))},
                    {"data_type", dataType(entry.data_type, entry.bitlen)},
                    {"bit_offset", cursor},
                    {"bit_length", entry.bitlen},
                });
            }
            cursor += entry.bitlen;
        }
    }
    return result;
}

void buildTopology(dw_ec_context& context) {
    json slaves = json::array();
    context.input_size = 0;
    context.output_size = 0;
    context.expected_wkc = 0;
    for (const auto& slave : context.bus->slaves()) {
        context.input_size += static_cast<size_t>(std::max(slave.input.bsize, 0));
        context.output_size += static_cast<size_t>(std::max(slave.output.bsize, 0));
        // The cyclic exchange uses one logical write and one logical read.
        // Each participating FMMU contributes one working-counter increment
        // to its direction.
        if (slave.input.bsize > 0) context.expected_wkc += 1;
        if (slave.output.bsize > 0) context.expected_wkc += 1;
    }
    for (size_t position = 0; position < context.bus->slaves().size(); ++position) {
        const auto& slave = context.bus->slaves()[position];
        const size_t input_base = slave.input.data == nullptr ? 0 :
            static_cast<size_t>(slave.input.data - context.iomap.data()) * 8;
        const size_t output_base = slave.output.data == nullptr ? 0 :
            (static_cast<size_t>(slave.output.data - context.iomap.data()) - context.input_size) * 8;
        slaves.push_back({
            {"position", position},
            {"name", slave.name()},
            {"type", slave.type()},
            {"station_address", slave.address},
            {"vendor_id", slave.sii.info.vendor_id},
            {"product_code", slave.sii.info.product_code},
            {"revision", slave.sii.info.revision_number},
            {"serial", slave.sii.info.serial_number},
            {"inputs", pdoEntries(slave, true, input_base)},
            {"outputs", pdoEntries(slave, false, output_base)},
        });
    }
    context.topology = {
        {"process_image", {{"inputs_bytes", context.input_size}, {"outputs_bytes", context.output_size}}},
        {"slaves", std::move(slaves)},
    };
}

uint32_t processLogicalData(dw_ec_context& context,
    const std::function<void(kickcat::DatagramState const&)>& error) {
    // createMapping() programmed each slave's FMMUs and attached its PDOs to
    // iomap. Use the standard logical cyclic exchange so the same process
    // image reaches both real slaves and software simulators.
    using namespace kickcat;
    uint32_t actual_wkc = 0;
    std::string failure;

    auto queue_mapping = [&](Slave::PIMapping& mapping, Command command,
                             bool read, const char* direction) {
        if (mapping.bsize <= 0 || mapping.data == nullptr) return;
        const auto address = mapping.address;
        const auto length = static_cast<uint16_t>(mapping.bsize);
        auto process = [destination = mapping.data, length, address, read,
                        direction, &actual_wkc, &failure](
                           DatagramHeader const*, uint8_t const* data, uint16_t wkc) {
            actual_wkc += wkc;
            if (wkc != 1) {
                if (failure.empty()) {
                    failure = std::string{"logical "} + direction +
                        " at 0x" + [&]() {
                            char text[9]{};
                            std::snprintf(text, sizeof(text), "%08x", address);
                            return std::string{text};
                        }() + " expected WKC 1, received " + std::to_string(wkc);
                }
                return DatagramState::INVALID_WKC;
            }
            if (read) std::memcpy(destination, data, length);
            return DatagramState::OK;
        };
        context.link->addDatagram(command, address,
            read ? nullptr : mapping.data, length, process, error);
    };

    for (auto& slave : context.bus->slaves()) {
        queue_mapping(slave.output, Command::LWR, false, "write");
    }
    context.link->processDatagrams();
    if (!failure.empty()) throw std::runtime_error("KickCAT " + failure + ".");

    for (auto& slave : context.bus->slaves()) {
        queue_mapping(slave.input, Command::LRD, true, "read");
    }
    context.link->processDatagrams();
    if (!failure.empty()) throw std::runtime_error("KickCAT " + failure + ".");
    return actual_wkc;
}

void readBackFmmuMappings(dw_ec_context& context) {
    using namespace kickcat;
    for (auto& slave : context.bus->slaves()) {
        const auto count = static_cast<size_t>(slave.esc.fmmus);
        if (count == 0) continue;
        std::vector<fmmu::Register> registers(count);
        std::optional<DatagramState> failure;
        for (size_t index = 0; index < count; ++index) {
            auto process = [&, index](DatagramHeader const*, uint8_t const* data, uint16_t wkc) {
                if (wkc != 1) return DatagramState::INVALID_WKC;
                std::memcpy(&registers[index], data, sizeof(fmmu::Register));
                return DatagramState::OK;
            };
            context.link->addDatagram(Command::FPRD,
                createAddress(slave.address,
                    static_cast<uint16_t>(reg::FMMU + index * sizeof(fmmu::Register))),
                nullptr, sizeof(fmmu::Register), process,
                [&](DatagramState const& state) {
                    if (!failure.has_value()) failure = state;
                });
        }
        context.link->processDatagrams();
        if (failure.has_value()) {
            throw std::runtime_error(
                std::string{"Unable to read back EtherCAT FMMU configuration: "} +
                toString(*failure));
        }

        auto apply = [&](Slave::PIMapping& mapping, uint8_t type) {
            if (mapping.bsize <= 0 || mapping.sync_manager < 0 ||
                static_cast<size_t>(mapping.sync_manager) >= slave.sii.syncManagers.size()) return;
            const auto physical = slave.sii.syncManagers[static_cast<size_t>(mapping.sync_manager)].start_address;
            const auto found = std::find_if(registers.begin(), registers.end(),
                [&](const fmmu::Register& entry) {
                    return entry.activate != 0 && entry.type == type &&
                        entry.physical_address == physical &&
                        entry.length >= static_cast<uint16_t>(mapping.bsize);
                });
            if (found != registers.end()) mapping.address = found->logical_address;
        };
        apply(slave.input, 1);
        apply(slave.output, 2);
    }
}

void scanBus(dw_ec_context& context) {
    using namespace kickcat;
    const auto adapter = context.config.value("adapter", std::string{});
    if (adapter.empty()) throw std::invalid_argument("EtherCAT requires a network adapter.");
    auto sockets = createSockets(adapter, "");
    context.nominal_socket = std::get<0>(sockets);
    context.redundant_socket = std::get<1>(sockets);

#ifdef _WIN32
    const auto source_mac = adapterMac(adapter).value_or(
        std::array<uint8_t, 6>{PRIMARY_IF_MAC[0], PRIMARY_IF_MAC[1], PRIMARY_IF_MAC[2],
            PRIMARY_IF_MAC[3], PRIMARY_IF_MAC[4], PRIMARY_IF_MAC[5]});
    context.link = std::make_shared<Link>(context.nominal_socket, context.redundant_socket,
        []() {}, source_mac.data(), SECONDARY_IF_MAC);
#else
    context.link = std::make_shared<Link>(context.nominal_socket, context.redundant_socket, []() {});
#endif
    context.link->setTimeout(std::chrono::microseconds(
        std::max(context.config.value("receive_timeout_us", 500), 50)));
    context.bus = std::make_unique<Bus>(context.link);
    context.bus->init(100ms);
    context.iomap.assign(65536, 0);
    context.bus->createMapping(context.iomap.data(), context.iomap.size());
    // Read back what the slave actually accepted. Physical hardware normally
    // echoes the mapping just programmed above. Software or fixed-configuration
    // slaves may retain an imported mapping, which is still valid and must be
    // used for cyclic logical datagrams.
    readBackFmmuMappings(context);
    context.bus->requestState(State::SAFE_OP);
    context.bus->waitForState(State::SAFE_OP, 500ms);
    buildTopology(context);
    context.scanned = true;
}
} // namespace

extern "C" {
uint32_t DW_EC_BRIDGE_CALL dw_ec_bridge_abi_version(void) { return DW_EC_BRIDGE_ABI_VERSION; }

dw_ec_result DW_EC_BRIDGE_CALL dw_ec_list_adapters_json(char* destination,
    size_t destination_size,
    size_t* required_size) {
    try {
        json adapters = json::array();
        try {
            for (const auto& adapter : kickcat::listInterfaces()) {
                json item = {
                    {"id", adapter.name},
                    {"name", adapter.description.empty() ? adapter.name : adapter.description},
                    {"kind", "hardware"},
                };
#ifdef _WIN32
                const auto info = windowsAdapterInfo(adapter.name);
                item["scan_eligible"] = info && info->ethernet && info->hardware && info->up;
                item["interface_type"] = info && info->ethernet ? "ethernet" : "other";
                item["is_hardware"] = info && info->hardware;
                item["is_up"] = info && info->up;
#else
                item["scan_eligible"] = adapter.name != "lo";
#endif
                adapters.push_back(std::move(item));
            }
        } catch (const std::exception&) {
            // The UI explains the Npcap prerequisite when no adapters are available.
        }
        return writeJson(adapters, destination, destination_size, required_size);
    } catch (...) {
        return DW_EC_INTERNAL_ERROR;
    }
}

dw_ec_result DW_EC_BRIDGE_CALL dw_ec_open(const char* config_json, dw_ec_context** context) {
    if (config_json == nullptr || context == nullptr) return DW_EC_INVALID_ARGUMENT;
    try {
        auto candidate = std::make_unique<dw_ec_context>();
        candidate->config = json::parse(config_json);
        *context = candidate.release();
        return DW_EC_OK;
    } catch (...) {
        return DW_EC_INVALID_ARGUMENT;
    }
}

void DW_EC_BRIDGE_CALL dw_ec_close(dw_ec_context* context) { delete context; }

dw_ec_result DW_EC_BRIDGE_CALL dw_ec_scan(dw_ec_context* context) {
    if (context == nullptr) return DW_EC_INVALID_ARGUMENT;
    return guard(context, [&]() { scanBus(*context); });
}

dw_ec_result DW_EC_BRIDGE_CALL dw_ec_topology_json(dw_ec_context* context,
    char* destination,
    size_t destination_size,
    size_t* required_size) {
    if (context == nullptr || !context->scanned) return DW_EC_NOT_READY;
    return writeJson(context->topology, destination, destination_size, required_size);
}

dw_ec_result DW_EC_BRIDGE_CALL dw_ec_process_image_sizes(dw_ec_context* context,
    size_t* output_size,
    size_t* input_size) {
    if (context == nullptr || output_size == nullptr || input_size == nullptr) return DW_EC_INVALID_ARGUMENT;
    if (!context->scanned) return DW_EC_NOT_READY;
    *output_size = context->output_size;
    *input_size = context->input_size;
    return DW_EC_OK;
}

dw_ec_result DW_EC_BRIDGE_CALL dw_ec_start(dw_ec_context* context) {
    if (context == nullptr) return DW_EC_INVALID_ARGUMENT;
    if (!context->scanned) return DW_EC_NOT_READY;
    return guard(context, [&]() {
        // Output FMMUs do not contribute their operational working-counter
        // increments while the bus is still in SAFE-OP. Keep process data
        // moving during the transition, but validate it only after OP has
        // been reached (the module performs an immediate verified exchange).
        auto error = [](kickcat::DatagramState const&) {};
        context->bus->processDataWrite(error);
        context->bus->processDataRead(error);
        context->bus->requestState(kickcat::State::OPERATIONAL);
        context->bus->waitForState(kickcat::State::OPERATIONAL, 500ms, [&]() {
            context->bus->processDataWrite(error);
            context->bus->processDataRead(error);
        });
        context->running = true;
    });
}

dw_ec_result DW_EC_BRIDGE_CALL dw_ec_exchange(dw_ec_context* context,
    const uint8_t* outputs,
    size_t output_size,
    uint8_t* inputs,
    size_t input_size,
    dw_ec_exchange_status* status) {
    if (context == nullptr || status == nullptr || status->struct_size < sizeof(dw_ec_exchange_status)) return DW_EC_INVALID_ARGUMENT;
    if (!context->running) return DW_EC_NOT_READY;
    if (output_size != context->output_size || input_size != context->input_size ||
        (output_size != 0 && outputs == nullptr) || (input_size != 0 && inputs == nullptr)) return DW_EC_INVALID_ARGUMENT;
    return guard(context, [&]() {
        const auto started = std::chrono::steady_clock::now();
        if (output_size != 0) std::memcpy(context->iomap.data() + context->input_size, outputs, output_size);
        const auto actual_wkc = processLogicalData(*context,
            [](kickcat::DatagramState const&) {});
        if (input_size != 0) std::memcpy(inputs, context->iomap.data(), input_size);
        ++context->cycle_count;
        status->expected_wkc = context->expected_wkc;
        status->actual_wkc = actual_wkc;
        status->exchange_duration_ns = static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::nanoseconds>(
            std::chrono::steady_clock::now() - started).count());
        status->cycle_count = context->cycle_count;
    });
}

void DW_EC_BRIDGE_CALL dw_ec_stop(dw_ec_context* context) {
    if (context == nullptr) return;
    context->running = false;
    if (context->bus) {
        try { context->bus->requestState(kickcat::State::SAFE_OP); } catch (...) {}
    }
}

const char* DW_EC_BRIDGE_CALL dw_ec_last_error(dw_ec_context* context) {
    return context == nullptr ? "No EtherCAT bridge context." : context->error.c_str();
}
} // extern C
