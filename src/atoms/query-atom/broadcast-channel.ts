import { atom, injectEffect, api, injectSignal } from '@zedux/react';

// Define standard message types for query/mutation events
export type QueryBroadcastMessage =
    | { type: 'invalidate'; queryKey: string } // Invalidate a specific query key
    | { type: 'refetch'; queryKey: string } // Request a refetch for a query key
    | { type: 'queryUpdated'; queryKey: string; data?: unknown } // Notify that a query was updated (optional data)
    | { type: 'mutationSuccess'; mutationKey: string; data?: unknown; variables?: unknown } // Notify mutation success
    | { type: 'mutationError'; mutationKey: string; error?: unknown; variables?: unknown }; // Notify mutation error

const CHANNEL_NAME = 'zedux_query_sync';

/**
 * A singleton atom to manage BroadcastChannel communication for query/mutation synchronization.
 */
export const broadcastChannelAtom = atom('broadcastChannel', () => {
    let channel: BroadcastChannel | null = null;
    const listenersSignal = injectSignal(new Set<(message: QueryBroadcastMessage) => void>());

    // Effect to initialize and cleanup the channel
    injectEffect(() => {
        if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
            try {
                const listeners = listenersSignal.get();
                channel = new BroadcastChannel(CHANNEL_NAME);
                console.log('BroadcastChannel "' + CHANNEL_NAME + '" connected.');

                const handleMessage = (event: MessageEvent) => {
                    // TODO: Add validation/parsing for event.data
                    const message = event.data as QueryBroadcastMessage;
                    console.log("BroadcastChannel received:", message);
                    listeners.forEach(listener => listener(message));
                };

                channel.addEventListener('message', handleMessage);

                return () => {
                    console.log('BroadcastChannel "' + CHANNEL_NAME + '" closing.');
                    channel?.removeEventListener('message', handleMessage);
                    channel?.close();
                    channel = null;
                };
            } catch (error) {
                console.error("Failed to create BroadcastChannel:", error);
                channel = null; // Ensure channel is null if creation failed
            }
        }
        // Cleanup function if channel was never created or failed
        return () => {
            if (channel) {
                console.log('BroadcastChannel "' + CHANNEL_NAME + '" closing (cleanup).');
                channel.close();
                channel = null;
            }
        };
    }, []); // Run only once

    // Function to post messages to the channel
    const postMessage = (message: QueryBroadcastMessage) => {
        if (channel) {
            try {
                console.log("BroadcastChannel posting:", message);
                channel.postMessage(message);
            } catch (error) {
                console.error("Failed to post message via BroadcastChannel:", error);
            }
        } else {
            console.warn("BroadcastChannel not available or not initialized, cannot post message:", message);
        }
    };

    // Function for other atoms/effects to subscribe to messages
    const subscribe = (listener: (message: QueryBroadcastMessage) => void) => {
        listenersSignal.set(prev => {
            prev.add(listener);
            return prev;
        });
        return () => {
            listenersSignal.set(prev => {
                prev.delete(listener);
                return prev;
            });
        };
    };

    // Expose postMessage and subscribe via API
    // No internal state signal needed for this manager atom
    return api({}).setExports({ postMessage, subscribe });

}, { ttl: Number.POSITIVE_INFINITY }); // Keep this global manager alive indefinitely
