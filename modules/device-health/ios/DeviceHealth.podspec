Pod::Spec.new do |s|
  s.name = 'DeviceHealth'
  s.version = '1.0.0'
  s.summary = 'Saathi local device health readings'
  s.description = 'Public OS thermal, battery and own-process resource metrics.'
  s.license = { :type => 'Proprietary' }
  s.author = 'Saathi'
  s.homepage = 'https://expo.dev'
  s.source = { :path => '.' }
  s.platforms = { :ios => '17.0' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
