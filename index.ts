import process from 'node:process';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

interface ExecutionParams {
    totalRuns: number;
    browserCount: number;
    profileUrl: string;
}

interface TikTokReportConfig {
    profileUrl: string;
    reportReason: string;
    reportReason2: string;
    reportReason3: string;
}

/**
 * Normalisasi URL TikTok agar fleksibel menerima URL lengkap maupun @username
 */
function normalizeTikTokUrl(inputUrl?: string): string {
    const defaultUrl = 'https://www.tiktok.com/@pojok.lamongan';
    if (!inputUrl || !inputUrl.trim()) {
        return defaultUrl;
    }

    const trimmed = inputUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    if (trimmed.startsWith('@')) {
        return `https://www.tiktok.com/${trimmed}`;
    }
    if (trimmed.includes('tiktok.com/')) {
        return `https://${trimmed.replace(/^https?:\/\//, '')}`;
    }
    return `https://www.tiktok.com/@${trimmed}`;
}

/**
 * Tampilkan panduan penggunaan parameter jika npm start dijalankan tanpa parameter
 */
function showTutorialAndExit(): never {
    console.log(`
========================================================================
📖 PANDUAN PENGGUNAAN TIKTOK AUTOMATION BOT
========================================================================

Format perintah:
  npm start <jumlah_putaran> <jumlah_browser> [link_atau_username]

Parameter yang dibutuhkan:
  1. jumlah_putaran     : Berapa kali siklus automasi dijalankan secara berulang.
  2. jumlah_browser     : Berapa banyak jendela browser yang dibuka secara bersamaan (paralel).
  3. link_atau_username : (Opsional) Link lengkap atau @username profil TikTok target.
                          Default: https://www.tiktok.com/@pojok.lamongan

------------------------------------------------------------------------
💡 CONTOH CARA MENJALANKAN:
------------------------------------------------------------------------
  • 1 putaran dengan 5 browser sekaligus:
      npm start 1 5

  • 1 putaran dengan 5 browser ke target tertentu:
      npm start 1 5 @akun.target
      atau
      npm start 1 5 https://www.tiktok.com/@akun.target

  • 3 putaran berulang, masing-masing 2 browser paralel:
      npm start 3 2 @akun.target

------------------------------------------------------------------------
ℹ️  TIPS PENGGUNA WINDOWS:
  Anda juga bisa langsung dobel klik file "run.bat" untuk mengisi
  parameter secara interaktif tanpa mengetik di terminal.
========================================================================
`);
    process.exit(0);
}

/**
 * Parsing argumen CLI:
 * - Positional: npm start 1 5 https://www.tiktok.com/@username
 * - Flagged: npm start -- --runs 1 --browsers 5 --url @username
 * - Default URL: https://www.tiktok.com/@pojok.lamongan
 */
function parseExecutionParams(): ExecutionParams {
    const args = process.argv.slice(2).filter((arg) => arg !== '--');

    // Jika dijalankan tanpa parameter atau meminta bantuan (--help)
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        showTutorialAndExit();
    }

    let rawRuns: string | undefined;
    let rawBrowsers: string | undefined;
    let rawUrl: string | undefined;

    const positional: string[] = [];

    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument.startsWith('--runs=')) {
            rawRuns = argument.split('=')[1];
        } else if (argument === '--runs' || argument === '-r') {
            rawRuns = args[++index];
        } else if (argument.startsWith('--browsers=')) {
            rawBrowsers = argument.split('=')[1];
        } else if (argument === '--browsers' || argument === '-b') {
            rawBrowsers = args[++index];
        } else if (argument.startsWith('--url=')) {
            rawUrl = argument.split('=')[1];
        } else if (argument === '--url' || argument === '-u') {
            rawUrl = args[++index];
        } else if (!argument.startsWith('-')) {
            positional.push(argument);
        }
    }

    // Mendukung urutan fleksibel:
    // e.g. "1 5 https://tiktok.com/@target" atau "https://tiktok.com/@target 1 5"
    for (const arg of positional) {
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

    const parsedRuns = Number.parseInt(rawRuns ?? '1', 10);
    const parsedBrowsers = Number.parseInt(rawBrowsers ?? '1', 10);

    const totalRuns = Number.isFinite(parsedRuns) && parsedRuns > 0 ? parsedRuns : 1;
    const browserCount = Number.isFinite(parsedBrowsers) && parsedBrowsers > 0 ? parsedBrowsers : 1;
    const profileUrl = normalizeTikTokUrl(rawUrl);

    return { totalRuns, browserCount, profileUrl };
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

    await consentButtons.first().click();
    console.log(`${prefix} ✓ Dialog cookie disetujui.`);
}

/**
 * Jalankan alur pelaporan akun TikTok secara terstruktur
 */
