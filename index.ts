import process from 'node:process';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

export type TargetType = 'account' | 'post';

export interface ExecutionParams {
    targetType: TargetType;
    targetUrl: string;
    totalRuns: number;
    browserCount: number;
    reasons: string[];
}

const DEFAULT_ACCOUNT_URL = 'https://www.tiktok.com/@pojok.lamongan';
const DEFAULT_POST_URL = 'https://www.tiktok.com/@pojok.lamongan/photo/7699855175837633793';

const DEFAULT_ACCOUNT_REASONS = [
    'Something else',
    'Hate and harassment',
    'Hate speech and hateful behaviors',
];

const DEFAULT_POST_REASONS = [
    'Misinformation',
    'Deepfakes, synthetic media, and manipulated media',
];

/**
 * Normalisasi URL TikTok agar fleksibel menerima URL lengkap maupun @username
 */
export function normalizeTikTokUrl(rawInput: string, targetType: TargetType): string {
    const trimmed = (rawInput || '').trim();
    if (!trimmed) {
        return targetType === 'account' ? DEFAULT_ACCOUNT_URL : DEFAULT_POST_URL;
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }

    if (trimmed.startsWith('@')) {
        return `https://www.tiktok.com/${trimmed}`;
    }

    if (trimmed.includes('tiktok.com/')) {
        return `https://${trimmed.replace(/^https?:\/\//, '')}`;
    }

    if (targetType === 'account') {
        return `https://www.tiktok.com/@${trimmed}`;
    }

    return `https://${trimmed}`;
}

/**
 * Deteksi otomatis tipe target dari format URL jika tidak ditentukan eksplisit
 */
export function detectTargetTypeFromUrl(url: string): TargetType {
    if (url.includes('/video/') || url.includes('/photo/') || url.includes('vt.tiktok.com')) {
        return 'post';
    }
    return 'account';
}

/**
 * Helper prompter interaktif yang andal untuk TTY maupun automated stream
 */
function createInteractivePrompter() {
    const rl = readline.createInterface({
        input,
        output,
        terminal: Boolean(input.isTTY),
        crlfDelay: Infinity,
    });

    const iterator = rl[Symbol.asyncIterator]();

    return {
        async ask(questionText: string): Promise<string> {
            output.write(questionText);
            const nextResult = await iterator.next();
            if (nextResult.done) {
                return '';
            }
            return String(nextResult.value).trim();
        },
        close(): void {
            rl.close();
        },
    };
}

/**
 * Tanya parameter secara interaktif di terminal jika tidak diberikan lewat CLI
 */
async function promptInteractiveParams(): Promise<ExecutionParams> {
    const prompter = createInteractivePrompter();

    console.log('\n======================================================');
    console.log('🤖 TIKTOK REPORT AUTOMATION BOT');
    console.log('======================================================');
    console.log('Pilih target yang ingin di-takedown / di-report:');
    console.log('  [1] Akun / Profil TikTok (Report Account)');
    console.log('  [2] Postingan / Video / Foto TikTok (Report Post)');
    console.log('------------------------------------------------------');

    const typeChoice = await prompter.ask('Pilihan Anda (1 atau 2, default: 1): ');
    const targetType: TargetType = typeChoice === '2' ? 'post' : 'account';

    const defaultExample =
        targetType === 'account'
            ? `(default: ${DEFAULT_ACCOUNT_URL})`
            : `(default: ${DEFAULT_POST_URL})`;

    console.log(`\nMasukkan link target yang mau di-takedown ${defaultExample}:`);
    const inputLink = await prompter.ask('Link target: ');

    const targetUrl = normalizeTikTokUrl(inputLink, targetType);

    const inputRuns = await prompter.ask('Masukkan jumlah putaran (default: 1): ');
    const parsedRuns = Number.parseInt(inputRuns, 10);
    const totalRuns = Number.isFinite(parsedRuns) && parsedRuns > 0 ? parsedRuns : 1;

    const inputBrowsers = await prompter.ask('Masukkan jumlah browser paralel (default: 1): ');
    const parsedBrowsers = Number.parseInt(inputBrowsers, 10);
    const browserCount = Number.isFinite(parsedBrowsers) && parsedBrowsers > 0 ? parsedBrowsers : 1;

    prompter.close();

    const reasons = targetType === 'account' ? DEFAULT_ACCOUNT_REASONS : DEFAULT_POST_REASONS;

    return {
        targetType,
        targetUrl,
        totalRuns,
        browserCount,
        reasons,
    };
}

