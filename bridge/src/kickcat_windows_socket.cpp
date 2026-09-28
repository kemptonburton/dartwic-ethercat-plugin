#include <algorithm>
#include <cstring>
#include <stdexcept>
#include <string>

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <pcap.h>

#include "OS/Windows/Socket.h"
#include "OS/Time.h"
#include "protocol.h"

namespace kickcat {
namespace {

template <typename Function>
Function loadPcapSymbol(HMODULE library, const char* name) {
    auto* symbol = GetProcAddress(library, name);
    if (symbol == nullptr) {
        throw std::runtime_error(std::string("Npcap is missing required function `") + name + "`.");
    }
    return reinterpret_cast<Function>(symbol);
}

struct PcapApi {
    HMODULE library;
    decltype(&pcap_findalldevs_ex) find_all_devices;
    decltype(&pcap_freealldevs) free_all_devices;
    decltype(&pcap_open) open;
    decltype(&pcap_compile) compile;
    decltype(&pcap_setfilter) set_filter;
    decltype(&pcap_geterr) get_error;
    decltype(&pcap_close) close;
    decltype(&pcap_next_ex) next;
    decltype(&pcap_sendpacket) send_packet;

    PcapApi()
        : library(LoadLibraryW(L"wpcap.dll")) {
        if (library == nullptr) {
            wchar_t system_directory[MAX_PATH]{};
            const auto length = GetSystemDirectoryW(system_directory, MAX_PATH);
            if (length > 0 && length < MAX_PATH) {
                const std::wstring npcap_path = std::wstring(system_directory, length) +
                    L"\\Npcap\\wpcap.dll";
                library = LoadLibraryW(npcap_path.c_str());
            }
        }
        if (library == nullptr) {
            throw std::runtime_error(
                "Npcap is required for physical EtherCAT adapters. Install Npcap and restart DARTWIC.");
        }
        find_all_devices = loadPcapSymbol<decltype(find_all_devices)>(library, "pcap_findalldevs_ex");
        free_all_devices = loadPcapSymbol<decltype(free_all_devices)>(library, "pcap_freealldevs");
        open = loadPcapSymbol<decltype(open)>(library, "pcap_open");
        compile = loadPcapSymbol<decltype(compile)>(library, "pcap_compile");
        set_filter = loadPcapSymbol<decltype(set_filter)>(library, "pcap_setfilter");
        get_error = loadPcapSymbol<decltype(get_error)>(library, "pcap_geterr");
        close = loadPcapSymbol<decltype(close)>(library, "pcap_close");
        next = loadPcapSymbol<decltype(next)>(library, "pcap_next_ex");
        send_packet = loadPcapSymbol<decltype(send_packet)>(library, "pcap_sendpacket");
    }
};

PcapApi& pcapApi() {
    static PcapApi api;
    return api;
}

} // namespace

std::string NetworkInterface::format() const {
    return name + " (" + description + ")";
}

std::vector<NetworkInterface> listInterfaces() {
    auto& api = pcapApi();
    pcap_if_t* devices = nullptr;
    char error[PCAP_ERRBUF_SIZE]{};
    if (api.find_all_devices(PCAP_SRC_IF_STRING, nullptr, &devices, error) == -1) {
        throw std::runtime_error(std::string("Unable to enumerate Npcap adapters: ") + error);
    }

    std::vector<NetworkInterface> interfaces;
    for (pcap_if_t* device = devices; device != nullptr; device = device->next) {
        interfaces.push_back({
            device->name == nullptr ? "" : device->name,
            device->description == nullptr ? "" : device->description,
        });
    }
    api.free_all_devices(devices);
    return interfaces;
}

Socket::Socket(nanoseconds polling_period)
    : AbstractSocket(),
      fd_(nullptr),
      polling_period_(polling_period) {
    error_.resize(PCAP_ERRBUF_SIZE);
}

void Socket::open(std::string const& interface) {
    auto& api = pcapApi();
    fd_ = api.open(interface.c_str(), 65536,
        PCAP_OPENFLAG_PROMISCUOUS | PCAP_OPENFLAG_MAX_RESPONSIVENESS |
            PCAP_OPENFLAG_NOCAPTURE_LOCAL,
        -1, nullptr, error_.data());
    if (fd_ == nullptr) throw std::runtime_error(error_.data());

    const std::string filter = "ether proto 0x88a4";
    bpf_program program{};
    if (api.compile(static_cast<pcap_t*>(fd_), &program, filter.c_str(), 0,
            PCAP_NETMASK_UNKNOWN) == -1) {
        throw std::runtime_error(api.get_error(static_cast<pcap_t*>(fd_)));
    }
    if (api.set_filter(static_cast<pcap_t*>(fd_), &program) == -1) {
        throw std::runtime_error("Unable to apply the EtherCAT packet filter.");
    }
}

void Socket::setTimeout(nanoseconds timeout) {
    timeout_ = timeout;
}

void Socket::close() noexcept {
    if (fd_ == nullptr) return;
    try {
        pcapApi().close(static_cast<pcap_t*>(fd_));
    } catch (...) {
    }
    fd_ = nullptr;
}

int32_t Socket::read(void* frame, int32_t frame_size) {
    auto& api = pcapApi();
    pcap_pkthdr* header = nullptr;
    const unsigned char* data = nullptr;
    const auto deadline = now() + timeout_;
    do {
        if (api.next(static_cast<pcap_t*>(fd_), &header, &data) == 1) {
            const auto to_copy = std::min(static_cast<int32_t>(header->len), frame_size);
            std::memcpy(frame, data, to_copy);
            return to_copy;
        }
        sleep(polling_period_);
    } while (now() < deadline);
    return -ETIMEDOUT;
}

int32_t Socket::write(void const* frame, int32_t frame_size) {
    const auto result = pcapApi().send_packet(static_cast<pcap_t*>(fd_),
        static_cast<const unsigned char*>(frame), frame_size);
    return result == 0 ? frame_size : -EIO;
}

} // namespace kickcat
