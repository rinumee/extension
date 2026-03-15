// popup.js - MTProto bilan sessiyalarni ko'rish (to'liq ishlaydi, CSP muammosiz)

const API_ID = 34609793;
const API_HASH = '506605b7450c2256adb78242141a04e1';

const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const btn = document.getElementById('loginBtn');

let mtproto = null;
let phoneCodeHash = '';
let currentStep = 'phone';

function setStatus(text, type = '') {
  statusEl.textContent = text;
  statusEl.className = type ? `status ${type}` : '';
}

function showStep(step) {
  document.getElementById('codeStep').classList.toggle('hidden', step !== 'code');
  document.getElementById('passwordStep').classList.toggle('hidden', step !== 'password');
  currentStep = step;
}

async function initMtproto() {
  if (mtproto) return mtproto;

  // MTProto allaqachon script orqali yuklangan (popup.html da)
  if (!window.MTProto) {
    throw new Error('MTProto yuklanmadi! Faylni tekshiring.');
  }

  mtproto = new MTProto({
    api_id: API_ID,
    api_hash: API_HASH,
    test: false,
    storageOptions: {
      instance: localStorage
    }
  });

  return mtproto;
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const phone = document.getElementById('phone').value.trim();
  const code = document.getElementById('code').value.trim();
  const password = document.getElementById('password').value.trim();

  if (currentStep === 'phone' && !phone) return setStatus('Raqamni kiriting!', 'error');

  btn.disabled = true;
  setStatus('Jarayon boshlandi...');

  try {
    await initMtproto();

    if (currentStep === 'phone') {
      const res = await mtproto.call('auth.sendCode', {
        phone_number: phone,
        settings: { _: 'codeSettings' }
      });
      phoneCodeHash = res.phone_code_hash;
      showStep('code');
      btn.textContent = 'Kodni yuborish';
      setStatus('SMS kod yuborildi! Kiriting.', 'success');
      return;
    }

    if (currentStep === 'code') {
      if (!code) throw new Error('Kod kiriting!');
      try {
        await mtproto.call('auth.signIn', {
          phone_number: phone,
          phone_code_hash: phoneCodeHash,
          phone_code: code
        });
      } catch (err) {
        if (err.error_message === 'SESSION_PASSWORD_NEEDED') {
          showStep('password');
          btn.textContent = '2FA parolini yuborish';
          setStatus('2FA paroli kerak!', 'success');
          return;
        }
        throw err;
      }
    }

    if (currentStep === 'password') {
      if (!password) throw new Error('Parolni kiriting!');
      const pwd = await mtproto.call('account.getPassword');
      const check = await mtproto.call('auth.checkPassword', {
        password: await mtproto.computePassword(pwd, password)
      });
    }

    // Sessiyalarni olish
    const sessions = await mtproto.call('account.getAuthorizations');
    const formatted = sessions.authorizations.map(a => ({
      "Qurilma": `${a.device_model || 'Noma\'lum'} (${a.platform || ''} ${a.system_version || ''})`,
      "IP": a.ip || 'Noma\'lum',
      "Joylashuv": a.country || 'Noma\'lum',
      "Oxirgi faol": new Date(a.date_active * 1000).toLocaleString('uz-UZ'),
      "Sessiya ID": a.hash
    }));

    resultEl.textContent = JSON.stringify(formatted, null, 2);
    setStatus('✅ Muvaffaqiyat! Sessiyalaringiz:', 'success');
    btn.textContent = 'Yana tekshirish';
    showStep('done');

  } catch (err) {
    let msg = err.error_message || err.message || 'Xato';
    if (msg.includes('PHONE_CODE_INVALID')) msg = 'SMS kod noto\'g\'ri';
    if (msg.includes('PASSWORD_HASH_INVALID')) msg = '2FA paroli noto\'g\'ri';
    setStatus('Xato: ' + msg, 'error');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});