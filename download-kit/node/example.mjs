import { AgataClient } from './agata-client.mjs';

const agata = new AgataClient();

try {
  console.log('Health:', await agata.health());
  console.log('Plan catalogue:', await agata.listPlans());
  console.log('Organization tenants:', await agata.listTenants());
} catch (error) {
  console.error(`Agata request failed${error.status ? ` (${error.status})` : ''}: ${error.message}`);
  process.exitCode = 1;
}
