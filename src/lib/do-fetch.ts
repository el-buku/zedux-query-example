const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const doSimpleFetch = async (id: string) => {
    await wait(3330);
    const response = await fetch(
        `https://jsonplaceholder.typicode.com/posts/${id}`
    );
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<{ title: string }>;
};
