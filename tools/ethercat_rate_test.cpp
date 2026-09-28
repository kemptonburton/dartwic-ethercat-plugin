#include "ethercat_bridge_loader.h"

#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <numeric>
#include <string>
#include <thread>
#include <vector>

int main(int argc, char** argv) {
    std::filesystem::path bridge;
    std::string adapter;
    size_t cycles = 10000;
    int period_us = 1000;
    int receive_timeout_us = 500;
    bool scan_only = false;
    for (int i = 1; i < argc; ++i) {
        const std::string argument = argv[i];
        if (argument == "--bridge" && i + 1 < argc) bridge = argv[++i];
        else if (argument == "--adapter" && i + 1 < argc) adapter = argv[++i];
        else if (argument == "--cycles" && i + 1 < argc) cycles = std::stoull(argv[++i]);
        else if (argument == "--period-us" && i + 1 < argc) period_us = std::stoi(argv[++i]);
        else if (argument == "--receive-timeout-us" && i + 1 < argc) receive_timeout_us = std::stoi(argv[++i]);
        else if (argument == "--scan-only") scan_only = true;
        else {
            std::cerr << "Usage: ethercat_rate_test --bridge PATH --adapter ID [--cycles N] "
                         "[--period-us 1000] [--receive-timeout-us 500] [--scan-only]\n";
            return 2;
        }
    }
    if (bridge.empty() || adapter.empty()) {
        std::cerr << "Both --bridge and --adapter are required.\n";
        return 2;
    }

    try {
        EtherCAT::BridgeLibrary library(bridge);
        EtherCAT::BridgeLibrary::Master master(library,
            {{"adapter", adapter}, {"receive_timeout_us", receive_timeout_us}});
        const auto topology = master.scan();
        if (scan_only) {
            std::cout << topology.dump(2) << '\n';
            return 0;
        }
        master.start();
        std::vector<uint8_t> outputs(master.outputSize(), 0);
        std::vector<uint8_t> inputs(master.inputSize(), 0);
        std::vector<uint64_t> durations;
        durations.reserve(cycles);
        size_t deadline_misses = 0;
        auto next = std::chrono::steady_clock::now();
        const auto period = std::chrono::microseconds(period_us);
        for (size_t cycle = 0; cycle < cycles; ++cycle) {
            if (period_us > 0) {
                next += period;
                std::this_thread::sleep_until(next - period);
            }
            if (!outputs.empty()) outputs[0] = static_cast<uint8_t>(cycle);
            const auto status = master.exchange(outputs, inputs);
            durations.push_back(status.exchange_duration_ns);
            if (period_us > 0 && status.exchange_duration_ns > static_cast<uint64_t>(period_us) * 1000) {
                ++deadline_misses;
            }
        }
        master.stop();

        std::sort(durations.begin(), durations.end());
        const auto total = std::accumulate(durations.begin(), durations.end(), uint64_t{0});
        const size_t p99_index = durations.empty() ? 0 : std::min(durations.size() - 1,
            static_cast<size_t>(durations.size() * 0.99));
        std::cout << "Topology: " << topology.value("slaves", nlohmann::json::array()).size() << " slave(s), "
                  << outputs.size() << " output byte(s), " << inputs.size() << " input byte(s)\n"
                  << "Cycles: " << cycles << " at " << period_us << " us target\n"
                  << "Exchange mean: " << (durations.empty() ? 0 : total / durations.size()) / 1000.0 << " us\n"
                  << "Exchange p99: " << (durations.empty() ? 0 : durations[p99_index]) / 1000.0 << " us\n"
                  << "Deadline misses: " << deadline_misses << "\n";
        return deadline_misses == 0 ? 0 : 1;
    } catch (const std::exception& error) {
        std::cerr << "EtherCAT rate test failed: " << error.what() << '\n';
        return 1;
    }
}
