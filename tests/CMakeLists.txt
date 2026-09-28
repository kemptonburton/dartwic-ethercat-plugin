add_executable(ethercat_codec_test
    codec_test.cpp
    "${ENGINE_DIR}/src/ethercat_codec.cpp")
target_include_directories(ethercat_codec_test PRIVATE "${ENGINE_DIR}/include")
add_test(NAME ethercat_codec_test COMMAND ethercat_codec_test)

add_library(fake_ethercat_bridge SHARED fake_bridge.cpp)
target_include_directories(fake_ethercat_bridge PRIVATE "${ENGINE_DIR}/include")
set_target_properties(fake_ethercat_bridge PROPERTIES OUTPUT_NAME dartwic_ethercat_bridge_fake)

add_executable(ethercat_bridge_loader_test
    bridge_loader_test.cpp
    "${ENGINE_DIR}/src/ethercat_bridge_loader.cpp")
target_include_directories(ethercat_bridge_loader_test PRIVATE "${ENGINE_DIR}/include")
target_link_libraries(ethercat_bridge_loader_test PRIVATE nlohmann_json::nlohmann_json)
if(UNIX AND NOT APPLE)
    target_link_libraries(ethercat_bridge_loader_test PRIVATE dl)
endif()
add_test(NAME ethercat_bridge_loader_test
    COMMAND ethercat_bridge_loader_test $<TARGET_FILE:fake_ethercat_bridge>)

add_executable(ethercat_discovery_test
    ethercat_discovery_test.cpp
    "${ENGINE_DIR}/src/ethercat_discovery.cpp"
    "${ENGINE_DIR}/src/ethercat_bridge_loader.cpp")
target_include_directories(ethercat_discovery_test PRIVATE
    "${ENGINE_DIR}/include"
    "${ENGINE_DIR}/include/sdk")
target_link_libraries(ethercat_discovery_test PRIVATE nlohmann_json::nlohmann_json)
if(UNIX AND NOT APPLE)
    target_link_libraries(ethercat_discovery_test PRIVATE dl)
endif()
add_test(NAME ethercat_discovery_test COMMAND ethercat_discovery_test)
