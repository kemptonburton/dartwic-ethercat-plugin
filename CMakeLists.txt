cmake_minimum_required(VERSION 3.20)
project(dartwic_ethercat_plugin)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

set(ENGINE_DIR "${PROJECT_SOURCE_DIR}/engine")
set(PLUGIN_MANIFEST_FILE "${PROJECT_SOURCE_DIR}/plugin.json")
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${PLUGIN_MANIFEST_FILE}")
file(READ "${PLUGIN_MANIFEST_FILE}" PLUGIN_MANIFEST_JSON)
string(JSON ENGINE_PLUGIN_ID GET "${PLUGIN_MANIFEST_JSON}" id)
string(JSON MIN_ENGINE_VERSION GET "${PLUGIN_MANIFEST_JSON}" minEngineVersion)
string(JSON CONTAINS_ENGINE_PLUGIN GET "${PLUGIN_MANIFEST_JSON}" contains_engine_plugin)
if("${MIN_ENGINE_VERSION}" STREQUAL "")
    message(FATAL_ERROR "plugin.json must set minEngineVersion.")
endif()
if(NOT CONTAINS_ENGINE_PLUGIN)
    message(FATAL_ERROR "plugin.json must set contains_engine_plugin to true.")
endif()

string(TOLOWER "${CMAKE_BUILD_TYPE}" NORMALIZED_BUILD_TYPE)
set(ENGINE_PLUGIN_VARIANT "engine")
if(NORMALIZED_BUILD_TYPE STREQUAL "debug")
    set(ENGINE_PLUGIN_VARIANT "engine-debug")
endif()
set(ENGINE_PLUGIN_DIR "${PROJECT_SOURCE_DIR}/plugin/${ENGINE_PLUGIN_VARIANT}/${ENGINE_PLUGIN_ID}")

set(ETHERCAT_ENGINE_SOURCES
    "${ENGINE_DIR}/src/ethercat_bridge_loader.cpp"
    "${ENGINE_DIR}/src/ethercat_codec.cpp"
    "${ENGINE_DIR}/src/ethercat_discovery.cpp"
    "${ENGINE_DIR}/src/ethercat_module.cpp"
    "${ENGINE_DIR}/src/ethercat_plugin.cpp")
add_library(dartwic_ethercat_plugin_engine SHARED ${ETHERCAT_ENGINE_SOURCES})
file(GLOB ENGINE_INCLUDE_DIRS CONFIGURE_DEPENDS LIST_DIRECTORIES true "${ENGINE_DIR}/include/*")
target_include_directories(dartwic_ethercat_plugin_engine PRIVATE "${ENGINE_DIR}/include" ${ENGINE_INCLUDE_DIRS})

find_package(nlohmann_json CONFIG REQUIRED)
target_link_libraries(dartwic_ethercat_plugin_engine PRIVATE nlohmann_json::nlohmann_json)
if(UNIX AND NOT APPLE)
    target_link_libraries(dartwic_ethercat_plugin_engine PRIVATE dl)
endif()

set_target_properties(dartwic_ethercat_plugin_engine PROPERTIES
    OUTPUT_NAME "${ENGINE_PLUGIN_ID}"
    RUNTIME_OUTPUT_DIRECTORY "${ENGINE_PLUGIN_DIR}/bin"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${ENGINE_PLUGIN_DIR}/bin"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${ENGINE_PLUGIN_DIR}/bin"
    LIBRARY_OUTPUT_DIRECTORY "${ENGINE_PLUGIN_DIR}/bin"
    LIBRARY_OUTPUT_DIRECTORY_DEBUG "${ENGINE_PLUGIN_DIR}/bin"
    LIBRARY_OUTPUT_DIRECTORY_RELEASE "${ENGINE_PLUGIN_DIR}/bin"
    PDB_OUTPUT_DIRECTORY "${ENGINE_PLUGIN_DIR}/bin"
    PDB_OUTPUT_DIRECTORY_DEBUG "${ENGINE_PLUGIN_DIR}/bin"
    PDB_OUTPUT_DIRECTORY_RELEASE "${ENGINE_PLUGIN_DIR}/bin")

set(ENGINE_PLUGIN_COPY_COMMANDS
    COMMAND ${CMAKE_COMMAND} -E make_directory "${ENGINE_PLUGIN_DIR}"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different "${PLUGIN_MANIFEST_FILE}" "${ENGINE_PLUGIN_DIR}/plugin.json"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different "${ENGINE_DIR}/src/module_config.json" "${ENGINE_PLUGIN_DIR}/module_config.json"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different "${ENGINE_DIR}/src/default_parameters.json" "${ENGINE_PLUGIN_DIR}/default_parameters.json")

if(WIN32)
    set(DARTWIC_ETHERCAT_BRIDGE_FILE "${PROJECT_SOURCE_DIR}/build/bridge-windows/dartwic_ethercat_bridge.dll")
elseif(APPLE)
    set(DARTWIC_ETHERCAT_BRIDGE_FILE "${PROJECT_SOURCE_DIR}/build/bridge/libdartwic_ethercat_bridge.dylib")
else()
    set(DARTWIC_ETHERCAT_BRIDGE_FILE "${PROJECT_SOURCE_DIR}/build/bridge/libdartwic_ethercat_bridge.so")
endif()
if(EXISTS "${DARTWIC_ETHERCAT_BRIDGE_FILE}")
    list(APPEND ENGINE_PLUGIN_COPY_COMMANDS
        COMMAND ${CMAKE_COMMAND} -E copy_if_different "${DARTWIC_ETHERCAT_BRIDGE_FILE}" "${ENGINE_PLUGIN_DIR}/bin/")
else()
    message(STATUS "KickCAT bridge not present at ${DARTWIC_ETHERCAT_BRIDGE_FILE}; build it with npm run build:bridge before packaging or deployment")
endif()

add_custom_target(dartwic_ethercat_plugin ALL ${ENGINE_PLUGIN_COPY_COMMANDS}
    DEPENDS dartwic_ethercat_plugin_engine COMMENT "Copying EtherCAT engine plugin files")
add_custom_target(copy_engine_plugin DEPENDS dartwic_ethercat_plugin)

option(DARTWIC_ETHERCAT_BUILD_TESTS "Build codec, bridge, and rate tests" ON)
if(DARTWIC_ETHERCAT_BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()

add_executable(ethercat_rate_test tools/ethercat_rate_test.cpp "${ENGINE_DIR}/src/ethercat_bridge_loader.cpp")
target_include_directories(ethercat_rate_test PRIVATE "${ENGINE_DIR}/include")
target_link_libraries(ethercat_rate_test PRIVATE nlohmann_json::nlohmann_json)
if(UNIX AND NOT APPLE)
    target_link_libraries(ethercat_rate_test PRIVATE dl)
endif()

message(STATUS "EtherCAT engine plugin dir: ${ENGINE_PLUGIN_DIR}")
message(STATUS "EtherCAT engine plugin variant: ${ENGINE_PLUGIN_VARIANT}")
message(STATUS "Using bundled Engine SDK snapshot from engine/include/sdk.")
