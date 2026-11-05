import { run } from '../lib/config.js';
import { validatePlan } from './metadata.js';
await run(async () => { console.log(await validatePlan()); console.log('Both metadata JSON documents and images passed public HTTPS GET checks. No transaction submitted.'); });