/**
 * Parsing argumen CLI jika dipanggil dengan parameter:
 * Contoh:
 *   npm start (akan masuk mode interaktif)
 *   npm start account 1 5 https://tiktok.com/@user
 *   npm start post 1 5 https://tiktok.com/@user/video/...
 *   npm start 1 5 https://tiktok.com/@user
 */
export async function getExecutionParams(): Promise<ExecutionParams> {
    const rawArgs = process.argv.slice(2).filter((arg) => arg !== '--');

    // Jika tidak ada argumen sama sekali, masuk ke mode interaktif yang ramah pengguna
    if (rawArgs.length === 0) {
        return promptInteractiveParams();
    }

    // Jika meminta bantuan (-h / --help)
    if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
        console.log(`
========================================================================
📖 PANDUAN PENGGUNAAN TIKTOK AUTOMATION BOT
========================================================================

Mode Interaktif (Tanya Langsung):
  npm start

Mode Baris Perintah (CLI Argument):
  npm start [tipe] <jumlah_putaran> <jumlah_browser> [link_target]

Keterangan Parameter:
  • tipe             : "account" (akun) atau "post" (postingan).
                       Otomatis terdeteksi jika memasukkan link postingan (/video/ atau /photo/).
  • jumlah_putaran   : Berapa kali siklus automasi diulang.
  • jumlah_browser   : Jumlah browser paralel yang dibuka sekaligus.
  • link_target      : URL profil/postingan atau @username target.

Contoh Penggunaan:
  1. Takedown Akun:
     npm start account 1 5 @target.user
     npm start 1 5 https://www.tiktok.com/@target.user

  2. Takedown Postingan / Video / Foto:
     npm start post 1 5 https://www.tiktok.com/@target.user/video/123456789
     npm start 1 3 https://www.tiktok.com/@target.user/photo/7699855175837633793
========================================================================
        `);
        process.exit(0);
    }

    let explicitType: TargetType | undefined;
    let rawRuns: string | undefined;
    let rawBrowsers: string | undefined;
    let rawUrl: string | undefined;

    const positional: string[] = [];

    for (let index = 0; index < rawArgs.length; index++) {
        const argument = rawArgs[index];
        if (argument.startsWith('--type=')) {
            const val = argument.split('=')[1].toLowerCase();
            explicitType = val === 'post' || val === '2' ? 'post' : 'account';
        } else if (argument === '--type' || argument === '-t') {
            const val = (rawArgs[++index] || '').toLowerCase();
            explicitType = val === 'post' || val === '2' ? 'post' : 'account';
        } else if (argument.startsWith('--runs=')) {
            rawRuns = argument.split('=')[1];
        } else if (argument === '--runs' || argument === '-r') {
            rawRuns = rawArgs[++index];
        } else if (argument.startsWith('--browsers=')) {
            rawBrowsers = argument.split('=')[1];
        } else if (argument === '--browsers' || argument === '-b') {
            rawBrowsers = rawArgs[++index];
        } else if (argument.startsWith('--url=')) {
            rawUrl = argument.split('=')[1];
        } else if (argument === '--url' || argument === '-u') {
            rawUrl = rawArgs[++index];
        } else if (!argument.startsWith('-')) {
            positional.push(argument);
        }
    }

    for (const arg of positional) {
        const lower = arg.toLowerCase();
        if (lower === 'account' || lower === 'akun' || lower === 'profile' || lower === 'profil') {
            explicitType = 'account';
            continue;
        }
        if (lower === 'post' || lower === 'postingan' || lower === 'video' || lower === 'photo' || lower === 'foto') {
            explicitType = 'post';
            continue;
        }

        const isUrlLike =
            arg.startsWith('http://') ||
            arg.startsWith('https://') ||
            arg.startsWith('@') ||
            arg.includes('tiktok.com');

        if (isUrlLike && !rawUrl) {
            rawUrl = arg;
        } else if (!rawRuns && /^\d+$/.test(arg)) {
            rawRuns = arg;
        } else if (!rawBrowsers && /^\d+$/.test(arg)) {
            rawBrowsers = arg;
        } else if (!rawUrl) {
            rawUrl = arg;
        }
    }

    const detectedType = rawUrl ? detectTargetTypeFromUrl(rawUrl) : 'account';
    const targetType = explicitType ?? detectedType;
    const targetUrl = normalizeTikTokUrl(rawUrl ?? '', targetType);

    const parsedRuns = Number.parseInt(rawRuns ?? '1', 10);
    const parsedBrowsers = Number.parseInt(rawBrowsers ?? '1', 10);

    const totalRuns = Number.isFinite(parsedRuns) && parsedRuns > 0 ? parsedRuns : 1;
    const browserCount = Number.isFinite(parsedBrowsers) && parsedBrowsers > 0 ? parsedBrowsers : 1;
    const reasons = targetType === 'account' ? DEFAULT_ACCOUNT_REASONS : DEFAULT_POST_REASONS;

    return {
        targetType,
        targetUrl,
        totalRuns,
        browserCount,
        reasons,
    };
}

