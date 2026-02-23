import { useQuery } from "@tanstack/react-query";
import env from "../env-parsed.js";

export interface Placeholder {
	id: number;
	name: string;
	createdAt: string;
}

function getMockPlaceholder(): Placeholder {
	return {
		id: 1,
		name: "Placeholder (mock - backend en deshuso)",
		createdAt: new Date().toISOString(),
	};
}

async function fetchPlaceholder(): Promise<Placeholder> {
	if (env.MOCK_API) {
		return Promise.resolve(getMockPlaceholder());
	}
	const response = await fetch(`${env.API_URL}/placeholders`);
	if (!response.ok) {
		throw new Error("Failed to fetch placeholder");
	}
	return response.json();
}

export function usePlaceholder() {
	return useQuery({
		queryKey: ["placeholder", env.MOCK_API],
		queryFn: fetchPlaceholder,
	});
}
