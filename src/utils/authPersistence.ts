import {
    browserLocalPersistence,
    browserSessionPersistence,
    indexedDBLocalPersistence,
    setPersistence,
    type Auth
} from 'firebase/auth';

export const configureAuthPersistence = async (auth: Auth, keepSignedIn: boolean) => {
    if (!keepSignedIn) {
        await setPersistence(auth, browserSessionPersistence);
        return;
    }

    try {
        // IndexedDB is the most reliable durable storage for an installed mobile PWA.
        await setPersistence(auth, indexedDBLocalPersistence);
    } catch (indexedDBError) {
        console.warn('[Auth] IndexedDB indisponível; usando armazenamento local.', indexedDBError);
        await setPersistence(auth, browserLocalPersistence);
    }
};