/**
 * Tangani dialog persetujuan cookies TikTok jika muncul
 */
async function handleConsentDialog(page: Page, prefix = '[Browser]'): Promise<void> {
    const consentButtons = page.locator(
        'button:has-text("Accept all"), button:has-text("Allow all"), button:has-text("Setuju semua"), button:has-text("Izinkan semua")'
    );

    const isConsentVisible = await consentButtons
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);

    if (!isConsentVisible) {
        return;
    }

    await consentButtons.first().click().catch(() => {});
    console.log(`${prefix} ✓ Dialog cookie disetujui.`);
}

/**
 * Tutup modal/popup login TikTok jika muncul tiba-tiba dan menghalangi layar
 */
async function dismissLoginModalIfPresent(page: Page, prefix = '[Browser]'): Promise<void> {
    const closeButtons = page.locator(
        '[data-e2e="modal-close-icon"], button[aria-label="Close"], button[aria-label="close" i], div[class*="modal-close"]'
    );

    const isVisible = await closeButtons.first().isVisible({ timeout: 1500 }).catch(() => false);
    if (isVisible) {
        await closeButtons.first().click().catch(() => {});
        console.log(`${prefix} ✓ Pop-up login/modal pengganggu ditutup.`);
        await page.waitForTimeout(500);
    }
}

/**
 * Klik elemen secara aman dengan retry singkat jika elemen sempat detached dari DOM atau beranimasi
 */
async function safeClick(
    locator: ReturnType<Page['locator']>,
    actionName: string,
    prefix: string,
    timeoutMs = 15000
): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        try {
            await locator.waitFor({ state: 'visible', timeout: 3000 });
            await locator.click({ timeout: 3000 });
            return;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    // Percobaan terakhir jika timeout tercapai
    await locator.click({ timeout: 4000 });
}

/**
 * Buka menu aksi (titik tiga) dan klik opsi "Report" secara tangguh dengan retry otomatis
 */
async function openMenuAndClickReport(
    page: Page,
    moreActionsSelector: string,
    prefix: string,
    expectedReasonText?: string,
    maxRetries = 3
): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await dismissLoginModalIfPresent(page, prefix);

            const attemptPrefix = attempt > 1 ? `[Percobaan #${attempt}] ` : '';
            console.log(`${prefix} ${attemptPrefix}Mengklik tombol menu opsi (titik tiga) ...`);

            const moreActionsButton = page.locator(moreActionsSelector).first();
            await moreActionsButton.waitFor({ state: 'visible', timeout: 10000 });
            await moreActionsButton.click({ timeout: 4000 });
            await page.waitForTimeout(800);

            console.log(`${prefix} ${attemptPrefix}Mengklik opsi "Report" ...`);
            const reportOption = page.locator(
                '.TUXMenuItem:has-text("Report"), [role="menuitem"]:has-text("Report"), button:has-text("Report"), div:has-text("Report")'
            ).filter({ hasText: /^Report$/i }).or(page.getByText('Report')).first();

            await reportOption.waitFor({ state: 'visible', timeout: 4000 });
            await reportOption.click({ timeout: 4000 });
            await page.waitForTimeout(1200);

            // Verifikasi bahwa dialog atau daftar alasan pelaporan sudah terbuka
            const reportDialogOrReason = expectedReasonText
                ? page.getByText(expectedReasonText).or(page.getByText('Report account')).or(page.locator('[role="dialog"]')).first()
                : page.locator('[role="dialog"], [data-e2e*="report"], [data-e2e*="modal"], button:has-text("Submit")')
                    .or(page.getByText('Report account'))
                    .or(page.getByText('Misinformation'))
                    .or(page.getByText('Something else'))
                    .first();

            const isModalOpen = await reportDialogOrReason.isVisible({ timeout: 4000 }).catch(() => false);
            if (isModalOpen) {
                console.log(`${prefix} ✓ Modal pelaporan berhasil dibuka.`);
                return;
            }

            console.log(`${prefix} Menu opsi tertutup kembali sebelum report terbuka, mencoba klik ulang...`);
        } catch {
            console.log(`${prefix} Menu opsi sempat detached/tertutup (percobaan ${attempt}/${maxRetries}), mencoba ulang...`);
            await page.waitForTimeout(1000);
        }
    }

    // Fallback terakhir
    const fallbackReport = page.getByText('Report').first();
    await fallbackReport.waitFor({ state: 'visible', timeout: 6000 });
    await fallbackReport.click({ timeout: 4000 });
}