async function reportTikTokAccount(
    page: Page,
    config: TikTokReportConfig,
    prefix = '[Browser]'
): Promise<void> {
    const { profileUrl, reportReason, reportReason2, reportReason3 } = config;

    console.log(`${prefix} 1. Membuka profil ${profileUrl} ...`);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });

    // Tutup banner cookies jika ada
    await handleConsentDialog(page, prefix);

    console.log(`${prefix} 2. Mengklik tombol menu opsi (titik tiga / actions) ...`);
    const moreActionsButton = page.locator(
        'button[data-e2e="user-more"], [data-e2e="user-more"]:visible, button[aria-label*="Action"]:visible'
    ).first();
    await moreActionsButton.waitFor({ state: 'visible', timeout: 15000 });
    await moreActionsButton.click();

    console.log(`${prefix} 3. Mengklik opsi "Report" ...`);
    const reportButton = page.getByText('Report').first();
    await reportButton.waitFor({ state: 'visible', timeout: 15000 });
    await reportButton.click();
    await page.waitForTimeout(1000);

    console.log(`${prefix} 4. Mengklik opsi "Report account" ...`);
    const reportAccountButton = page.getByText('Report account').first();
    await reportAccountButton.waitFor({ state: 'visible', timeout: 15000 });
    await reportAccountButton.click();
    await page.waitForTimeout(1000);

    console.log(`${prefix} 5. Memilih alasan: "${reportReason}" ...`);
    const reason1 = page.getByText(reportReason).first();
    await reason1.waitFor({ state: 'visible', timeout: 15000 });
    await reason1.click();
    await page.waitForTimeout(1000);

    console.log(`${prefix} 6. Memilih sub-alasan: "${reportReason2}" ...`);
    const reason2 = page.getByText(reportReason2).first();
    await reason2.waitFor({ state: 'visible', timeout: 15000 });
    await reason2.click();
    await page.waitForTimeout(1000);

    console.log(`${prefix} 7. Memilih sub-alasan: "${reportReason3}" ...`);
    const reason3 = page.getByText(reportReason3).first();
    await reason3.waitFor({ state: 'visible', timeout: 15000 });
    await reason3.click();
    await page.waitForTimeout(1000);

    console.log(`${prefix} 8. Mengklik tombol "Submit" ...`);
    const submitButton = page.getByText('Submit').first();
    await submitButton.waitFor({ state: 'visible', timeout: 15000 });
    await submitButton.click();
    await page.waitForTimeout(1000);

    console.log(`${prefix} 9. Mengklik tombol "Done" ...`);
    const doneButton = page.getByText('Done').first();
    await doneButton.waitFor({ state: 'visible', timeout: 15000 });
    await doneButton.click();

    console.log(`${prefix} ✓ Alur report berhasil dijalankan!`);
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
    config: TikTokReportConfig
): Promise<Browser | null> {
    const prefix = `[Browser #${workerId}]`;

    try {
        const { browser, page } = await createBrowserInstance(workerId);
        await reportTikTokAccount(page, config, prefix);
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
    const { totalRuns, browserCount, profileUrl } = parseExecutionParams();

    console.log('======================================================');
    console.log('🚀 Memulai TikTok Report Automation');
    console.log(`- Target Profil TikTok    : ${profileUrl}`);
    console.log(`- Jumlah Putaran (Runs)   : ${totalRuns}`);
    console.log(`- Browser Paralel         : ${browserCount}`);
    console.log('------------------------------------------------------');
    console.log('Tips: npm start <runs> <browsers> [profile_url]');
    console.log('Contoh: npm start 1 5 https://www.tiktok.com/@pojok.lamongan');
    console.log('Atau  : npm start 1 5 @pojok.lamongan');
    console.log('======================================================\n');

    const config: TikTokReportConfig = {
        profileUrl,
        reportReason: 'Something else',
        reportReason2: 'Hate and harassment',
        reportReason3: 'Hate speech and hateful behaviors',
    };

    for (let currentRun = 1; currentRun <= totalRuns; currentRun++) {
        console.log(`\n▶ [Putaran ${currentRun}/${totalRuns}] Membuka ${browserCount} browser secara paralel...`);

        // Buat array worker berdasarkan jumlah browser yang diminta
        const workerPromises = Array.from({ length: browserCount }, (_, index) =>
            runBrowserWorker(index + 1, config)
        );

        // Jalankan semua browser secara paralel
        const results = await Promise.all(workerPromises);
        const validBrowsers = results.filter((b): b is Browser => b !== null);

        console.log(`[Putaran ${currentRun}/${totalRuns}] Selesai. Menutup ${validBrowsers.length} browser...`);
        await Promise.all(validBrowsers.map((browser) => browser.close()));

        // Beri jeda antar putaran jika masih ada putaran berikutnya
        if (currentRun < totalRuns) {
            console.log('Menunggu 2 detik sebelum memulai putaran berikutnya...');
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }

    console.log('\n======================================================');
    console.log('🎉 Seluruh putaran automasi telah selesai dengan sukses!');
    console.log('Semua browser telah ditutup secara otomatis.');
    console.log('======================================================\n');
}

main().catch((error: unknown) => {
    console.error('Terjadi kesalahan:', error);
    process.exit(1);
});
