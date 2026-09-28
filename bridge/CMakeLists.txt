cmake_minimum_required(VERSION 3.20)
project(dartwic_ethercat_bridge LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

find_package(nlohmann_json CONFIG REQUIRED)
find_package(tinyxml2 CONFIG REQUIRED)

set(BUILD_MASTER_EXAMPLES OFF CACHE BOOL "" FORCE)
set(BUILD_SLAVE_EXAMPLES OFF CACHE BOOL "" FORCE)
set(BUILD_UNIT_TESTS OFF CACHE BOOL "" FORCE)
set(BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(BUILD_SIMULATION OFF CACHE BOOL "" FORCE)
set(ENABLE_ESI_PARSER ON CACHE BOOL "" FORCE)
set(ENABLE_AF_XDP OFF CACHE BOOL "" FORCE)
set(KICKCAT_INSTALL OFF CACHE BOOL "" FORCE)

FetchContent_Declare(kickcat
    GIT_REPOSITORY https://github.com/leducp/KickCAT.git
    GIT_TAG f10386d54f734d388a405b4dae506801e35c238b
    GIT_SHALLOW FALSE)
FetchContent_MakeAvailable(kickcat)
if(WIN32)
    # KickCAT 2.6-rc3 stores caller-provided source MACs but still uses its
    # placeholder constants in two transmit paths. Patch the pinned source so
    # Windows/Npcap frames carry the selected adapter's real MAC address.
    set(KICKCAT_LINK_SOURCE "${kickcat_SOURCE_DIR}/lib/master/src/Link.cc")
    file(READ "${KICKCAT_LINK_SOURCE}" KICKCAT_LINK_CONTENT)
    string(REPLACE "PRIMARY_IF_MAC" "src_nominal_" KICKCAT_LINK_CONTENT "${KICKCAT_LINK_CONTENT}")
    string(REPLACE "SECONDARY_IF_MAC" "src_redundancy_" KICKCAT_LINK_CONTENT "${KICKCAT_LINK_CONTENT}")
    file(WRITE "${KICKCAT_LINK_SOURCE}" "${KICKCAT_LINK_CONTENT}")

    # Replace KickCAT's directly linked Windows socket translation unit with a
    # lazy-loading equivalent. This lets the plugin load and report a useful
    # adapter error when Npcap is missing instead of failing DLL discovery.
    configure_file(
        src/kickcat_windows_socket.cpp
        "${kickcat_SOURCE_DIR}/lib/src/OS/Windows/Socket.cc"
        COPYONLY)
    configure_file(
        src/kickcat_windows_time.cpp
        "${kickcat_SOURCE_DIR}/lib/src/OS/Windows/Time.cc"
        COPYONLY)
endif()
set_target_properties(kickcat PROPERTIES POSITION_INDEPENDENT_CODE ON)

add_library(dartwic_ethercat_bridge SHARED src/dartwic_ethercat_bridge.cpp)
target_include_directories(dartwic_ethercat_bridge PRIVATE ../engine/include)
target_link_libraries(dartwic_ethercat_bridge PRIVATE kickcat nlohmann_json::nlohmann_json)
if(WIN32)
    target_link_libraries(dartwic_ethercat_bridge PRIVATE iphlpapi)
endif()
target_compile_definitions(dartwic_ethercat_bridge PRIVATE DW_EC_BRIDGE_BUILD=1)

set_target_properties(dartwic_ethercat_bridge PROPERTIES
    OUTPUT_NAME dartwic_ethercat_bridge
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN ON)

if(WIN32)
    set_target_properties(dartwic_ethercat_bridge PROPERTIES PREFIX "")
endif()

if(MINGW)
    target_link_options(dartwic_ethercat_bridge PRIVATE -static -static-libgcc -static-libstdc++)
endif()

install(TARGETS dartwic_ethercat_bridge
    RUNTIME DESTINATION bin
    LIBRARY DESTINATION lib)