/**
 * Klik tombol Submit dan Done di dalam modal laporan TikTok secara aman
 */
async function submitAndDismissReportModal(page: Page, prefix: string): Promise<void> {
    console.log(`${prefix} Mengklik tombol "Submit" ...`);
    const modal = page.locator('[role="dialog"], [data-e2e*="report"], [data-e2e*="modal"], #tux-portal-container');
    const submitButton = modal
        .locator('button')
        .filter({ hasText: /^Submit$/i })
        .or(modal.locator('button:has-text("Submit")'))
        .or(page.getByRole('button', { name: 'Submit', exact: true }))
        .first();

    await safeClick(submitButton, 'Submit', prefix);
    await page.waitForTimeout(1000);

    console.log(`${prefix} Mengklik tombol "Done" ...`);
    const doneButton = modal
        .locator('button')
        .filter({ hasText: /^Done$/i })
        .or(modal.locator('button:has-text("Done")'))
        .or(page.getByRole('button', { name: 'Done', exact: true }))
        .first();

    const isDoneVisible = await doneButton.isVisible({ timeout: 4000 }).catch(() => false);
    if (isDoneVisible) {
        await doneButton.click({ force: true, timeout: 3000 }).catch(async () => {
            await page.keyboard.press('Escape').catch(() => {});
        });
    }
}

/**
 * Alur eksekusi pelaporan akun TikTok
 */
async function reportAccountFlow(page: Page, params: ExecutionParams, prefix: string): Promise<void> {
    console.log(`${prefix} 1. Membuka profil: ${params.targetUrl} ...`);
    await page.goto(params.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await handleConsentDialog(page, prefix);
    await dismissLoginModalIfPresent(page, prefix);

    console.log(`${prefix} 2. Membuka menu opsi & memilih Report ...`);
    await openMenuAndClickReport(
        page,
        'button[data-e2e="user-more"], [data-e2e="user-more"]:visible, button[aria-label*="Action"]:visible',
        prefix,
        params.reasons[0]
    );

    // Pada beberapa tampilan TikTok, opsi "Report account" muncul sebelum daftar alasan
    const reportAccountButton = page.getByText('Report account').first();
    const hasReportAccount = await reportAccountButton.isVisible({ timeout: 3500 }).catch(() => false);
    if (hasReportAccount) {
        console.log(`${prefix} Mengklik opsi "Report account" ...`);
        await safeClick(reportAccountButton, 'Report account', prefix);
        await page.waitForTimeout(1000);
    }

    // Pilih alasan pelaporan secara berurutan
    for (let index = 0; index < params.reasons.length; index++) {
        const reasonText = params.reasons[index];
        console.log(`${prefix} Memilih alasan (${index + 1}/${params.reasons.length}): "${reasonText}" ...`);
        const reasonOption = page.getByText(reasonText).first();
        await safeClick(reasonOption, `Alasan "${reasonText}"`, prefix);
        await page.waitForTimeout(1000);
    }

    await submitAndDismissReportModal(page, prefix);
    console.log(`${prefix} ✓ Berhasil melaporkan akun target!`);
}

/**
 * Alur eksekusi pelaporan postingan TikTok (Video / Foto)
 */
async function reportPostFlow(page: Page, params: ExecutionParams, prefix: string): Promise<void> {
    console.log(`${prefix} 1. Membuka postingan: ${params.targetUrl} ...`);
    await page.goto(params.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await handleConsentDialog(page, prefix);
    await dismissLoginModalIfPresent(page, prefix);

    console.log(`${prefix} 2. Membuka menu opsi & memilih Report ...`);
    await openMenuAndClickReport(
        page,
        'div[data-e2e="browse-ellipsis"], [data-e2e="browse-ellipsis"], [data-e2e="more-menu-icon"], button[aria-label*="Action"]:visible, button[aria-label*="more"]:visible',
        prefix,
        params.reasons[0]
    );

    // Pilih alasan pelaporan postingan secara berurutan
    for (let index = 0; index < params.reasons.length; index++) {
        const reasonText = params.reasons[index];
        console.log(`${prefix} Memilih alasan (${index + 1}/${params.reasons.length}): "${reasonText}" ...`);
        const reasonOption = page.getByText(reasonText).first();
        await safeClick(reasonOption, `Alasan "${reasonText}"`, prefix);
        await page.waitForTimeout(1000);
    }

    await submitAndDismissReportModal(page, prefix);
    console.log(`${prefix} ✓ Berhasil melaporkan postingan target!`);
}

/**
 * Inisialisasi browser instance dengan posisi cascading agar tidak menumpuk
 */
async function createBrowserInstance(workerId = 1): Promise<{ browser: Browser; page: Page }> {
    const isHeadless = process.env.HEADLESS === 'true';

    // Beri sedikit offset posisi per jendela browser
    const positionX = ((workerId - 1) % 5) * 50;
    const positionY = ((workerId - 1) % 5) * 40;

    const browser: Browser = await chromium.launch({
        headless: isHeadless,
        slowMo: isHeadless ? 0 : 100,
        args: [
            '--disable-blink-features=AutomationControlled',
            `--window-position=${positionX},${positionY}`,
        ],
    });

    const context: BrowserContext = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    });

    const page: Page = await context.newPage();
    return { browser, page };
}

