// 🔐 ЭЛЕМЕНТЫ
const loginScreen = document.getElementById('login-screen');
const app = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');

const moduleMenu = document.getElementById('module-menu');
const warehouseSection = document.getElementById('warehouse-section');
const returnsSection = document.getElementById('returns-section');
const registriesSection = document.getElementById('registries-section');

const inventoryContainer = document.getElementById('inventory');
const summaryOutput = document.getElementById('summary');

const btnModuleWarehouse = document.getElementById('btn-module-warehouse');
const btnModuleReturns = document.getElementById('btn-module-returns');
const btnModuleRegistries = document.getElementById('btn-module-registries');

const btnLogout = document.getElementById('btn-logout');
const btnAddItem = document.getElementById('btn-add-item');
const btnBackMenu = document.getElementById('btn-back-menu');

const invoiceList = document.getElementById('invoice-list');
const invoiceDetails = document.getElementById('invoice-details');

// ➕ МОДАЛКА
const addSection = document.getElementById('add-section');
const itemForm = document.getElementById('item-form');
const closeModal = document.getElementById('closeModal');

// 🔑 ДАННЫЕ
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user'));
let items = [];

// 📄 НАКЛАДНЫЕ
let invoices = [];
let selectedInvoice = null;

// 📡 API
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? 'Bearer ' + token : ''
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка сервера');
  }

  return res.json();
}

// 🔐 ВХОД
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await apiFetch('/api/login', {
      method: 'POST',
      body: { username, password }
    });

    token = res.token;
    currentUser = res.user;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));

    loginScreen.classList.add('hidden');
    app.classList.remove('hidden');

    showModule('menu');
  } catch (err) {
    loginMessage.textContent = err.message;
  }
});

// 🚪 ВЫХОД
btnLogout.addEventListener('click', () => {
  localStorage.clear();
  location.reload();
});

// 🔄 МОДУЛИ
function showModule(name) {
  moduleMenu.classList.toggle('hidden', name !== 'menu');

  warehouseSection.classList.toggle('hidden', name !== 'warehouse');
  returnsSection.classList.toggle('hidden', name !== 'returns');
  registriesSection.classList.toggle('hidden', name !== 'registries');

  btnBackMenu.classList.toggle('hidden', name === 'menu');

  // 👇 КНОПКА ДОБАВИТЬ ТОЛЬКО ДЛЯ АДМИНА И ТОЛЬКО В СКЛАДЕ
  btnAddItem.classList.toggle(
    'hidden',
    !(name === 'warehouse' && currentUser?.role === 'head_office')
  );

  if (name === 'warehouse') loadItems();
  if (name === 'returns') loadInvoices();
}

// 📦 ЗАГРУЗКА ТОВАРОВ
async function loadItems() {
  const data = await apiFetch('/api/items');
  items = data;
  renderItems(items);
}

// 🎨 РЕНДЕР
function renderItems(list) {
  inventoryContainer.innerHTML = '';

  list.forEach(item => {
    const el = document.createElement('div');
    el.className = 'card';

    el.innerHTML = `
      <h3>${item.name}</h3>
      <div class="badges">
        <span class="badge">Бренд: ${item.brand}</span>
        <span class="badge">Штрихкод: ${item.barcode}</span>
        <span class="badge">Остаток: ${item.quantity} ${item.unit}</span>
        ${item.warehouse ? `<span class="badge accent">${item.warehouse}</span>` : ''}
      </div>
    `;

    inventoryContainer.appendChild(el);
  });

  summaryOutput.textContent = `Товаров: ${list.length}`;
}

// 📄 ЗАГРУЗКА НАКЛАДНЫХ
async function loadInvoices() {
  try {
    invoices = await apiFetch('/api/invoices');

    invoiceList.innerHTML = '';

    if (!invoices.length) {
      invoiceList.innerHTML = '<p class="muted">Накладные не найдены</p>';
      return;
    }

    invoices.forEach(invoice => {
      const el = document.createElement('div');
      el.className = 'invoice-card';

      el.innerHTML = `
        <h3>Накладная №${invoice.id}</h3>
        <p><b>Клиент:</b> ${invoice.customer || '-'}</p>
        <p><b>Склад:</b> ${invoice.warehouse || '-'}</p>
        <p><b>Дата:</b> ${invoice.date || '-'}</p>
        <button class="primary" onclick="openInvoice(${invoice.id})">
          Открыть
        </button>
      `;

      invoiceList.appendChild(el);
    });
  } catch (err) {
    invoiceList.innerHTML = `<p>${err.message}</p>`;
  }
}

// 📋 ОТКРЫТЬ НАКЛАДНУЮ
function openInvoice(invoiceId) {
  selectedInvoice = invoices.find(i => i.id === invoiceId);

  if (!selectedInvoice) {
    alert('Накладная не найдена');
    return;
  }

  const rows = selectedInvoice.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.name}</td>
      <td>${item.barcode}</td>
      <td>${item.quantity} ${item.unit || 'шт'}</td>
      <td>
        <input
          type="number"
          min="0"
          max="${item.quantity}"
          class="return-input"
          data-barcode="${item.barcode}"
          data-name="${item.name}"
          data-unit="${item.unit || 'шт'}"
        />
      </td>
    </tr>
  `).join('');

  invoiceDetails.innerHTML = `
    <table class="return-table">
      <tbody>${rows}</tbody>
    </table>

    <button class="primary" onclick="submitReturn()">
      Оформить возврат
    </button>
  `;
}

// 🔁 ВОЗВРАТ
async function submitReturn() {
  const inputs = document.querySelectorAll('.return-input');

  const items = Array.from(inputs)
    .map(input => ({
      barcode: input.dataset.barcode,
      quantity: Number(input.value)
    }))
    .filter(i => i.quantity > 0);

  if (!items.length) {
    alert('Укажите количество');
    return;
  }

  await apiFetch('/api/returns', {
    method: 'POST',
    body: {
      invoiceId: selectedInvoice.id,
      items
    }
  });

  alert('Возврат выполнен');
  loadInvoices();
}

// ➕ ОТКРЫТЬ МОДАЛКУ
btnAddItem?.addEventListener('click', () => {
  addSection.classList.remove('hidden');
});

// ❌ ЗАКРЫТЬ
closeModal?.addEventListener('click', () => {
  addSection.classList.add('hidden');
});

// ➕ ДОБАВИТЬ ТОВАР
itemForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('item-name').value;
  const barcode = document.getElementById('item-barcode').value;
  const brand = document.getElementById('item-brand').value;
  const quantity = Number(document.getElementById('item-quantity').value);
  const unit = document.getElementById('item-unit').value;

  await apiFetch('/api/items', {
    method: 'POST',
    body: { name, barcode, brand, quantity, unit }
  });

  addSection.classList.add('hidden');
  loadItems();
});

// 🔙 НАЗАД
btnBackMenu?.addEventListener('click', () => {
  showModule('menu');
});

// 📱 АВТОВХОД
if (token && currentUser) {
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
  showModule('menu');
}

// 📌 КНОПКИ МЕНЮ
btnModuleWarehouse.onclick = () => showModule('warehouse');
btnModuleReturns.onclick = () => showModule('returns');
btnModuleRegistries.onclick = () => showModule('registries');