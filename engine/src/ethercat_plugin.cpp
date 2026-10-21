#include "ethercat_plugin.h"

#include "ethercat_codec.h"
#include "ethercat_discovery.h"
#include "ethercat_module.h"

#include <algorithm>
#include <array>
#include <chrono>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

namespace EtherCAT {
namespace {
using DARTWIC::API::ChannelField;
using DARTWIC::API::ChannelStorage;

constexpr const char* ethercat_icon =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E"
    "%3Cpath fill='%23e63032' d='M2 4h13V1l7 5.5-7 5.5V9H2z'/%3E"
    "%3Cpath fill='%23e63032' d='M22 15H9v-3l-7 5.5L9 23v-3h13z'/%3E%3C/svg%3E";

struct Mapping {
    std::string channel;
    std::string readback_channel;
    bool channel_to_device = false;
    size_t bit_offset = 0;
    size_t bit_length = 0;
    ValueType type = ValueType::UInt16;
    double scale = 1.0;
    double offset = 0.0;
    int slave_position = -1;
    int index = -1;
    int subindex = -1;
};

struct CycleContext {
    std::shared_ptr<EthercatModule> module;
    std::vector<Mapping> outputs;
    std::vector<Mapping> inputs;
    std::vector<DARTWIC::API::FixedChannelHandle> output_channels;
    std::vector<DARTWIC::API::FixedChannelHandle> output_readback_channels;
    std::vector<DARTWIC::API::FixedChannelHandle> input_channels;
    std::array<DARTWIC::API::FixedChannelHandle, 4> diagnostic_channels;
    std::vector<double> output_values;
    std::vector<double> output_readback_values;
    std::vector<double> input_values;
    std::array<double, 4> diagnostic_values{};
    std::vector<uint8_t> output_image;
    std::vector<uint8_t> input_image;
    std::string task_name;
    std::string cycle_error_title;
    std::vector<std::string> cycle_error_channels;
    std::chrono::steady_clock::time_point last_failure_report{};
    uint64_t consecutive_failures = 0;
};

std::string diagnosticChannel(const std::string& task, const char* suffix) {
    return task + ".ethercat." + suffix;
}

void createFixedChannel(DARTWIC::API::SDK_API* api, const std::string& channel, double initial = 0.0) {
    (void)api->createFixedChannel(channel, initial);
}

void createObservedChannel(DARTWIC::API::SDK_API* api,
    const std::string& channel,
    double initial = 0.0) {
    createFixedChannel(api, channel, initial);
    api->setChannel(channel, DARTWIC::API::ChannelValue{initial});
}

std::vector<Mapping> parseMappings(const nlohmann::json& arguments) {
    if (!arguments.contains("mappings") || !arguments.at("mappings").is_array()) return {};
    std::vector<Mapping> mappings;
    for (const auto& value : arguments.at("mappings")) {
        if (!value.is_object()) throw std::invalid_argument("Each EtherCAT mapping must be an object.");
        Mapping mapping;
        mapping.channel = value.value("channel", std::string{});
        const auto direction = value.value("direction", std::string{});
        mapping.channel_to_device = direction == "channel_to_device";
        if (!mapping.channel_to_device && direction != "device_to_channel") {
            throw std::invalid_argument("EtherCAT mapping direction must be channel_to_device or device_to_channel.");
        }
        if (mapping.channel.empty()) throw std::invalid_argument("Every EtherCAT mapping requires a channel.");
        if (mapping.channel_to_device) {
            mapping.readback_channel = value.value("readback_channel", mapping.channel + "_state");
            if (mapping.readback_channel.empty()) {
                throw std::invalid_argument("Every EtherCAT output mapping requires a readback channel.");
            }
            if (mapping.readback_channel == mapping.channel) {
                throw std::invalid_argument("An EtherCAT output command and its readback must use different channels.");
            }
        }
        mapping.bit_offset = value.value("bit_offset", size_t{0});
        mapping.bit_length = value.value("bit_length", size_t{0});
        mapping.type = parseValueType(value.value("data_type", std::string{"uint16"}));
        mapping.scale = value.value("scale", 1.0);
        mapping.offset = value.value("offset", 0.0);
        mapping.slave_position = value.value("slave_position", -1);
        mapping.index = value.value("index", -1);
        mapping.subindex = value.value("subindex", -1);
        if (mapping.bit_length == 0 || mapping.bit_length > 64) {
            throw std::invalid_argument("EtherCAT PDO mapping bit length must be between 1 and 64.");
        }
        mappings.push_back(std::move(mapping));
    }
    return mappings;
}

std::shared_ptr<EthercatModule> moduleFor(DARTWIC::API::SDK_API* api, const std::string& name) {
    auto module = std::dynamic_pointer_cast<EthercatModule>(api->getModuleInstance(name));
    if (!module) throw std::runtime_error(
        "Configured EtherCAT module instance `" + name + "` is not available.");
    return module;
}

void validateMappings(const CycleContext& context) {
    const auto output_bits = context.output_image.size() * 8;
    const auto input_bits = context.input_image.size() * 8;
    for (const auto& mapping : context.outputs) {
        if (mapping.bit_offset + mapping.bit_length > output_bits) throw std::runtime_error(
            "Output PDO mapping for `" + mapping.channel + "` is outside the process image. Rescan and reselect its PDO entry.");
    }
    for (const auto& mapping : context.inputs) {
        if (mapping.bit_offset + mapping.bit_length > input_bits) throw std::runtime_error(
            "Input PDO mapping for `" + mapping.channel + "` is outside the process image. Rescan and reselect its PDO entry.");
    }
}

void configureCycle(DARTWIC::API::SDK_API* api, DARTWIC::API::TaskRuntime& runtime) {
    const auto& arguments = runtime.getArguments();
    const auto instance = arguments.value("module_instance_name", std::string{});
    if (instance.empty()) throw std::runtime_error("ethercat.cycle requires module_instance_name.");
    auto module = moduleFor(api, instance);
    const auto mappings = parseMappings(arguments);

    std::vector<std::string> fixed_inputs;
    for (const auto& mapping : mappings) {
        if (mapping.channel_to_device) {
            createFixedChannel(module->dartwic, mapping.channel);
            createObservedChannel(module->dartwic, mapping.readback_channel);
            fixed_inputs.push_back(mapping.channel);
        } else {
            createObservedChannel(module->dartwic, mapping.channel);
        }
    }
    runtime.setFixedInputChannels(std::move(fixed_inputs));
    createObservedChannel(module->dartwic,
        diagnosticChannel(runtime.getTaskName(), "exchange_time_us"));
    createObservedChannel(module->dartwic,
        diagnosticChannel(runtime.getTaskName(), "actual_wkc"));
    createObservedChannel(module->dartwic,
        diagnosticChannel(runtime.getTaskName(), "expected_wkc"));
    createObservedChannel(module->dartwic,
        diagnosticChannel(runtime.getTaskName(), "failure_count"));
    auto context = std::make_shared<CycleContext>();
    context->task_name = runtime.getTaskName();
    context->cycle_error_title = "ETHERCAT CYCLE ERROR [" + instance + "]";
    context->module = std::move(module);
    for (auto mapping : mappings) {
        if (mapping.channel_to_device) {
            context->output_channels.push_back(context->module->dartwic->createFixedChannel(mapping.channel));
            context->output_readback_channels.push_back(
                context->module->dartwic->createFixedChannel(mapping.readback_channel));
            context->outputs.push_back(std::move(mapping));
        } else {
            context->input_channels.push_back(context->module->dartwic->createFixedChannel(mapping.channel));
            context->inputs.push_back(std::move(mapping));
        }
    }
    for (const auto& mapping : context->inputs) context->cycle_error_channels.push_back(mapping.channel);
    constexpr std::array<const char*, 4> suffixes = {
        "exchange_time_us", "actual_wkc", "expected_wkc", "failure_count"};
    for (size_t index = 0; index < suffixes.size(); ++index) {
        context->diagnostic_channels[index] = context->module->dartwic->createFixedChannel(
            diagnosticChannel(context->task_name, suffixes[index]));
    }
    context->output_values.resize(context->outputs.size());
    context->output_readback_values.resize(context->outputs.size());
    context->input_values.resize(context->inputs.size());
    runtime.setTypedRuntimeContext("ethercat.cycle", context);
}

void startCycle(DARTWIC::API::SDK_API* api,
    DARTWIC::API::TaskRuntime& runtime) {
    const auto context = runtime.getTypedRuntimeContext<CycleContext>("ethercat.cycle");
    if (!context || !context->module) throw std::runtime_error("EtherCAT cycle was not prepared.");
    if (context->outputs.empty() && context->inputs.empty()) {
        throw std::runtime_error(
            "Configure at least one EtherCAT PDO mapping before starting this task.");
    }

    // CAESAR releases task-owned channel authority when a task stops. Restore
    // observe-only ownership on every start, including starts without a new
    // configuration pass. Resolve first so missing channels fail without being
    // recreated accidentally as dynamic storage by setChannel.
    for (const auto& mapping : context->outputs) {
        api->setChannel(mapping.readback_channel);
    }
    for (const auto& mapping : context->inputs) {
        api->setChannel(mapping.channel);
    }
    for (const auto* suffix : {"exchange_time_us", "actual_wkc", "expected_wkc", "failure_count"}) {
        api->setChannel(diagnosticChannel(context->task_name, suffix));
    }
    if (context->module->isConnected()) {
        context->output_image.assign(context->module->outputSize(), uint8_t{0});
        context->input_image.assign(context->module->inputSize(), uint8_t{0});
        validateMappings(*context);
    }
    context->consecutive_failures = 0;
    context->module->start(context->task_name);
}

uint64_t unixNanoseconds() {
    return static_cast<uint64_t>(std::chrono::duration_cast<std::chrono::nanoseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count());
}

void publishValues(DARTWIC::API::SDK_API* api,
    const std::vector<DARTWIC::API::FixedChannelHandle>& channels,
    const std::vector<double>& values, uint64_t timestamp) {
    for (size_t index = 0; index < channels.size(); ++index) {
        if (!api->upsertChannel(channels[index], values[index], timestamp)) {
            throw std::runtime_error("EtherCAT fixed-channel publication was rejected.");
        }
    }
}

void publishDiagnostics(CycleContext& context, uint64_t timestamp) {
    for (size_t index = 0; index < context.diagnostic_channels.size(); ++index) {
        if (!context.module->dartwic->upsertChannel(
                context.diagnostic_channels[index], context.diagnostic_values[index], timestamp)) {
            throw std::runtime_error("EtherCAT diagnostic publication was rejected.");
        }
    }
}

void publishFailureDiagnostics(CycleContext& context) noexcept {
    context.diagnostic_values[0] = 0.0;
    context.diagnostic_values[1] = 0.0;
    context.diagnostic_values[2] = 0.0;
    context.diagnostic_values[3] = static_cast<double>(context.consecutive_failures);
    try {
        publishDiagnostics(context, unixNanoseconds());
    } catch (...) {
        // Diagnostics must never stop the reconnect loop.
    }
}

void reportCycleFailure(CycleContext& context, const char* detail) noexcept {
    const auto now = std::chrono::steady_clock::now();
    if (context.last_failure_report.time_since_epoch().count() != 0 &&
        now - context.last_failure_report < std::chrono::seconds(2)) return;
    context.last_failure_report = now;
    try {
        context.module->dartwic->consoleError(
            context.cycle_error_title, detail, context.cycle_error_channels,
            "Check EtherCAT working counters, device state, and cyclic task diagnostics.",
            0, 10.0);
    } catch (...) {
        // ARGUS admission must not stop the cyclic task.
    }
}

void runCycle(DARTWIC::API::TaskRuntime& runtime) {
    const auto context = runtime.getTypedRuntimeContext<CycleContext>("ethercat.cycle");
    if (!context || !context->module || context->module->dartwic == nullptr) return;
    auto* api = context->module->dartwic;
    if (!context->module->isOwnedBy(context->task_name) || !context->module->isConnected()) return;
    try {
        const auto output_size = context->module->outputSize();
        const auto input_size = context->module->inputSize();
        if (context->output_image.size() != output_size || context->input_image.size() != input_size) {
            context->output_image.assign(output_size, uint8_t{0});
            context->input_image.assign(input_size, uint8_t{0});
            validateMappings(*context);
        }
        if (!context->output_channels.empty()) {
            for (size_t index = 0; index < context->output_channels.size(); ++index) {
                context->output_values[index] = api->queryChannel(context->output_channels[index], 0.0);
            }
            for (size_t i = 0; i < context->outputs.size(); ++i) {
                const auto& mapping = context->outputs[i];
                encodeValue(context->output_image, mapping.bit_offset, mapping.bit_length,
                    mapping.type, context->output_values[i], mapping.scale, mapping.offset);
            }
        }

        const auto status = context->module->exchange(context->output_image, context->input_image);
        const auto timestamp = unixNanoseconds();
        for (size_t i = 0; i < context->outputs.size(); ++i) {
            const auto& mapping = context->outputs[i];
            context->output_readback_values[i] = decodeValue(context->output_image, mapping.bit_offset,
                mapping.bit_length, mapping.type, mapping.scale, mapping.offset);
        }
        if (!context->output_readback_channels.empty()) {
            publishValues(api, context->output_readback_channels, context->output_readback_values, timestamp);
        }
        for (size_t i = 0; i < context->inputs.size(); ++i) {
            const auto& mapping = context->inputs[i];
            context->input_values[i] = decodeValue(context->input_image, mapping.bit_offset,
                mapping.bit_length, mapping.type, mapping.scale, mapping.offset);
        }
        if (!context->input_channels.empty()) {
            publishValues(api, context->input_channels, context->input_values, timestamp);
        }
        context->consecutive_failures = 0;
        context->diagnostic_values[0] = static_cast<double>(status.exchange_duration_ns) / 1000.0;
        context->diagnostic_values[1] = static_cast<double>(status.actual_wkc);
        context->diagnostic_values[2] = static_cast<double>(status.expected_wkc);
        context->diagnostic_values[3] = 0.0;
        publishDiagnostics(*context, timestamp);
    } catch (const std::exception& error) {
        ++context->consecutive_failures;
        publishFailureDiagnostics(*context);
        reportCycleFailure(*context, error.what());
    } catch (...) {
        ++context->consecutive_failures;
        publishFailureDiagnostics(*context);
        reportCycleFailure(*context, "Unknown EtherCAT cyclic exchange failure.");
    }
}

void stopCycle(DARTWIC::API::TaskRuntime& runtime) noexcept {
    const auto context = runtime.getTypedRuntimeContext<CycleContext>("ethercat.cycle");
    if (context && context->module) {
        context->module->stop(context->task_name);
    }
    runtime.removeRuntimeContext("ethercat.cycle");
}
} // namespace

void EthercatPlugin::onPluginLoaded() {
    dartwic->registerModuleType({
        .id = "master",
        .name = "EtherCAT Master",
    });

    auto device_finder = createEthercatDeviceFinder(dartwic, config);
    dartwic->registerOperation("get_discovery_settings", "Get EtherCAT Discovery Settings",
        [device_finder](const nlohmann::json&) { return device_finder->settings(); });
    dartwic->registerOperation("scan_devices", "Scan for EtherCAT Devices",
        [device_finder](const nlohmann::json&) { return device_finder->scanNow(); });
    dartwic->registerLoop("device_discovery", "EtherCAT Device Discovery", {
        .on_loop = [device_finder]() { device_finder->tick(); },
        .target_frequency_hz = 2.0,
    });
    dartwic->registerLoop("connection_monitor", "EtherCAT Connection Monitor", {
        .on_loop = [this]() {
            for (const auto& summary : dartwic->getModuleInstances("ethercat")) {
                const auto module = std::dynamic_pointer_cast<EthercatModule>(
                    dartwic->getModuleInstance(summary.name));
                if (module) module->monitorConnection();
            }
        },
        .target_frequency_hz = 1.0,
    });

    dartwic->registerOperation("adapters", "List EtherCAT adapters", [](const nlohmann::json&) {
        BridgeLibrary bridge;
        return bridge.listAdapters();
    });
    dartwic->registerOperation("scan", "Scan EtherCAT bus", [this](const nlohmann::json& payload) {
        const auto instance = payload.value("module_instance_name", std::string{});
        if (instance.empty()) throw std::invalid_argument("scan requires module_instance_name.");
        return moduleFor(dartwic, instance)->scan();
    });

    DARTWIC::API::TaskTypeDefinition task;
    task.metadata.structure = DARTWIC::API::TaskStructure::Periodic;
    task.metadata.icon_url = ethercat_icon;
    task.metadata.default_arguments = {
        {"module_instance_name", ""},
        {"mappings", nlohmann::json::array()},
    };
    task.on_configure = [this](const auto&, DARTWIC::API::TaskRuntime& runtime) {
        configureCycle(dartwic, runtime);
    };
    task.on_start = [this](const auto&, DARTWIC::API::TaskRuntime& runtime) {
        startCycle(dartwic, runtime);
    };
    task.on_task = [](const auto&, DARTWIC::API::TaskRuntime& runtime, double) { runCycle(runtime); };
    task.on_end = [](const auto&, DARTWIC::API::TaskRuntime& runtime) { stopCycle(runtime); };
    task.cleanup = stopCycle;
    dartwic->registerTaskType("cycle", "EtherCAT Cyclic I/O", std::move(task));
}

DARTWIC::Modules::BaseModule* EthercatPlugin::createModule(const std::string& module_type_id,
    nlohmann::json config,
    DARTWIC::API::SDK_API* api) {
    if (module_type_id != "master") return nullptr;
    return new EthercatModule(std::move(config), api);
}
} // namespace EtherCAT

DARTWIC_PLUGIN_EXPORT uint32_t dartwicEngineSdkAbiVersion() noexcept {
    return DARTWIC::Plugins::ENGINE_PLUGIN_SDK_ABI_VERSION;
}

DARTWIC_PLUGIN_EXPORT DARTWIC::Plugins::BasePlugin* createPlugin(
    nlohmann::json config,
    DARTWIC::API::SDK_API* api) {
    return new EtherCAT::EthercatPlugin(std::move(config), api);
}
