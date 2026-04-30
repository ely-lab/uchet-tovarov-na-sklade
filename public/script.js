// 🔐 LOGIN
const loginScreen = document.getElementById('login-screen');
const app = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');

const inventoryContainer = document.getElementById('inventory');
const searchInput = document.getElementById('search');
const filterBrand = document.getElementById('filter-brand');
const summaryOutput = document.getElementById('summary');

const btnAddItem = document.getElementById('btn-add-item');
const btnLogout = document.getElementById('btn-logout');

const itemForm = document.getElementById('item-form');

const addSection = document.getElementById('add-section');
const closeModal = document.getElementById('closeModal');

let items = [];
let currentUser = null;


// 📡 API
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка сервера');
  }

  return res.json();
}


// 🔐 LOGIN
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  try {
    const user = await apiFetch('/api/login', {
      method: 'POST',
      body: { username, password }
    });

    currentUser = user;
    localStorage.setItem('user', JSON.stringify(user));

    loginScreen.classList.add('hidden');
    app.classList.remove('hidden');

    btnAddItem.classList.remove('hidden');
    btnLogout.classList.remove('hidden');

    loadItems();

  } catch (err) {
    loginMessage.textContent = err.message;
  }
});


// 🚪 LOGOUT
btnLogout.addEventListener('click', () => {
  localStorage.removeItem('user');
  location.reload();
});


// 📦 LOAD ITEMS
async function loadItems() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user) return;

  const res = await apiFetch(
    `/api/items?warehouse=${user.warehouse}&role=${user.role}`
  );

  items = res;
  renderItems(items);
}


// 🎨 RENDER
function renderItems(list) {
  inventoryContainer.innerHTML = '';

  if (!list.length) {
    inventoryContainer.innerHTML = '<p>Нет товаров</p>';
    summaryOutput.textContent = 'Товаров: 0';
    return;
  }

  list.forEach(item => {
    const el = document.createElement('div');
    el.className = 'card';

    el.innerHTML = `
      <h3>${item.name}</h3>
      <div class="badges">
        <span class="badge">Бренд: ${item.brand}</span>
        <span class="badge">Штрихкод: ${item.barcode}</span>
        <span class="badge">Остаток: ${item.quantity} ${item.unit}</span>
        <span class="badge accent">📦 ${item.warehouse}</span>
      </div>
    <button class="danger" onclick="handleWriteOff(${item.id})">
    Списать</button>
`;

    
    inventoryContainer.appendChild(el);
  });

  summaryOutput.textContent = `Товаров: ${list.length}`;
}



// 🔍 SEARCH
searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase();

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(q) ||
    i.barcode.includes(q)
  );

  renderItems(filtered);
});


// 🏷 FILTER BRAND
filterBrand.addEventListener('change', () => {
  const brand = filterBrand.value;

  if (brand === 'all') {
    renderItems(items);
    return;
  }

  const filtered = items.filter(i => i.brand === brand);
  renderItems(filtered);
});


// ➕ ADD ITEM
itemForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('item-name').value.trim();
  const barcode = document.getElementById('item-barcode').value.trim();
  const brand = document.getElementById('item-brand').value;
  const quantity = Number(document.getElementById('item-quantity').value);
  const unit = document.getElementById('item-unit').value;

  if (!name || !barcode || !brand || isNaN(quantity) || quantity < 0 || !unit) {
    alert('Заполните поля корректно');
    return;
  }

  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!user) {
    alert('Ошибка пользователя');
    return;
  }
  await apiFetch('/api/items', {
    method: 'POST',
    body: {
      name,
      barcode,
      brand,
      quantity,
      unit,
      user
    }
  });

  itemForm.reset();
  addSection.classList.add('hidden');
  loadItems();
  alert('Товар добавлен');
});


// 🪟 MODAL
btnAddItem.addEventListener('click', () => {
  addSection.classList.remove('hidden');
});

closeModal.addEventListener('click', () => {
  addSection.classList.add('hidden');
});


// 🔁 AUTO LOGIN
const saved = localStorage.getItem('user');

if (saved) {
  currentUser = JSON.parse(saved);

  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');

  btnAddItem.classList.remove('hidden');
  btnLogout.classList.remove('hidden');

  loadItems();
}

async function handleWriteOff(id) {
  const amountStr = prompt('Введите количество для списания:');

  if (!amountStr) return;

  const amount = Number(amountStr);

  if (isNaN(amount) || amount <= 0) {
    alert('Введите корректное число');
    return;
  }

  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!user) {
    alert('Ошибка пользователя');
    return;
  }

  try {
    await apiFetch(`/api/items/${id}/writeoff`, {
      method: 'POST',
      body: { amount, user }
    });

    alert('Списание выполнено');
    loadItems();

  } catch (err) {
    alert(err.message);
  }
}

app.post('/api/orders/:id/return', (req, res) => {
  const orderId = Number(req.params.id);
  const { returns, user } = req.body;

  const order = db.orders.find(o => o.id === orderId);

  if (!order) {
    return res.status(404).json({ error: 'Накладная не найдена' });
  }

  returns.forEach(r => {
    const item = db.items.find(i => i.id === r.itemId);

    if (item) {
      item.quantity += r.quantity;
      item.updatedAt = new Date().toISOString();
    }
  });

  saveDB(db);

  // история
  db.history.push({
    id: Date.now(),
    action: 'return',
    user: user?.username || 'unknown',
    text: `Возврат по накладной №${orderId}`,
    date: new Date().toISOString()
  });

  saveDB(db);

  res.json({ success: true });
});