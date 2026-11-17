export type ChargeMatch = {
	id: string;
	kokCount: number | null;
	sets: { players: { id: string }[] }[];
};

export function kokShares(matches: ChargeMatch[], price: number): Map<string, number> {
	if (!Number.isSafeInteger(price) || price < 0) throw new Error('Harga kok tidak valid.');
	const totals = new Map<string, number>();
	for (const match of matches) {
		if (match.kokCount === null) continue;
		const slots = new Map<string, number>();
		for (const set of match.sets)
			for (const player of set.players) slots.set(player.id, (slots.get(player.id) ?? 0) + 1);
		const cost = match.kokCount * price;
		const totalSlots = [...slots.values()].reduce((sum, count) => sum + count, 0);
		if (!totalSlots) continue;
		const sorted = [...slots].sort(([a], [b]) => a.localeCompare(b));
		const portions = sorted.map(
			([id, count]) => [id, Math.floor((cost * count) / totalSlots)] as const
		);
		let remaining = cost - portions.reduce((sum, [, amount]) => sum + amount, 0);
		for (const [id, amount] of portions) {
			const share = amount + (remaining-- > 0 ? 1 : 0);
			totals.set(id, (totals.get(id) ?? 0) + share);
		}
	}
	return totals;
}