/**
 * Menjalankan satu worker browser secara terisolasi
 */
async function runBrowserWorker(
    workerId: number,
    params: ExecutionParams
): Promise<Browser | null> {
    const prefix = `[Browser #${workerId}]`;

    try {
        const { browser, page } = await createBrowserInstance(workerId);
        if (params.targetType === 'account') {
            await reportAccountFlow(page, params, prefix);
        } else {
            await reportPostFlow(page, params, prefix);
        }
        return browser;
    } catch (error: unknown) {
        console.error(`${prefix} ⚠️ Terjadi kendala saat automasi:`, error);
        return null;
    }
}

/**
 * Fungsi utama (Entry point)
 */
async function main(): Promise<void> {
    const params = await getExecutionParams();

    console.log('\n======================================================');
    console.log('🚀 Memulai TikTok Report Automation');
    console.log(`- Tipe Target             : ${params.targetType === 'account' ? 'Akun / Profil' : 'Postingan (Video/Foto)'}`);
    console.log(`- Target URL              : ${params.targetUrl}`);
    console.log(`- Alasan Pelaporan        : ${params.reasons.join(' -> ')}`);
    console.log(`- Jumlah Putaran (Runs)   : ${params.totalRuns}`);
    console.log(`- Browser Paralel         : ${params.browserCount}`);
    console.log('======================================================\n');

    for (let currentRun = 1; currentRun <= params.totalRuns; currentRun++) {
        console.log(`▶ [Putaran ${currentRun}/${params.totalRuns}] Membuka ${params.browserCount} browser secara paralel...`);

        const workerPromises = Array.from({ length: params.browserCount }, (_, index) =>
            runBrowserWorker(index + 1, params)
        );

        const results = await Promise.all(workerPromises);
        const validBrowsers = results.filter((b): b is Browser => b !== null);

        console.log(`[Putaran ${currentRun}/${params.totalRuns}] Selesai. Menutup ${validBrowsers.length} browser...`);
        await Promise.all(validBrowsers.map((browser) => browser.close()));

        if (currentRun < params.totalRuns) {
            console.log('Menunggu 2 detik sebelum memulai putaran berikutnya...\n');
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }

    console.log('\n======================================================');
    console.log('🎉 Seluruh putaran automasi telah selesai!');
    console.log('Semua browser telah ditutup secara otomatis.');
    console.log('======================================================\n');
}

const isDirectExecution =
    Boolean(process.argv[1]) &&
    (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));

if (isDirectExecution) {
    main().catch((error: unknown) => {
        console.error('Terjadi kesalahan fatal:', error);
        process.exit(1);
    });
}
