import { describe, expect, it } from 'vitest';
import { renderShareCard } from './share-card';

const recap = {
	clubName: 'PB Newbie',
	date: '22 Oktober 2026',
	attendance: 12,
	courtsUsed: 2,
	matches: 10,
	sets: 20,
	names: ['Andi & Bella <Klub>', 'Dini'],
	finance: { fee: 15000, totalDue: 180000, paid: 12, attendees: 12 }
};
describe('shareable session recap', () => {
	it('keeps all attendance names safely in an editable vector without match-by-match results', () => {
		const svg = renderShareCard(recap);
		expect(svg).toContain('Andi &amp; Bella &lt;Klub&gt;');
		expect(svg).toContain('Dini');
		expect(svg).toContain('Rp180.000');
		expect(svg).toContain('12/12');
		expect(svg).not.toContain('Hasil pertandingan');
	});
	it('omits all finance when disabled, including zero-valued and unconfirmed amounts', () => {
		const svg = renderShareCard({ ...recap, finance: undefined });
		expect(svg).not.toMatch(/Rp|lunas|Iuran/);
		expect(
			renderShareCard({ ...recap, finance: { ...recap.finance, fee: 0, totalDue: 0 } })
		).toContain('Rp0');
		expect(renderShareCard({ ...recap, finance: { ...recap.finance, fee: null } })).toContain(
			'Belum ditetapkan'
		);
	});
	it('grows to fit a larger roster and preserves long names', () => {
		const names = Array.from({ length: 50 }, (_, i) => `Pemain ${i} Dengan Nama Panjang`);
		const svg = renderShareCard({ ...recap, names, attendance: 50 });
		expect(svg).toContain('Pemain 49 Dengan Nama');
		expect(svg).toContain('Panjang');
		expect(Number(svg.match(/height="(\d+)"/)?.[1])).toBeGreaterThan(1350);
	});
});
