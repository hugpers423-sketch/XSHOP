import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.xshop.app',
  appName: 'X-SHOP',
  webDir: 'public',
  server: {
    url: 'http://127.0.0.1:3200',
    androidScheme: 'http',
    iosScheme: 'http'
  },
  android: {
    buildOptions: {
      keystorePath: 'release-key.keystore',
      keystorePassword: process.env.KEYSTORE_PASSWORD || '',
      keyAlias: 'xshop',
      keyPassword: process.env.KEY_PASSWORD || ''
    }
  }
};
export default config;
