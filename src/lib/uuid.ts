// Client-generated UUIDs. The brief requires stable IDs created on-device so offline
// creates survive sync unchanged (upsert by id). Requires the crypto polyfill, which
// is imported once at app entry (index.js); re-importing here is a harmless no-op.

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export const newId = (): string => uuidv4();
