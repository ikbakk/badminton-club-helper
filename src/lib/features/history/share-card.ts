import courtArtwork from '$lib/assets/recap-court.svg?raw';

export type ShareCardData = {
	clubName: string;
	date: string;
	attendance: number;
	courtsUsed: number;
	matches: number;
	sets: number;
	kokUsed?: number | null;
	names: string[];
	finance?: {
		fee: number | null;
		kokPrice?: number | null;
		totalDue: number;
		paid: number;
		attendees: number;
	};
};
const escapeXml = (value: string) =>
	value.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!
	);
const money = (value: number) => `Rp${value.toLocaleString('id-ID')}`;
function wrap(value: string, maxEm: number) {
	const width = (text: string) =>
		Array.from(text).reduce(
			(sum, c) =>
				sum +
				(/[WM@%]/u.test(c)
					? 1.1
					: /[ilI.,' ]/u.test(c)
						? 0.32
						: /[A-Z0-9]/u.test(c)
							? 0.78
							: /[^\u0020-\u024f]/u.test(c)
								? 1.1
								: 0.65),
			0
		);
	const lines: string[] = [];
	for (const word of value.trim().split(/\s+/)) {
		if (lines.length && width(`${lines.at(-1)} ${word}`) <= maxEm) {
			lines[lines.length - 1] += ` ${word}`;
			continue;
		}
		let chunk = '';
		for (const character of word) {
			if (chunk && width(chunk + character) > maxEm) {
				lines.push(chunk);
				chunk = '';
			}
			chunk += character;
		}
		lines.push(chunk);
	}
	return lines;
}

/** A self-contained vector: the same source powers preview, SVG download and PNG export. */
export function renderShareCard(data: ShareCardData, fontData = '') {
	const text = (
		x: number,
		y: number,
		value: string,
		size = 28,
		weight = 600,
		fill = '#163630',
		extra = ''
	) =>
		`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${escapeXml(value)}</text>`;
	const brand = (x: number, y: number, color: string, scale = 1) =>
		`<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 30 18 0h9L9 30Zm17 0L35 0h9L26 30Z" fill="#e2653e"/>${text(58, 29, 'Courtside', 34, 800, color)}</g>`;
	const clubLines = wrap(data.clubName, 14.5);
	const headerHeight = 250 + clubLines.length * 70;
	const metricsTop = headerHeight + 24;
	const namesTop = metricsTop + 250;
	const rows: string[] = [];
	let y = namesTop;
	for (let i = 0; i < data.names.length; i += 2) {
		const pair = data.names.slice(i, i + 2).map((name) => ({ name, lines: wrap(name, 14.5) }));
		const rowHeight = Math.max(...pair.map((p) => p.lines.length), 1) * 34 + 34;
		pair.forEach(({ name, lines }, col) => {
			const x = 48 + col * 504;
			rows.push(`<circle cx="${x + 28}" cy="${y + 28}" r="28" fill="#e5ece5"/>`);
			const initial = Array.from(name.trim())[0]?.toLocaleUpperCase('id-ID') ?? '•';
			rows.push(text(x + 28, y + 38, initial, 27, 800, '#38675b', 'text-anchor="middle"'));
			lines.forEach((line, index) => rows.push(text(x + 74, y + 36 + index * 34, line, 27, 700)));
			rows.push(`<path d="M${x} ${y + rowHeight}h480" stroke="#d6ddd3"/>`);
		});
		y += rowHeight + 8;
	}
	if (!data.names.length) {
		rows.push(text(48, y + 32, 'Belum ada pemain tercatat.', 28, 500, '#38675b'));
		y += 80;
	}
	const financeTop = y + 30;
	const footerTop = Math.max(1190, financeTop + (data.finance ? 170 : 0));
	const height = footerTop + 120;
	const artwork = courtArtwork.replace(/<svg[^>]*>|<\/svg>/g, '');
	let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}" role="img" aria-label="Rekap sesi ${escapeXml(data.clubName)}"><style>${fontData ? `@font-face{font-family:Manrope;src:url(data:font/ttf;base64,${fontData}) format('truetype');font-weight:200 800;}` : ''}text{font-family:Manrope,Arial,sans-serif;}</style><rect width="1080" height="${height}" fill="#fffaf0"/><path d="M0 0h1080v${headerHeight}H0Z" fill="#163630"/><g fill="none" transform="translate(750 0)">${artwork}</g>`;
	svg += brand(48, 38, '#fffaf0');
	clubLines.forEach((line, i) => (svg += text(48, 174 + i * 70, line, 66, 800, '#fffaf0')));
	svg += text(48, headerHeight - 82, 'Rekap sesi badminton', 36, 700, '#c8d9d0');
	svg += text(48, headerHeight - 30, data.date, 29, 500, '#fffaf0');
	svg += `<rect x="32" y="${metricsTop}" width="1016" height="158" rx="24" fill="#e5ece5"/>`;
	const metrics: [number | string, string][] = [
		[data.attendance, 'Pemain'],
		[data.courtsUsed, 'Court dipakai'],
		[data.matches, 'Match'],
		[data.sets, 'Set']
	];
	if (data.kokUsed !== undefined) metrics.push([data.kokUsed ?? '—', 'Kok dipakai']);
	const metricWidth = 1016 / metrics.length;
	metrics.forEach(([value, label], i) => {
		const x = 32 + metricWidth * (i + 0.5);
		if (i) svg += `<path d="M${32 + metricWidth * i} ${metricsTop + 24}v110" stroke="#b9c5bb"/>`;
		svg += text(x, metricsTop + 92, String(value), 72, 800, '#163630', 'text-anchor="middle"');
		svg += text(x, metricsTop + 134, String(label), 25, 700, '#38675b', 'text-anchor="middle"');
	});
	svg += text(48, metricsTop + 216, 'Main bareng sesi ini', 40, 800);
	svg += text(48, metricsTop + 252, `${data.attendance} pemain hadir`, 26, 600, '#38675b');
	// Keep the first row below the attendance subtitle.
	svg += `<g transform="translate(0 30)">${rows.join('')}</g>`;
	if (data.finance) {
		const f = data.finance;
		const top = financeTop + 30;
		const columns = f.kokPrice === undefined ? 3 : 4;
		const columnWidth = 1016 / columns;
		svg += `<rect x="32" y="${top}" width="1016" height="140" rx="24" fill="#e5ece5"/>`;
		for (let i = 1; i < columns; i++) {
			const x = 32 + columnWidth * i;
			svg += `<path d="M${x} ${top + 18}v104" stroke="#b9c5bb"/>`;
		}
		const xAt = (column: number) => 56 + columnWidth * column;
		svg += text(xAt(0), top + 39, 'Iuran per orang', 21, 800);
		svg += text(xAt(0), top + 64, 'tidak termasuk kok', 18, 600, '#38675b');
		svg += text(
			xAt(0),
			top + 108,
			f.fee === null ? 'Belum ditetapkan' : `${money(f.fee)} / orang`,
			24,
			600
		);
		const totalColumn = f.kokPrice === undefined ? 1 : 2;
		if (f.kokPrice !== undefined) {
			svg += text(xAt(1), top + 48, 'Harga per kok', 21, 600, '#38675b');
			svg += text(
				xAt(1),
				top + 98,
				f.kokPrice === null ? 'Belum ditetapkan' : money(f.kokPrice),
				f.kokPrice === null ? 17 : 25,
				800
			);
		}
		svg += text(xAt(totalColumn), top + 48, 'Total tagihan', 21, 500, '#38675b');
		svg += text(xAt(totalColumn), top + 98, f.fee === null ? '—' : money(f.totalDue), 27, 800);
		const paidColumn = totalColumn + 1;
		svg += text(xAt(paidColumn), top + 64, `${f.paid}/${f.attendees}`, 34, 800);
		svg += text(xAt(paidColumn), top + 102, 'lunas', 23, 600, '#38675b');
	}
	svg += `<path d="M48 ${footerTop + 30}h984" stroke="#b9c5bb"/>`;
	svg += brand(48, footerTop + 62, '#163630', 0.65);
	svg += text(
		1032,
		footerTop + 86,
		'Sampai ketemu di sesi berikutnya.',
		22,
		500,
		'#38675b',
		'text-anchor="end"'
	);
	return svg + '</svg>';
}

let fontData: Promise<string> | undefined;
export async function shareCardFont() {
	return (fontData ??= fetch('/fonts/manrope-variable.ttf')
		.then(async (response) => {
			if (!response.ok) throw new Error('Font kartu belum dapat dimuat.');
			const bytes = new Uint8Array(await response.arrayBuffer());
			let binary = '';
			for (const byte of bytes) binary += String.fromCharCode(byte);
			return btoa(binary);
		})
		.catch((error) => {
			fontData = undefined;
			throw error;
		}));
}

/** Canvas is used only for final SVG → PNG conversion, never to lay out or draw card elements. */
export async function shareCardPng(svg: string): Promise<Blob> {
	const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
	try {
		const image = new Image();
		image.src = source;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Ekspor gambar tidak tersedia.');
		ctx.drawImage(image, 0, 0);
		return await new Promise<Blob>((resolve, reject) =>
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error('Ekspor gambar gagal.'))),
				'image/png'
			)
		);
	} finally {
		URL.revokeObjectURL(source);
	}
}
