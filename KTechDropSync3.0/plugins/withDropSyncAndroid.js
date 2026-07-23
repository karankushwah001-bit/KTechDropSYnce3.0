const { AndroidConfig, withAndroidManifest, withPlugins } = require('@expo/config-plugins');

const SERVICE_NAME = 'com.ktechsolutions.dropsyncnative.DropSyncForegroundService';

const REQUIRED_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_WIFI_STATE',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  'android.permission.WAKE_LOCK',
  'android.permission.POST_NOTIFICATIONS',
];

function withDropSyncPermissions(config) {
  return AndroidConfig.Permissions.withPermissions(config, REQUIRED_PERMISSIONS);
}

function withDropSyncService(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    if (!application.service) application.service = [];

    const alreadyDeclared = application.service.some(
      (s) => s['$'] && s['$']['android:name'] === SERVICE_NAME
    );

    if (!alreadyDeclared) {
      application.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:exported': 'false',
          'android:foregroundServiceType': 'dataSync',
        },
      });
    }

    return config;
  });
}

module.exports = function withDropSyncAndroid(config) {
  return withPlugins(config, [withDropSyncPermissions, withDropSyncService]);
};
