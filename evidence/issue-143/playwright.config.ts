import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({testDir:fileURLToPath(new URL('.',import.meta.url)),testMatch:'check-hosted.spec.ts',workers:1,retries:0,timeout:180000,reporter:'line',outputDir:'/tmp/wilson-hosted-runner-results',use:{trace:'off',video:'off',screenshot:'off'}});
