#include "ethercat_bridge_loader.h"

#include <array>
#include <stdexcept>
#include <utility>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#else
#include <dlfcn.h>
#endif

namespace EtherCAT {
namespace {
#ifdef _WIN32
using LibraryHandle = HMODULE;

LibraryHandle openLibrary(const std::filesystem::path& path) {
    const auto absolute_path = std::filesystem::absolute(path).make_preferred();
    return LoadLibraryExW(absolute_path.c_str(), nullptr,
        LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
}

void closeLibrary(LibraryHandle handle) {
    if (handle != nullptr) FreeLibrary(handle);
}

void* findSymbol(LibraryHandle handle, const char* name) {
    return reinterpret_cast<void*>(GetProcAddress(handle, name));
}

std::string platformError() {
    return "Windows loader error " + std::to_string(GetLastError());
}
#else
using LibraryHandle = void*;

LibraryHandle openLibrary(const std::filesystem::path& path) {
    return dlopen(path.c_str(), RTLD_NOW | RTLD_LOCAL);
}

void closeLibrary(LibraryHandle handle) {
    if (handle != nullptr) dlclose(handle);
}

void* findSymbol(LibraryHandle handle, const char* name) {
    return dlsym(handle, name);
}

std::string platformError() {
    const char* error = dlerror();
    return error == nullptr ? "unknown dynamic loader error" : error;
}
#endif

template <typename Function>
Function requireSymbol(LibraryHandle handle, const char* name) {
    auto* symbol = findSymbol(handle, name);
    if (symbol == nullptr) throw std::runtime_error(
        std::string("EtherCAT bridge is missing symbol `") + name + "`.");
    return reinterpret_cast<Function>(symbol);
}

using JsonQuery = dw_ec_result (DW_EC_BRIDGE_CALL *)(char*, size_t, size_t*);
using ContextJsonQuery = dw_ec_result (DW_EC_BRIDGE_CALL *)(dw_ec_context*, char*, size_t, size_t*);

nlohmann::json readJson(JsonQuery query, const std::string& action) {
    size_t required = 0;
    auto result = query(nullptr, 0, &required);
    if (result != DW_EC_OK || required == 0) throw std::runtime_error(action + " failed.");
    std::vector<char> buffer(required);
    result = query(buffer.data(), buffer.size(), &required);
    if (result != DW_EC_OK) throw std::runtime_error(action + " failed.");
    return nlohmann::json::parse(buffer.data());
}

} // namespace

struct BridgeLibrary::Api {
    LibraryHandle library = nullptr;
    uint32_t (DW_EC_BRIDGE_CALL *abi_version)() = nullptr;
    JsonQuery list_adapters = nullptr;
    dw_ec_result (DW_EC_BRIDGE_CALL *open)(const char*, dw_ec_context**) = nullptr;
    void (DW_EC_BRIDGE_CALL *close)(dw_ec_context*) = nullptr;
    dw_ec_result (DW_EC_BRIDGE_CALL *scan)(dw_ec_context*) = nullptr;
    ContextJsonQuery topology = nullptr;
    dw_ec_result (DW_EC_BRIDGE_CALL *sizes)(dw_ec_context*, size_t*, size_t*) = nullptr;
    dw_ec_result (DW_EC_BRIDGE_CALL *start)(dw_ec_context*) = nullptr;
    dw_ec_result (DW_EC_BRIDGE_CALL *exchange)(dw_ec_context*, const uint8_t*, size_t,
        uint8_t*, size_t, dw_ec_exchange_status*) = nullptr;
    void (DW_EC_BRIDGE_CALL *stop)(dw_ec_context*) = nullptr;
    const char* (DW_EC_BRIDGE_CALL *last_error)(dw_ec_context*) = nullptr;

