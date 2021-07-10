import lighthouse = require('lighthouse');
import { config } from 'dotenv';
import { launch } from 'chrome-launcher';
import { createClient } from '@supabase/supabase-js';
import { Lhr } from './types/lhr';
// import { schedule } from "node-cron";

import { number_of_audits, sites } from './sites.js';

config();

const genReport = async (url: string, desc?: string) => {
  const chrome = await launch({ chromeFlags: ['--headless', '--no-sandbox'] });
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance'],
    port: chrome.port,
  };
  const results = await lighthouse(url, options);
  const lhr: Lhr = results.lhr;

  await chrome.kill();

  return {
    lcp: lhr.audits['largest-contentful-paint'].numericValue, // web vitals
    fid: lhr.audits['max-potential-fid'].numericValue, // web vitals
    cls: lhr.audits['cumulative-layout-shift'].numericValue, // web vitals
    fcp: lhr.audits['first-contentful-paint'].numericValue,
    speed_index: lhr.audits['speed-index'].numericValue,
    time_to_interactive: lhr.audits.interactive.numericValue,
    total_blocking_time: lhr.audits['total-blocking-time'].numericValue,
    site: url,
    site_desc: desc,
  };
};

const writeAudit = async (url: string, desc?: string) => {
  const newAudit = await genReport(url, desc);

  const databaseAPI = createClient(process.env.API_URL, process.env.API_KEY);

  const { data, error } = await databaseAPI.from('audits2').insert([newAudit]);

  console.log('Aditoria generada \n', data, error);
};

// const task = schedule(
//   "* * * * *",
//   async () => {
//     await writeAudit(process.env.SITE_URL);
//     console.log("\n\nPreparando auditoría ...\n\n");
//   },
//   { scheduled: false }
// );

// module.exports = task.start;

async function* asyncGenerator() {
  let i = 0;
  while (i < number_of_audits) {
    yield i++;
  }
}

(async () => {
  try {
    for await (const site of sites) {
      for await (const num of asyncGenerator()) {
        await writeAudit(site.url, site.desc).catch((err) =>
          console.log(err, num),
        );
      }
    }
  } catch (err) {
    console.log(err);
  }
})();
