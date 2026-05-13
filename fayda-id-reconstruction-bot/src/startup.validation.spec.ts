import * as path from 'path';

const REQUIRED_ASSETS = [
  'bg_front.png',
  'bg_back.png',
];

function validateStartup(
  token: string | undefined,
  assetsDir: string,
  existsSync: (value: string) => boolean,
): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!token) {
    errors.push('TELEGRAM_BOT_TOKEN is not set');
  }

  const missing = REQUIRED_ASSETS.filter((file) => !existsSync(path.join(assetsDir, file)));
  if (missing.length > 0) {
    errors.push(`Missing required assets: ${missing.join(', ')}`);
  }

  if (!process.env.NVIDIA_API_KEY && !process.env.NGC_API_KEY) {
    warnings.push('NVIDIA API key not found - using heuristic crop fallback');
  }

  return { ok: errors.length === 0, errors, warnings };
}

describe('Startup validation', () => {
  afterEach(() => {
    delete process.env.NVIDIA_API_KEY;
    delete process.env.NGC_API_KEY;
  });

  it('fails when TELEGRAM_BOT_TOKEN is not set', () => {
    const result = validateStartup(undefined, '/fake/assets', () => true);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('TELEGRAM_BOT_TOKEN'))).toBe(true);
  });

  it('passes when token is set and all assets exist', () => {
    process.env.NVIDIA_API_KEY = 'fake-key';
    const result = validateStartup('valid-token', '/fake/assets', () => true);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('fails when a required asset is missing', () => {
    const result = validateStartup('valid-token', '/fake/assets', (value) => !String(value).includes('bg_front.png'));
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('bg_front.png'))).toBe(true);
  });

  it('warns when NVIDIA API key is missing', () => {
    const result = validateStartup('valid-token', '/fake/assets', () => true);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('NVIDIA'))).toBe(true);
  });
});