    ~Api() { closeLibrary(library); }
};

namespace {
std::runtime_error bridgeFailure(const BridgeLibrary::Api& api,
    dw_ec_context* context,
    const std::string& action,
    dw_ec_result result) {
    const char* detail = context == nullptr ? nullptr : api.last_error(context);
    return std::runtime_error(action + " failed (bridge result " +
        std::to_string(static_cast<int>(result)) + ")" +
        (detail != nullptr && *detail != '\0' ? ": " + std::string(detail) : "."));
}

nlohmann::json readJson(const BridgeLibrary::Api& api,
    dw_ec_context* context,
    ContextJsonQuery query,
    const std::string& action) {
    size_t required = 0;
    auto result = query(context, nullptr, 0, &required);
    if (result != DW_EC_OK || required == 0) throw bridgeFailure(api, context, action, result);
    std::vector<char> buffer(required);
    result = query(context, buffer.data(), buffer.size(), &required);
    if (result != DW_EC_OK) throw bridgeFailure(api, context, action, result);
    return nlohmann::json::parse(buffer.data());
}
} // namespace

std::filesystem::path defaultBridgePath() {
#ifdef _WIN32
    HMODULE module = nullptr;
    GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
            GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
        reinterpret_cast<LPCWSTR>(&defaultBridgePath), &module);
    std::array<wchar_t, 32768> path{};
    const auto length = GetModuleFileNameW(module, path.data(), static_cast<DWORD>(path.size()));
    return std::filesystem::path(std::wstring(path.data(), length)).parent_path() /
        "dartwic_ethercat_bridge.dll";
#else
    Dl_info info{};
    if (dladdr(reinterpret_cast<void*>(&defaultBridgePath), &info) == 0 || info.dli_fname == nullptr) {
        return "libdartwic_ethercat_bridge.so";
    }
    return std::filesystem::path(info.dli_fname).parent_path() / "libdartwic_ethercat_bridge.so";
#endif
}

BridgeLibrary::BridgeLibrary(const std::filesystem::path& explicit_path)
    : api_(std::make_unique<Api>()) {
    const auto path = explicit_path.empty() ? defaultBridgePath() : explicit_path;
    api_->library = openLibrary(path);
    if (api_->library == nullptr) {
        const auto error = platformError();
        throw std::runtime_error("Unable to load EtherCAT bridge `" + path.string() + "`: " + error);
    }

    api_->abi_version = requireSymbol<decltype(api_->abi_version)>(api_->library, "dw_ec_bridge_abi_version");
    api_->list_adapters = requireSymbol<decltype(api_->list_adapters)>(api_->library, "dw_ec_list_adapters_json");
    api_->open = requireSymbol<decltype(api_->open)>(api_->library, "dw_ec_open");
    api_->close = requireSymbol<decltype(api_->close)>(api_->library, "dw_ec_close");
    api_->scan = requireSymbol<decltype(api_->scan)>(api_->library, "dw_ec_scan");
    api_->topology = requireSymbol<decltype(api_->topology)>(api_->library, "dw_ec_topology_json");
    api_->sizes = requireSymbol<decltype(api_->sizes)>(api_->library, "dw_ec_process_image_sizes");
    api_->start = requireSymbol<decltype(api_->start)>(api_->library, "dw_ec_start");
    api_->exchange = requireSymbol<decltype(api_->exchange)>(api_->library, "dw_ec_exchange");
    api_->stop = requireSymbol<decltype(api_->stop)>(api_->library, "dw_ec_stop");
    api_->last_error = requireSymbol<decltype(api_->last_error)>(api_->library, "dw_ec_last_error");
    if (api_->abi_version() != DW_EC_BRIDGE_ABI_VERSION) throw std::runtime_error(
        "EtherCAT bridge ABI mismatch: plugin expects " +
        std::to_string(DW_EC_BRIDGE_ABI_VERSION) + ", bridge reports " +
        std::to_string(api_->abi_version()) + ".");
}

BridgeLibrary::~BridgeLibrary() = default;

nlohmann::json BridgeLibrary::listAdapters() const {
    return readJson(api_->list_adapters, "Listing EtherCAT adapters");
}

BridgeLibrary::Master::Master(const BridgeLibrary& library, const nlohmann::json& config)
    : library_(library) {
    const auto text = config.dump();
    const auto result = library_.api_->open(text.c_str(), &context_);
    if (result != DW_EC_OK || context_ == nullptr) {
        throw bridgeFailure(*library_.api_, context_, "Opening EtherCAT master", result);
    }
}

BridgeLibrary::Master::~Master() {
    if (context_ != nullptr) {
        library_.api_->stop(context_);
        library_.api_->close(context_);
    }
}

nlohmann::json BridgeLibrary::Master::scan() {
    const auto result = library_.api_->scan(context_);
    if (result != DW_EC_OK) throw bridgeFailure(*library_.api_, context_, "Scanning EtherCAT bus", result);
    const auto topology = readJson(*library_.api_, context_, library_.api_->topology,
        "Reading EtherCAT topology");
    const auto size_result = library_.api_->sizes(context_, &output_size_, &input_size_);
    if (size_result != DW_EC_OK) throw bridgeFailure(
        *library_.api_, context_, "Reading process-image sizes", size_result);
    return topology;
}

void BridgeLibrary::Master::start() {
    const auto result = library_.api_->start(context_);
    if (result != DW_EC_OK) throw bridgeFailure(*library_.api_, context_, "Starting EtherCAT master", result);
}

dw_ec_exchange_status BridgeLibrary::Master::exchange(std::span<const uint8_t> outputs,
    std::span<uint8_t> inputs) {
    if (outputs.size() != output_size_ || inputs.size() != input_size_) {
        throw std::invalid_argument("EtherCAT process-image buffer size does not match the scanned topology.");
    }
    dw_ec_exchange_status status{};
    status.struct_size = sizeof(status);
    const auto result = library_.api_->exchange(context_, outputs.data(), outputs.size(),
        inputs.data(), inputs.size(), &status);
    if (result != DW_EC_OK) throw bridgeFailure(*library_.api_, context_, "EtherCAT exchange", result);
    return status;
}

void BridgeLibrary::Master::stop() noexcept {
    if (context_ != nullptr) library_.api_->stop(context_);
}
} // namespace EtherCAT
