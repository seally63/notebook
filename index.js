/**
 * @format
 */

// Polyfills MUST load before anything that uses them:
//  - get-random-values: crypto for client-generated UUIDs (uuid)
//  - url-polyfill: URL/URLSearchParams for @supabase/supabase-js
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
