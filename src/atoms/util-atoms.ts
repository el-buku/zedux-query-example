import { api, atom, injectSignal } from "@zedux/react";

export const debounceAtom = atom(
    "debounce",
    ({ id, debounceTime = 1000 }: { id: string; debounceTime?: number }) => {
        const debounceId = injectSignal(id);
        const timeoutId = injectSignal<NodeJS.Timeout | null>(null);

        return api(debounceId).setExports({
            debounce: (cb: () => void) => {
                // Clear any existing timeout
                if (timeoutId.get()) {
                    clearTimeout(timeoutId.get()!);
                }

                // Set new timeout
                const newTimeoutId = setTimeout(() => {
                    cb();
                    timeoutId.set(null);
                }, debounceTime);

                timeoutId.set(newTimeoutId);
            },

            // Optional: Method to cancel pending debounced calls
            cancel: () => {
                if (timeoutId.get()) {
                    clearTimeout(timeoutId.get()!);
                    timeoutId.set(null);
                }
            },
        });
    },
    {
        tags: ["global"],
    },
);

export const throttleAtom = atom(
    "throttle",
    ({ id, throttleTime = 1000 }: { id: string; throttleTime?: number }) => {
        const throttleId = injectSignal(id);
        const timeoutId = injectSignal<NodeJS.Timeout | null>(null);
        const lastRun = injectSignal<number>(0);
        const lastPromise = injectSignal<Promise<unknown> | null>(null);

        return api(throttleId).setExports({
            throttle: (cb: () => void) => {
                const now = Date.now();
                const timeSinceLastRun = now - lastRun.get();

                if (timeSinceLastRun >= throttleTime) {
                    // Enough time has passed, execute immediately
                    cb();
                    lastRun.set(now);
                } else if (!timeoutId.get()) {
                    // Schedule next execution at the end of throttle period
                    const waitTime = throttleTime - timeSinceLastRun;
                    const newTimeoutId = setTimeout(() => {
                        cb();
                        lastRun.set(Date.now());
                        timeoutId.set(null);
                    }, waitTime);

                    timeoutId.set(newTimeoutId);
                }
                // If there's already a timeout scheduled, ignore this call
            },
            throttleAsync: <T>(cb: () => Promise<T> | T): Promise<T> => {
                const now = Date.now();
                const timeSinceLastRun = now - lastRun.get();

                if (timeSinceLastRun >= throttleTime) {
                    // Enough time has passed, execute immediately
                    const result = cb();
                    lastRun.set(now);

                    // Handle both async and sync functions
                    const promise =
                        result instanceof Promise ? result : Promise.resolve(result);
                    lastPromise.set(promise);
                    return promise;
                }
                if (!timeoutId.get()) {
                    // Schedule next execution at the end of throttle period
                    return new Promise<T>((resolve, reject) => {
                        const waitTime = throttleTime - timeSinceLastRun;
                        const newTimeoutId = setTimeout(() => {
                            try {
                                const result = cb();
                                lastRun.set(Date.now());
                                timeoutId.set(null);

                                // Handle both async and sync functions
                                if (result instanceof Promise) {
                                    result.then(resolve).catch(reject);
                                    lastPromise.set(result);
                                } else {
                                    resolve(result as T);
                                    lastPromise.set(Promise.resolve(result as T));
                                }
                            } catch (error) {
                                reject(error);
                            }
                        }, waitTime);

                        timeoutId.set(newTimeoutId);
                    });
                }

                // If there's already a timeout scheduled, return the last promise
                return (
                    (lastPromise.get() as Promise<T>) ||
                    Promise.resolve(undefined as unknown as T)
                );
            },

            // Cancel any pending throttled calls
            cancel: () => {
                if (timeoutId.get()) {
                    clearTimeout(timeoutId.get()!);
                    timeoutId.set(null);
                }
            },
        });
    },
    {
        tags: ["global"],
    },
);
