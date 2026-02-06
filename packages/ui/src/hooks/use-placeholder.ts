import { useQuery } from "@tanstack/react-query";
import env from "../env-parsed.js";

export interface Placeholder {
    id: number;
    name: string;
    createdAt: string;
}

async function fetchPlaceholder(): Promise<Placeholder> {
    const response = await fetch(`${env.API_URL}/placeholders`);
    if (!response.ok) {
        throw new Error("Failed to fetch placeholder");
    }
    return response.json();
}

export function usePlaceholder() {
    return useQuery({
        queryKey: ["placeholder"],
        queryFn: fetchPlaceholder,
    });
}
