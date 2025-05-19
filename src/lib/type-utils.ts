export type Override<TBase, TOverrides> = Omit<TBase, keyof TOverrides> &
    TOverrides;
