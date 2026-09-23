// src/sonar-scanner.js — wraps sonarqube-scanner for `npm run sonar`
// Project-level analysis config (sources, exclusions, CPD) lives in
// sonar-project.properties; this script only supplies the server URL
// and token so it works both locally and in CI.
import { scan } from 'sonarqube-scanner'

if (!process.env.SONAR_TOKEN) {
  console.error(
    'SONAR_TOKEN is not set — refusing to scan. Export it, or run in CI where the workflow injects the secret.',
  )
  process.exit(1)
}

scan({
  serverUrl: process.env.SONAR_HOST_URL || 'http://localhost:9000',
  options: {
    'sonar.token': process.env.SONAR_TOKEN,
    'sonar.projectKey': 'connect',
    'sonar.typescript.tsconfigPath': 'tsconfig.json',
  },
})
