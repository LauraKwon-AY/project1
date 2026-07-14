const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, statusCode, payload) {
  res.status(statusCode).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || response.statusText);
  }

  return text ? JSON.parse(text) : null;
}

module.exports = async (req, res) => {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json(res, 500, { error: 'Supabase 환경변수가 설정되지 않았습니다.' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'GET') {
      const items = await supabaseRequest('lotto_draws?select=id,numbers,created_at&order=created_at.desc&limit=10');
      return json(res, 200, { items });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const numbers = Array.isArray(body.numbers) ? body.numbers : [];

      if (numbers.length !== 6 || numbers.some(n => !Number.isInteger(n) || n < 1 || n > 45)) {
        return json(res, 400, { error: 'numbers 배열은 1~45 사이의 정수 6개여야 합니다.' });
      }

      const uniqueNumbers = [...new Set(numbers)].sort((a, b) => a - b);
      if (uniqueNumbers.length !== 6) {
        return json(res, 400, { error: '중복 없는 숫자 6개가 필요합니다.' });
      }

      await supabaseRequest('lotto_draws', {
        method: 'POST',
        headers: {
          Prefer: 'return=representation'
        },
        body: JSON.stringify({ numbers: uniqueNumbers })
      });

      const items = await supabaseRequest('lotto_draws?select=id,numbers,created_at&order=created_at.desc&limit=10');
      return json(res, 200, { items });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};
