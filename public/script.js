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
const btnReturnOrder = document.getElementById('btn-return-order');
const btnInventory = document.getElementById('btn-inventory');
const btnTransfer = document.getElementById('btn-transfer');
const btnModuleWarehouse = document.getElementById('btn-module-warehouse');
const btnModuleReturns = document.getElementById('btn-module-returns');
const btnModuleRegistries = document.getElementById('btn-module-registries');
const moduleMenu = document.getElementById('module-menu');
const warehouseSection = document.getElementById('warehouse-section');
const returnsSection = document.getElementById('returns-section');
const registriesSection = document.getElementById('registries-section');
const registryList = document.getElementById('registry-list');
const btnReturnOrderPage = document.getElementById('btn-return-order-page');

const itemForm = document.getElementById('item-form');

const addSection = document.getElementById('add-section');
const closeModal = document.getElementById('closeModal');

let items = [];
let currentUser = null;

// 📡 API
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    headers,
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
    const { user, token } = await apiFetch('/api/login', {
      method: 'POST',
      body: { username, password }
    });

    currentUser = user;
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);

    loginScreen.classList.add('hidden');
    app.classList.remove('hidden');

    btnAddItem.classList.remove('hidden');
    btnLogout.classList.remove('hidden');
    moduleMenu.classList.remove('hidden');

    warehouseSection.classList.add('hidden');
    returnsSection.classList.add('hidden');
    registriesSection.classList.add('hidden');

    btnInventory.classList.add('hidden');
    btnTransfer.classList.add('hidden');
    btnReturnOrder.classList.add('hidden');

  } catch (err) {
    loginMessage.textContent = err.message;
  }
});


// 🚪 LOGOUT
btnLogout.addEventListener('click', async () => {
  try {
    await apiFetch('/api/logout', { method: 'POST' });
  } catch (err) {
    console.warn(err.message);
  }
  localStorage.removeItem('user');
  localStorage.removeItem('token');
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

  if (filterBrand.value === 'all') {
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
      unit
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
  moduleMenu.classList.remove('hidden');

  warehouseSection.classList.add('hidden');
  returnsSection.classList.add('hidden');
  registriesSection.classList.add('hidden');

  btnInventory.classList.add('hidden');
  btnTransfer.classList.add('hidden');
  btnReturnOrder.classList.add('hidden');
}

async function handleWriteOff(id) {
  const amountStr = prompt('Введите количество для списания:');

  if (!amountStr) return;

  const amount = Number(amountStr);

  if (isNaN(amount) || amount <= 0) {
    alert('Введите корректное число');
    return;
  }

  try {
    await apiFetch(`/api/items/${id}/writeoff`, {
      method: 'POST',
      body: { amount }
    });

    alert('Списание выполнено');
    loadItems();

  } catch (err) {
    alert(err.message);
  }
}

btnReturnOrder.addEventListener('click', async () => {
  const orderId = prompt('Введите ID накладной из 1С:');
  if (!orderId) return;
  try {
    const result = await apiFetch(`/api/orders/${Number(orderId)}/return`, {
      method: 'POST'
    });
    alert(`Возврат выполнен. Позиций: ${result.processed}`);
    loadItems();
  } catch (err) {
    alert(err.message);
  }
});
btnReturnOrderPage.addEventListener('click', () => btnReturnOrder.click());

btnInventory.addEventListener('click', async () => {
  const barcode = prompt('Штрихкод товара для инвентаризации:');
  if (!barcode) return;
  const countedQty = Number(prompt('Фактический остаток:'));
  if (Number.isNaN(countedQty) || countedQty < 0) {
    alert('Некорректное количество');
    return;
  }
  try {
    await apiFetch('/api/inventory/recount', {
      method: 'POST',
      body: { barcode: barcode.trim(), countedQty }
    });
    alert('Инвентаризация применена');
    loadItems();
  } catch (err) {
    alert(err.message);
  }
});

btnTransfer.addEventListener('click', async () => {
  const barcode = prompt('Штрихкод товара для перемещения:');
  if (!barcode) return;
  const toWarehouse = prompt('Куда переместить (склад/филиал):');
  if (!toWarehouse) return;
  const amount = Number(prompt('Количество для перемещения:'));
  if (Number.isNaN(amount) || amount <= 0) {
    alert('Некорректное количество');
    return;
  }
  try {
    await apiFetch('/api/transfers', {
      method: 'POST',
      body: { barcode: barcode.trim(), toWarehouse: toWarehouse.trim(), amount }
    });
    alert('Перемещение выполнено');
    loadItems();
  } catch (err) {
    alert(err.message);
  }
});

function showModule(moduleName) {
  warehouseSection.classList.toggle('hidden', moduleName !== 'warehouse');
  returnsSection.classList.toggle('hidden', moduleName !== 'returns');
  registriesSection.classList.toggle('hidden', moduleName !== 'registries');

  btnInventory.classList.toggle('hidden', moduleName !== 'warehouse');
  btnTransfer.classList.toggle('hidden', moduleName !== 'warehouse');
  btnReturnOrder.classList.toggle('hidden', moduleName !== 'returns');

  if (moduleName === 'warehouse') {
  loadItems();
  }

  if (moduleName === 'registries') {
    loadRegistries();
  }
}

btnModuleWarehouse.addEventListener('click', () => showModule('warehouse'));
btnModuleReturns.addEventListener('click', () => showModule('returns'));
btnModuleRegistries.addEventListener('click', () => showModule('registries'));

async function loadRegistries() {
  try {
    const rows = await apiFetch('/api/registries/shipping-lists');
    if (!rows.length) {
      registryList.innerHTML = '<p>Реестры ПЛ не найдены.</p>';
      return;
    }
    registryList.innerHTML = rows.map(r => (
      `<div class="card"><b>ПЛ №${r.number || r.id}</b><br/>Дата: ${r.date || '-'}<br/>Склад: ${r.warehouse || '-'}<br/>Строк: ${(r.items || []).length}</div>`
    )).join('');
  } catch (err) {
    registryList.innerHTML = `<p>${err.message}</p>`;
  }
}