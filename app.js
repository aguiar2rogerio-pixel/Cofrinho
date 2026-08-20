// Registro do PWA.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
            .then((registration) => console.log('[PWA] Service Worker registrado:', registration.scope))
            .catch((error) => console.error('[PWA] Falha ao registrar Service Worker:', error));
    });
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[character]));
}

function normalizeState(candidate) {
    const source = candidate && typeof candidate === 'object' ? candidate : {};
    return {
        balance: Number.isFinite(Number(source.balance)) ? Number(source.balance) : 0,
        bills: Array.isArray(source.bills) ? source.bills : [],
        history: Array.isArray(source.history) ? source.history : [],
        filter: ['pending', 'paid', 'all'].includes(source.filter) ? source.filter : 'pending'
    };
}

// --- State ---
let state = {
            balance: 0,
            bills: [],
            history: [],
            filter: 'pending'
        };

        let editingBillId = null;
        let seeAllBills = false;
        let currentModalView = 'current';
        const STORAGE_KEY = 'provisoes_v3_3_data';

        function getLocalDateStr() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        function init() {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    state = normalizeState(JSON.parse(saved));
                } catch (error) {
                    console.warn('[Storage] Dados inválidos; iniciando estado vazio.', error);
                    state = normalizeState(null);
                }
            } else {
                state = normalizeState(state);
            }
            
            if (state.history) {
                state.history = state.history.map(h => {
                    if (!h.id) {
                        h.id = 'dep_' + h.date + '_' + Math.random().toString(36).substr(2, 5);
                    }
                    return h;
                });
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

            const today = new Date();
            document.getElementById('today-date').innerText = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
            checkTodayDeposit();
            generateRecurringBills();
            render();

            // Inicializa o módulo de Lembretes Elegantes
            initReminderModule();
        }

        function save() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            render();
        }

        function confirmDailyDeposit() {
            const todayStr = getLocalDateStr();
            const alreadyDone = state.history.some(h => h.date === todayStr);
            if (alreadyDone) return;

            const amount = parseFloat(document.getElementById('daily-input').value);
            if(isNaN(amount) || amount <= 0) return;
            
            state.balance += amount;
            state.history.push({ 
                id: 'dep_' + todayStr + '_' + Math.random().toString(36).substr(2, 5),
                date: todayStr, 
                amount: amount 
            });
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            document.getElementById('daily-input').value = '';
            checkTodayDeposit();
            render();
        }

        function checkTodayDeposit() {
            const todayStr = getLocalDateStr();
            const alreadyDone = state.history.some(h => h.date === todayStr);
            const btn = document.getElementById('btn-daily');
            const input = document.getElementById('daily-input');
            
            if (alreadyDone) {
                btn.disabled = true;
                btn.className = "bg-zinc-800 px-6 rounded-2xl font-bold flex items-center gap-2 border border-zinc-800 text-emerald-500/40 cursor-not-allowed";
                btn.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i>';
                input.disabled = true;
                input.value = ''; 
                input.placeholder = "JÁ DEPOSITADO HOJE!"; 
                input.className = "w-full bg-zinc-950/80 border border-zinc-800 rounded-2xl py-3 pl-10 pr-4 text-sm font-bold text-emerald-500/50 transition-all outline-none text-center select-none";
            } else {
                btn.disabled = false;
                btn.className = "bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all px-6 rounded-2xl font-bold flex items-center gap-2";
                btn.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5"></i>';
                input.disabled = false;
                input.placeholder = "0,00";
                input.className = "w-full bg-zinc-900 border border-zinc-700 rounded-2xl py-3 pl-10 pr-4 text-lg font-bold focus:border-emerald-500 transition-all outline-none";
            }
            lucide.createIcons();
        }

        function confirmAporte() {
            const val = parseFloat(document.getElementById('aporte-value').value);
            const date = document.getElementById('aporte-date').value;
            if (Number.isFinite(val) && val > 0) {
                const historyDate = date || getLocalDateStr();
                state.balance += val;
                state.history.push({ 
                    id: 'ap_' + historyDate + '_' + Math.random().toString(36).substr(2, 5),
                    date: historyDate, 
                    amount: val 
                });
                save();
                closeAporteModal();
                document.getElementById('aporte-value').value = '';
                document.getElementById('aporte-date').value = '';
            }
        }

        function deleteDeposit(id) {
            const entryIndex = state.history.findIndex(h => h.id === id);
            if (entryIndex === -1) return;
            
            const entry = state.history[entryIndex];
            const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.amount);
            
            if (confirm(`Deseja estornar o depósito de ${fmt} realizado em ${formatDate(entry.date)}?\nO valor será removido do Saldo Geral.`)) {
                state.balance -= entry.amount;
                state.history.splice(entryIndex, 1);
                
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                checkTodayDeposit();
                render();
                openDepositHistoryModal(currentModalView);
            }
        }

        function openAllMonthsModal() {
            const listContainer = document.getElementById('all-months-list');
            const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
            
            const groups = {};
            state.history.forEach(h => {
                const parts = h.date.split('-');
                const key = `${parts[0]}-${parts[1]}`;
                if (!groups[key]) groups[key] = 0;
                groups[key] += h.amount;
            });

            const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
            
            if (sortedKeys.length === 0) {
                listContainer.innerHTML = `<div class="text-center py-6 text-zinc-600 text-xs">Sem registros históricos.</div>`;
            } else {
                listContainer.innerHTML = sortedKeys.map(key => {
                    const [year, month] = key.split('-');
                    const labelDate = new Date(year, parseInt(month) - 1, 1);
                    const monthLabel = labelDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    
                    return `
                        <button onclick="openDepositHistoryModal('${key}', true)" class="w-full flex justify-between items-center bg-zinc-950/50 border border-zinc-800/80 p-3 rounded-xl hover:bg-zinc-800 transition-colors text-left">
                            <span class="text-xs font-bold text-zinc-300 capitalize">${monthLabel}</span>
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs font-black text-emerald-400">${fmt(groups[key])}</span>
                                <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-zinc-600"></i>
                            </div>
                        </button>
                    `;
                }).join('');
            }
            
            document.getElementById('all-months-modal').classList.remove('hidden');
            lucide.createIcons();
        }

        function closeAllMonthsModal() {
            document.getElementById('all-months-modal').classList.add('hidden');
        }

        function openDepositHistoryModal(viewType, cameFromAllMonths = false) {
            currentModalView = viewType;
            const now = new Date();
            let targetMonth, targetYear, titleText;
            
            const backBtn = document.getElementById('btn-modal-back');
            if (cameFromAllMonths) {
                backBtn.classList.remove('hidden');
            } else {
                backBtn.classList.add('hidden');
            }

            if (viewType === 'current') {
                targetMonth = now.getMonth();
                targetYear = now.getFullYear();
                titleText = "Entradas de " + now.toLocaleDateString('pt-BR', { month: 'long' });
            } else if (viewType === 'previous') {
                const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                targetMonth = prev.getMonth();
                targetYear = prev.getFullYear();
                titleText = "Entradas de " + prev.toLocaleDateString('pt-BR', { month: 'long' });
            } else {
                const [year, month] = viewType.split('-');
                targetMonth = parseInt(month) - 1;
                targetYear = parseInt(year);
                const labelDate = new Date(targetYear, targetMonth, 1);
                titleText = "Entradas de " + labelDate.toLocaleDateString('pt-BR', { month: 'long' });
            }
            
            document.getElementById('deposits-modal-title').innerText = titleText;
            
            const filtered = state.history.filter(h => {
                const d = new Date(h.date + 'T00:00:00');
                return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
            }).sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const listContainer = document.getElementById('deposits-modal-list');
            const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
            
            if (filtered.length === 0) {
                listContainer.innerHTML = `<div class="text-center py-6 text-zinc-600 text-xs">Nenhum depósito neste período.</div>`;
            } else {
                listContainer.innerHTML = filtered.map(h => `
                    <div class="flex justify-between items-center bg-zinc-950/40 p-2.5 border border-zinc-800 rounded-xl">
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-zinc-400">${new Date(h.date + 'T00:00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</span>
                            <span class="text-xs font-bold text-emerald-400">+ ${fmt(h.amount)}</span>
                        </div>
                        <button onclick="deleteDeposit('${h.id}')" class="text-zinc-600 hover:text-rose-400 p-1 rounded transition-colors">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                `).join('');
            }
            
            const totalSum = filtered.reduce((acc, h) => acc + h.amount, 0);
            document.getElementById('deposits-modal-total').innerText = fmt(totalSum);
            
            if (cameFromAllMonths) closeAllMonthsModal();
            document.getElementById('deposits-modal').classList.remove('hidden');
            lucide.createIcons();
        }

        function backToMonthsModal() {
            closeDepositHistoryModal();
            openAllMonthsModal();
        }

        function closeDepositHistoryModal() {
            document.getElementById('deposits-modal').classList.add('hidden');
        }

        function payBill(id) {
            const bill = state.bills.find(b => b.id === id);
            if (bill && !bill.paid) {
                if (state.balance >= bill.value) {
                    state.balance -= bill.value;
                    bill.paid = true;
                    if (bill.recurring) generateRecurringBills();
                    save();
                } else {
                    alert('Saldo insuficiente no cofrinho!');
                }
            }
        }

        function deleteBillFromModal() {
            if (!editingBillId) return;
            const bill = state.bills.find(b => b.id === editingBillId);
            if (!bill) return;

            if (!confirm('Excluir este lançamento?')) return;

            if (bill.installments > 1) {
                const relatedBills = state.bills.filter(b => 
                    b.name === bill.name && 
                    b.installments === bill.installments &&
                    b.date >= bill.date
                );
                if (relatedBills.length > 1) {
                    const deleteRelated = confirm('Excluir todas as parcelas futuras vinculadas?\n\n[OK] = Deletar Todas\n[Cancelar] = Apenas Esta');
                    if (deleteRelated) state.bills = state.bills.filter(b => !relatedBills.includes(b));
                    else state.bills = state.bills.filter(b => b.id !== editingBillId);
                } else {
                    state.bills = state.bills.filter(b => b.id !== editingBillId);
                }
            } else {
                state.bills = state.bills.filter(b => b.id !== editingBillId);
            }
            save();
            closeEditBillModal();
        }

        function openEditBillModal(id) {
            editingBillId = id;
            const bill = state.bills.find(b => b.id === id);
            if (!bill) return;

            document.getElementById('edit-bill-id').value = id;
            document.getElementById('edit-bill-name').value = bill.name;
            document.getElementById('edit-bill-value').value = bill.value;
            document.getElementById('edit-bill-date').value = bill.date;
            document.getElementById('edit-bill-recurring').checked = bill.recurring || false;

            let infoText = '';
            if (bill.installments > 1) {
                infoText = `Parcela ${bill.installmentNum} de ${bill.installments}`;
            }
            document.getElementById('edit-bill-installments-info').innerText = infoText;
            document.getElementById('edit-bill-modal').classList.remove('hidden');
        }

        function closeEditBillModal() {
            document.getElementById('edit-bill-modal').classList.add('hidden');
            editingBillId = null;
        }

        document.getElementById('edit-bill-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-bill-id').value;
            const bill = state.bills.find(b => b.id === id);
            if (!bill) return;

            const oldName = bill.name;
            const oldDate = bill.date;

            const editedName = document.getElementById('edit-bill-name').value.trim();
            const editedValue = parseFloat(document.getElementById('edit-bill-value').value);
            const editedDate = document.getElementById('edit-bill-date').value;
            if (!editedName || !Number.isFinite(editedValue) || editedValue <= 0 || !editedDate) return;

            bill.name = editedName;
            bill.value = editedValue;
            bill.date = editedDate;
            bill.recurring = document.getElementById('edit-bill-recurring').checked;

            if (bill.installments > 1) {
                const relatedBills = state.bills.filter(b => 
                    b.name === oldName && 
                    b.installments === bill.installments &&
                    b.date >= oldDate
                );
                relatedBills.forEach((relBill, index) => {
                    relBill.name = bill.name;
                    relBill.value = bill.value;
                    relBill.recurring = bill.recurring;
                    if (index === 0) relBill.date = bill.date;
                    else {
                        const d = new Date(bill.date + 'T00:00:00');
                        d.setMonth(d.getMonth() + index);
                        relBill.date = d.toISOString().split('T')[0];
                    }
                });
            }
            save();
            closeEditBillModal();
        });

        function toggleSeeAll() {
            seeAllBills = !seeAllBills;
            render();
        }

        function resetAllData() {
            if (confirm('Aviso: Apagar todos os dados permanentemente?')) {
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
            }
        }

        function generateRecurringBills() {
            const now = new Date();
            const windowMonths = 3;
            let added = false;
            state.bills.filter(b => b.recurring).forEach(baseBill => {
                const instances = state.bills.filter(b => b.name === baseBill.name && b.recurring);
                instances.sort((a, b) => new Date(b.date) - new Date(a.date));
                const latest = instances[0];
                let currentRefDate = new Date(latest.date + 'T00:00:00');
                const originalDay = new Date(baseBill.originalDate || baseBill.date + 'T00:00:00').getDate();
                const limitDate = new Date(now.getFullYear(), now.getMonth() + windowMonths, 1);
                while (currentRefDate < limitDate) {
                    let nextDate = new Date(currentRefDate);
                    nextDate.setMonth(nextDate.getMonth() + 1);
                    nextDate.setDate(originalDay);
                    if (nextDate.getDate() !== originalDay) nextDate.setDate(0);
                    const dateStr = nextDate.toISOString().split('T')[0];
                    const exists = state.bills.some(b => b.name === baseBill.name && b.date === dateStr);
                    if (!exists && nextDate < limitDate) {
                        state.bills.push({
                            ...baseBill,
                            id: Date.now().toString() + Math.random(),
                            date: dateStr,
                            originalDate: baseBill.originalDate || baseBill.date,
                            paid: false
                        });
                        added = true;
                    }
                    currentRefDate = nextDate;
                }
            });
            if (added) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }

        function exportData() {
            const dataStr = JSON.stringify(state, null, 2);
            const blob = new Blob([dataStr], { type: 'text/plain' });
            const link = document.createElement('a');
            link.download = `backup_cofrinho_${getLocalDateStr()}.txt`;
            link.href = window.URL.createObjectURL(blob);
            link.click();
        }

        // --- Core Render ---
        function render() {
            const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            document.getElementById('main-balance').innerText = fmt(state.balance);
            
            // 1. Cálculo do Acumulado "Em Aberto" (Mês atual + passados)
            const pendingBills = state.bills.filter(b => !b.paid);
            const accumulatedDebt = pendingBills.reduce((acc, b) => {
                const d = new Date(b.date + 'T00:00:00');
                if (d.getFullYear() < currentYear || (d.getFullYear() === currentYear && d.getMonth() <= currentMonth)) {
                    return acc + b.value;
                }
                return acc;
            }, 0);
            
            document.getElementById('month-debt').innerText = fmt(accumulatedDebt);
            
            const coverage = state.balance - accumulatedDebt;
            const coverageEl = document.getElementById('coverage-status');
            const coverageBadge = document.getElementById('coverage-badge');
            
            if (coverage >= 0) {
                coverageEl.innerText = fmt(coverage);
                coverageEl.className = "text-sm font-black text-emerald-400";
                coverageBadge.innerText = "Mês protegido";
                coverageBadge.className = "text-[8px] font-bold uppercase tracking-wider block mt-0.5 text-emerald-500/80";
            } else {
                coverageEl.innerText = fmt(Math.abs(coverage));
                coverageEl.className = "text-sm font-black text-amber-500";
                coverageBadge.innerText = "Falta para fechar";
                coverageBadge.className = "text-[8px] font-bold uppercase tracking-wider block mt-0.5 text-amber-500/80";
            }

            // CORREÇÃO DINÂMICA: Geração dos Textos e Cálculos dos 3 Balões de Futuro (Trimestre à frente)
            const m0 = new Date(currentYear, currentMonth, 1);
            const m1 = new Date(currentYear, currentMonth + 1, 1);
            const m2 = new Date(currentYear, currentMonth + 2, 1);

            document.getElementById('lbl-curr-month').innerText = m0.toLocaleDateString('pt-BR', { month: 'short' });
            document.getElementById('lbl-next-month').innerText = m1.toLocaleDateString('pt-BR', { month: 'short' });
            document.getElementById('lbl-after-month').innerText = m2.toLocaleDateString('pt-BR', { month: 'short' });

            // Soma das contas daquele mês específico
            const calcMonthBillsTotal = (targetDate) => {
                return state.bills.filter(b => {
                    const d = new Date(b.date + 'T00:00:00');
                    return d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
                }).reduce((sum, b) => sum + b.value, 0);
            };

            document.getElementById('val-curr-month-bills').innerText = fmt(calcMonthBillsTotal(m0));
            document.getElementById('val-next-month-bills').innerText = fmt(calcMonthBillsTotal(m1));
            document.getElementById('val-after-month-bills').innerText = fmt(calcMonthBillsTotal(m2));
            
            // 2. Histórico de Entradas das duas pílulas de auditoria rápida
            const curMonthEntries = state.history.filter(h => {
                const d = new Date(h.date + 'T00:00:00');
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            }).reduce((acc, h) => acc + h.amount, 0);
            
            const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
            const prevMonthEntries = state.history.filter(h => {
                const d = new Date(h.date + 'T00:00:00');
                return d.getMonth() === prevMonthDate.getMonth() && d.getFullYear() === prevMonthDate.getFullYear();
            }).reduce((acc, h) => acc + h.amount, 0);
            
            document.getElementById('pill-current-month').innerText = fmt(curMonthEntries);
            document.getElementById('pill-prev-month').innerText = fmt(prevMonthEntries);
            
            // 3. Organização das Listas de Contas Inferiores
            let displayBills = [...state.bills];
            if (state.filter === 'pending') displayBills = displayBills.filter(b => !b.paid);
            if (state.filter === 'paid') displayBills = displayBills.filter(b => b.paid);
            
            displayBills.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            const maxVisible = 6;
            const totalBillsCount = displayBills.length;
            const container = document.getElementById('bills-container');
            const seeMoreBox = document.getElementById('see-more-container');
            
            if (totalBillsCount > maxVisible && !seeAllBills) {
                displayBills = displayBills.slice(0, maxVisible);
                seeMoreBox.classList.remove('hidden');
                document.getElementById('btn-see-more').innerHTML = `<span>Ver Mais (${totalBillsCount - maxVisible} compromissos)</span> <i data-lucide="chevron-down" class="w-4 h-4"></i>`;
            } else if (seeAllBills) {
                seeMoreBox.classList.remove('hidden');
                document.getElementById('btn-see-more').innerHTML = `<span>Recolher Lista</span> <i data-lucide="chevron-up" class="w-4 h-4"></i>`;
            } else {
                if (seeMoreBox) seeMoreBox.classList.add('hidden');
            }
            
            if (totalBillsCount === 0) {
                container.innerHTML = `<div class="text-center py-10 text-zinc-600 text-sm">Nenhum compromisso cadastrado aqui.</div>`;
            } else {
                container.innerHTML = displayBills.map(bill => {
                    const billDate = new Date(bill.date + 'T00:00:00');
                    const isOverdue = !bill.paid && billDate < new Date().setHours(0,0,0,0);
                    return `
                        <div class="glass-card p-4 rounded-2xl flex items-center justify-between ${bill.paid ? 'opacity-40' : ''}">
                            <div class="flex flex-col gap-1">
                                <div class="flex items-center gap-2">
                                    <span class="font-bold text-sm ${bill.paid ? 'line-through' : ''}">${escapeHtml(bill.name)}</span>
                                    ${bill.recurring ? '<i data-lucide="refresh-cw" class="w-3 h-3 text-blue-400"></i>' : ''}
                                    ${bill.installments > 1 ? `<span class="text-[9px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">${bill.installmentNum}/${bill.installments}</span>` : ''}
                                </div>
                                <div class="flex items-center gap-3">
                                    <span class="text-[11px] ${isOverdue ? 'text-rose-400 font-bold' : 'text-zinc-500'}">${formatDate(bill.date)}</span>
                                    <span class="text-sm font-black text-emerald-400">${fmt(bill.value)}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                ${!bill.paid ? `
                                    <button onclick="payBill('${bill.id}')" class="bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 px-4 py-2 rounded-xl text-xs font-black active:bg-emerald-600 active:text-white transition-all">PAGAR</button>
                                ` : `
                                    <i data-lucide="check-circle-2" class="text-zinc-600 w-5 h-5"></i>
                                `}
                                <button onclick="openEditBillModal('${bill.id}')" class="p-2 text-zinc-500 hover:text-blue-400 transition-colors"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
            lucide.createIcons();
        }

        function setFilter(f) {
            state.filter = f;
            ['pending', 'paid', 'all'].forEach(id => {
                const el = document.getElementById('tab-' + id);
                el.className = `flex-1 py-3 text-xs font-bold uppercase tracking-widest ${id === f ? 'tab-active' : 'text-zinc-500'}`;
            });
            render();
        }

        function openBillModal() { 
            editingBillId = null;
            document.getElementById('bill-form').reset();
            const today = getLocalDateStr();
            document.getElementById('bill-launch-date').value = today;
            document.getElementById('bill-date').value = today;
            document.getElementById('bill-modal').classList.remove('hidden'); 
        }
        function closeBillModal() { document.getElementById('bill-modal').classList.add('hidden'); }
        
        function openAporteModal() { 
            document.getElementById('aporte-date').value = getLocalDateStr();
            document.getElementById('aporte-modal').classList.remove('hidden'); 
        }
        function closeAporteModal() { document.getElementById('aporte-modal').classList.add('hidden'); }

        document.getElementById('bill-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('bill-name').value;
            const totalValue = parseFloat(document.getElementById('bill-value').value);
            const firstDateStr = document.getElementById('bill-date').value;
            const launchDateStr = document.getElementById('bill-launch-date').value;
            const installments = parseInt(document.getElementById('bill-installments').value);
            const recurring = document.getElementById('bill-recurring').checked;
            
            if (!name.trim() || !Number.isFinite(totalValue) || totalValue <= 0 || !firstDateStr || !launchDateStr || !Number.isInteger(installments) || installments < 1) return;

            if (installments > 1) {
                const partValue = totalValue / installments;
                for (let i = 0; i < installments; i++) {
                    const d = new Date(firstDateStr + 'T00:00:00');
                    d.setMonth(d.getMonth() + i);
                    state.bills.push({
                        id: Date.now().toString() + i + Math.random().toString(36).substr(2, 5),
                        name: name,
                        value: partValue,
                        date: d.toISOString().split('T')[0],
                        launchDate: launchDateStr,
                        installments: installments,
                        installmentNum: i + 1,
                        recurring: false,
                        paid: false
                    });
                }
            } else {
                state.bills.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    name: name,
                    value: totalValue,
                    date: firstDateStr,
                    launchDate: launchDateStr,
                    installments: 1,
                    installmentNum: 1,
                    recurring: recurring,
                    originalDate: firstDateStr,
                    paid: false
                });
            }
            save();
            generateRecurringBills();
            closeBillModal();
        });

        function importData(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedState = JSON.parse(e.target.result);
                    if (importedState && typeof importedState === 'object' && Array.isArray(importedState.bills) && Array.isArray(importedState.history) && Number.isFinite(Number(importedState.balance))) {
                        state = normalizeState(importedState);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                        alert('Backup restaurado com sucesso!');
                        location.reload();
                    } else {
                        alert('Backup inválido ou incompatível.');
                    }
                } catch (err) { alert('Erro no arquivo.'); }
            };
            reader.readAsText(file);
        }

        function formatDate(dateStr) {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        }

        // ==========================================
        // MÓDULO ISOLADO: LEMBRETE ELEGANTE (BEST EFFORT)
        // ==========================================
        const REMINDER_KEY = 'saldo_seguro_reminder_enabled';
        const LAST_VISIT_KEY = 'saldo_seguro_last_visit';

        function initReminderModule() {
            const isEnabled = localStorage.getItem(REMINDER_KEY) === 'true';
            const toggleEl = document.getElementById('toggle-reminder');
            if (toggleEl) toggleEl.checked = isEnabled;

            // Ao abrir o app, limpa qualquer badge/ponto do ícone do app na tela inicial
            clearAppBadgeSafe();

            // Grava o dia do acesso atual
            const todayStr = getLocalDateStr();
            localStorage.setItem(LAST_VISIT_KEY, todayStr);

            // Se o lembrete estiver ativo, verifica e simula a programação local
            if (isEnabled) {
                checkAndTriggerReminder();
            }
        }

        function toggleReminderSetting(enabled) {
            if (enabled) {
                if ('Notification' in window && Notification.permission !== 'granted') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            localStorage.setItem(REMINDER_KEY, 'true');
                            checkAndTriggerReminder();
                        } else {
                            document.getElementById('toggle-reminder').checked = false;
                            localStorage.setItem(REMINDER_KEY, 'false');
                            alert('A permissão para lembretes foi negada no navegador.');
                        }
                    });
                } else {
                    localStorage.setItem(REMINDER_KEY, 'true');
                    checkAndTriggerReminder();
                }
            } else {
                localStorage.setItem(REMINDER_KEY, 'false');
                clearAppBadgeSafe();
            }
        }

        function setAppBadgeSafe(number = 1) {
            if ('setAppBadge' in navigator) {
                navigator.setAppBadge(number).catch(() => {});
            }
        }

        function clearAppBadgeSafe() {
            if ('clearAppBadge' in navigator) {
                navigator.clearAppBadge().catch(() => {});
            }
        }

        function checkAndTriggerReminder() {
            if (localStorage.getItem(REMINDER_KEY) !== 'true') return;

            const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
            const todayStr = getLocalDateStr();

            // Lógica de Melhor Esforço: Se o usuário ficou ao menos 1 dia sem abrir o app, exibe o Badge visual no ícone
            if (lastVisit && lastVisit !== todayStr) {
                setAppBadgeSafe(1);

                // Dispara notificação silenciosa pelo Service Worker se houver permissão
                if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'SHOW_SILENT_REMINDER',
                        title: 'Saldo Seguro',
                        body: 'Só passando para lembrar que seu futuro financeiro existe.'
                    });
                }
            }
        }

        init();
