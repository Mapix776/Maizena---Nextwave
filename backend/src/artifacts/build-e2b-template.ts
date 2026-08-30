import { loadEnvFile } from 'node:process';

import { Template, defaultBuildLogger } from 'e2b';

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

if (!process.env.E2B_API_KEY) {
  throw new Error('E2B_API_KEY is required to build the report template');
}

const templateName = process.env.E2B_REPORT_TEMPLATE ?? 'nauta-report-builder-v1';
const template = Template({ fileContextPath: process.cwd() })
  .fromNodeImage('22')
  .makeDir(['/workspace/report', '/workspace/report/scripts'], { user: 'root' })
  .copyItems([
    { src: 'e2b-template/package.json', dest: '/workspace/report/package.json', user: 'root' },
    { src: 'e2b-template/package-lock.json', dest: '/workspace/report/package-lock.json', user: 'root' },
  ])
  .runCmd('chown -R user:user /workspace/report', { user: 'root' })
  .setWorkdir('/workspace/report')
  .runCmd('npm ci')
  .runCmd('npx playwright install-deps chromium', { user: 'root' })
  .runCmd('npx playwright install chromium')
  .copyItems([
    { src: 'e2b-template/scripts/validate-source.mjs', dest: '/workspace/report/scripts/validate-source.mjs', user: 'root' },
    { src: 'e2b-template/scripts/validate-browser.mjs', dest: '/workspace/report/scripts/validate-browser.mjs', user: 'root' },
    { src: 'e2b-template/scripts/assert-no-network.mjs', dest: '/workspace/report/scripts/assert-no-network.mjs', user: 'root' },
  ])
  .runCmd('chown -R user:user /workspace/report/scripts', { user: 'root' });

const build = await Template.build(template, templateName, {
  cpuCount: 2,
  memoryMB: 2_048,
  onBuildLogs: defaultBuildLogger(),
});

console.log(JSON.stringify({
  template: templateName,
  templateId: build.templateId,
  buildId: build.buildId,
}));
