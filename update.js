const { parse } = require('yaml');
const { join } = require('path');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const rp = require('request-promise');
const cheerio = require('cheerio');
const moment = require('moment');

const devices = parse(readFileSync(join(__dirname, '_data/devices.yml'), 'utf8'));
const names = parse(readFileSync(join(__dirname, '_data/device_names.yml'), 'utf8'));

const now = moment().utcOffset(8);
const base = now.format('YYYYMM');
const yaml = join(__dirname, `_data/stats/${base}.yml`);

let records = existsSync(yaml) && parse(readFileSync(yaml, 'utf8')) || [];

rp.get('https://stats.mokeedev.com')
  .then(html => cheerio.load(html))
  .then(parseDoc);

function parseDoc($) {
  const current = { timestamp: now.unix() };

  $('tr').each((i, tr) => {
    const tds = $(tr).find('> td');
    if (tds.length != 2) return;
    const td0 = $(tds.get(0));
    const td1 = $(tds.get(1));

    const name = td0.text().toLowerCase();
    if (!devices.includes(name)) return;

    current[name] = parseInt(td1.text().replace(/,/g,''));
  });

  const last = records.pop();
  if (last && moment(last.timestamp * 1000).utcOffset(8).date() != now.date()) {
    records.push(last);
  }

  records.push(current);

  const lines = [];
  for (const r of records) {
    lines.push(`- timestamp: ${r.timestamp}`);
    for (const d of devices) {
      if (typeof r[d] != 'undefined') {
        lines.push(`  ${d}: ${r[d]}`);
      }
    }
  }
  lines.push('');

  writeFileSync(yaml, lines.join('\n'));

  const message = [];
  message.push(`*安装量统计*`);
  message.push('');
  for (const d of devices) {
    if (typeof current[d] != 'undefined') {
      message.push(`${names[d]} …… *${current[d]}*`);
    }
  }
  message.push('');
  message.push('[查看详情](https://stats.xingrz.me/)');
  message.push('');
  message.push('#stats');

  rp.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
    json: {
      chat_id: '@smartisandev',
      text: message.join('\n'),
      parse_mode: 'Markdown',
    }
  });
}
