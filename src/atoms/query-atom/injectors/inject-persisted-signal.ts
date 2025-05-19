import {
    injectAtomInstance,
    injectEffect,
    injectMemo,
    injectSignal,
} from "@zedux/react";
import { debounceAtom } from "../../util-atoms";

/**
 * Interface for a synchronous storage client.
 */
export interface SyncStorage<T = unknown> {
    getItem: (key: string) => T | null;
    setItem: (key: string, value: T) => void;
    removeItem: (key: string) => void;
}

/**
 * A simple persister using localStorage.
 * Handles serialization and deserialization.
 */
export const localStoragePersister = <
    TState = unknown,
>(): SyncStorage<TState> => {
    const prefix = "zeduxPerist_"; // Prefix to avoid collisions

    return {
        getItem: (key: string): TState | null => {
            if (typeof window === "undefined" || !window.localStorage) {
                return null;
            }
            try {
                const storedValue = window.localStorage.getItem(prefix + key);
                if (storedValue === null) {
                    return null;
                }
                return JSON.parse(storedValue) as TState;
            } catch (error) {
                console.error(
                    `Error reading state for key "${key}" from localStorage:`,
                    error,
                );
                return null;
            }
        },
        setItem: (key: string, value: TState): void => {
            if (typeof window === "undefined" || !window.localStorage) {
                return;
            }
            try {
                const serializedValue = JSON.stringify(value);
                window.localStorage.setItem(prefix + key, serializedValue);
            } catch (error) {
                console.error(
                    `Error writing state for key "${key}" to localStorage:`,
                    error,
                );
            }
        },
        removeItem: (key: string): void => {
            if (typeof window === "undefined" || !window.localStorage) {
                return;
            }
            try {
                window.localStorage.removeItem(prefix + key);
            } catch (error) {
                console.error(
                    `Error removing state for key "${key}" from localStorage:`,
                    error,
                );
            }
        },
    };
};

// Default persister instance
const defaultPersister = localStoragePersister();

/**
 * Options for injectPersistedSignal.
 */
export interface InjectPersistedSignalOptions<TState> {
    /** The storage key. */
    key: string;
    /** The default value if nothing is in storage. */
    defaultValue: TState;
    /** The persister implementation. Defaults to localStoragePersister. */
    persister?: SyncStorage<TState>;
    /** Debounce time in ms for writing to storage. Defaults to 0. */
    debounce?: number;
}

/**
 * An injector that creates a signal whose state is automatically persisted
 * to and hydrated from synchronous storage.
 * TODO: persisted signals should have a MAX_LIFETIME and be cleaned up asynchronously
 */
export const injectPersistedSignal = <TState>({
    key,
    defaultValue,
    persister = defaultPersister as SyncStorage<TState>, // Use default localStorage persister
    debounce = 0,
}: InjectPersistedSignalOptions<TState>) => {
    const debounceAtomInstance = injectAtomInstance(debounceAtom, [
        { id: `${key}-debounce-atom`, debounceTime: debounce },
    ]);
    // 1. Hydrate initial state once
    const hydratedValue = injectMemo(() => {
        if (typeof window === "undefined") return defaultValue; // No persistence on server
        const storedValue = persister.getItem(key);
        return storedValue ?? defaultValue;
    }, []); // Run only once

    // 2. Create the underlying signal
    const stateSignal = injectSignal(hydratedValue);

    // 3. Persist changes using an effect
    const state = stateSignal.get();
    injectEffect(() => {
        if (typeof window === "undefined") return; // Don't run persistence effect on server

        const currentState = stateSignal.get();

        const saveState = (stateToSave: TState) => {
            persister.setItem(key, stateToSave);
        };

        // Debounced save logic
        if (debounce > 0) {
            debounceAtomInstance.exports.debounce(() => saveState(currentState));
        } else {
            saveState(currentState); // Save immediately
        }
    }, [key, state]); // Depend on state value to trigger persistence

    return stateSignal; // Return the signal itself
};
